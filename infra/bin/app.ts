#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const apiStack = new ApiStack(app, 'PokemonStadiumApi', { env });

new FrontendStack(app, 'PokemonStadiumFrontend', {
  env,
  apiUrl: apiStack.apiUrl,
});
