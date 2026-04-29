import * as cdk from 'aws-cdk-lib';
import { MyBinderStack } from '../lib/my-binder-stack';

const environment = process.env['ENVIRONMENT'];
if (!environment) {
  throw new Error(
    'ENVIRONMENT is required. Set it in .env.dev (see .env.example) or export it in the shell.',
  );
}

const app = new cdk.App();

new MyBinderStack(app, `MyBinderStack-${environment}`, {
  // Deploy to whatever account/region the current AWS CLI profile points to.
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'],
  },
  environment,
  reuseOrphans: process.env['REUSE_ORPHANS'] === 'true',
});
