#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MyBinderStack } from '../lib/my-binder-stack';

const app = new cdk.App();

new MyBinderStack(app, 'MyBinderStack', {
  // Deploy to whatever account/region the current AWS CLI profile points to.
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'],
  },
});
