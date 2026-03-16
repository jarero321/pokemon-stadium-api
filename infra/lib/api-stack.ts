import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const githubOwner = this.node.tryGetContext('githubOwner');
    const githubApiRepo = this.node.tryGetContext('githubApiRepo');

    // ── Default VPC (no custom networking needed) ────────────
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // ── Secrets (created manually, imported by full ARN) ──────
    const mongoUri = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'MongoDbUri',
      'arn:aws:secretsmanager:us-east-1:594474086473:secret:pokemon-stadium/mongodb-uri-uf5QaX',
    );

    const jwtSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'JwtSecret',
      'arn:aws:secretsmanager:us-east-1:594474086473:secret:pokemon-stadium/jwt-secret-FYV2uu',
    );

    // ── ECS Cluster ──────────────────────────────────────────
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: 'pokemon-stadium',
      vpc,
    });

    // ── Fargate + ALB ────────────────────────────────────────
    const service = new ecs_patterns.ApplicationLoadBalancedFargateService(
      this,
      'Service',
      {
        cluster,
        serviceName: 'pokemon-stadium-api',
        cpu: 256,
        memoryLimitMiB: 512,
        desiredCount: 1,
        assignPublicIp: true,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', '..')),
          containerPort: 8080,
          environment: {
            PORT: '8080',
            HOST: '0.0.0.0',
            NODE_ENV: 'production',
            POKEMON_API_BASE_URL:
              'https://pokemon-api-92034153384.us-central1.run.app',
            CORS_ORIGIN: '*', // CloudFront handles HTTPS, CORS must allow the CF domain
          },
          secrets: {
            MONGODB_URI: ecs.Secret.fromSecretsManager(mongoUri),
            JWT_SECRET: ecs.Secret.fromSecretsManager(jwtSecret),
          },
        },
      },
    );

    // Grant ECS task execution role access to read secrets
    mongoUri.grantRead(service.taskDefinition.executionRole!);
    jwtSecret.grantRead(service.taskDefinition.executionRole!);

    // ALB health check against Fastify endpoint
    service.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
    });

    // WebSocket: keep connections alive up to 1 hour
    service.loadBalancer.setAttribute('idle_timeout.timeout_seconds', '3600');

    // ── CloudFront (HTTPS → HTTP ALB) ──────────────────────
    const distribution = new cloudfront.Distribution(this, 'ApiCdn', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(
          service.loadBalancer.loadBalancerDnsName,
          {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 80,
          },
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy:
          cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      comment: 'Pokemon Stadium API — HTTPS termination',
    });

    // ── GitHub OIDC (CI/CD without long-lived keys) ──────────
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const deployRole = new iam.Role(this, 'GithubDeployRole', {
      roleName: 'pokemon-stadium-deploy',
      assumedBy: new iam.FederatedPrincipal(
        githubProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${githubOwner}/${githubApiRepo}:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
    });

    deployRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['iam:*'],
        resources: [`arn:aws:iam::${this.account}:role/pokemon-stadium-*`],
      }),
    );

    // ── Outputs ──────────────────────────────────────────────
    this.apiUrl = `https://${distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'API endpoint (CloudFront HTTPS)',
    });

    new cdk.CfnOutput(this, 'ApiUrlHttp', {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
      description: 'API endpoint (ALB HTTP — direct)',
    });

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set this as AWS_DEPLOY_ROLE_ARN secret in GitHub',
    });
  }
}
