import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const githubOwner = this.node.tryGetContext('githubOwner');
    const githubFrontRepo = this.node.tryGetContext('githubFrontRepo');

    // GitHub PAT stored in Secrets Manager (create manually before first deploy)
    // aws secretsmanager create-secret --name pokemon-stadium/github-token --secret-string "ghp_xxx"
    const githubToken = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GithubToken',
      'pokemon-stadium/github-token',
    );

    // ── Amplify App (Next.js SSR) ────────────────────────────
    const app = new amplify.CfnApp(this, 'FrontendApp', {
      name: 'pokemon-stadium-front',
      platform: 'WEB_COMPUTE',
      repository: `https://github.com/${githubOwner}/${githubFrontRepo}`,
      accessToken: githubToken.secretValue.unsafeUnwrap(),
      environmentVariables: [
        {
          name: 'NEXT_PUBLIC_API_URL',
          value: props.apiUrl,
        },
      ],
      buildSpec: JSON.stringify({
        version: 1,
        frontend: {
          phases: {
            preBuild: {
              commands: [
                'corepack enable',
                'corepack prepare pnpm@latest --activate',
                'pnpm install --frozen-lockfile',
              ],
            },
            build: {
              commands: ['pnpm run build'],
            },
          },
          artifacts: {
            baseDirectory: '.next',
            files: ['**/*'],
          },
          cache: {
            paths: ['node_modules/**/*', '.next/cache/**/*'],
          },
        },
      }),
    });

    // ── Auto-build on push to main ───────────────────────────
    new amplify.CfnBranch(this, 'MainBranch', {
      appId: app.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      framework: 'Next.js - SSR',
    });

    // ── Outputs ──────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: app.attrAppId,
      description: 'Amplify App ID',
    });

    new cdk.CfnOutput(this, 'AmplifyUrl', {
      value: `https://main.${app.attrDefaultDomain}`,
      description: 'Frontend URL',
    });
  }
}
