import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class MyBinderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── VPC ────────────────────────────────────────────────────────────────
    // 2 AZs, private subnets with NAT Gateway for Lambda internet access
    // (MTGJSON API downloads, Google OAuth verification).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ─── EFS ────────────────────────────────────────────────────────────────
    // Persistent storage for DuckDB database and MTGJSON parquet cache.
    const fileSystem = new efs.FileSystem(this, 'FileSystem', {
      vpc,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.ELASTIC,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never delete data on stack destroy.
    });

    // Access point at /lambda with POSIX user 1001:1001.
    // Lambda mounts at /mnt/data — maps to /lambda on EFS.
    const accessPoint = fileSystem.addAccessPoint('LambdaAccessPoint', {
      path: '/lambda',
      posixUser: { uid: '1001', gid: '1001' },
      createAcl: { ownerUid: '1001', ownerGid: '1001', permissions: '755' },
    });

    // ─── ECR Repository ─────────────────────────────────────────────────────
    const ecrRepository = new ecr.Repository(this, 'ServerRepository', {
      repositoryName: 'my-binder-server',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          maxImageCount: 5,
          description: 'Keep only the 5 most recent images',
        },
      ],
    });

    // ─── Secrets Manager references ─────────────────────────────────────────
    // Secrets must be created manually before first deploy:
    //   aws secretsmanager create-secret --name my-binder/SESSION_JWT_SECRET --secret-string "..."
    const jwtSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'JwtSecret',
      'my-binder/SESSION_JWT_SECRET',
    );
    const googleClientIds = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleClientIds',
      'my-binder/GOOGLE_CLIENT_IDS',
    );
    const googleWebClientId = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleWebClientId',
      'my-binder/GOOGLE_WEB_CLIENT_ID',
    );

    // ─── Lambda Function ─────────────────────────────────────────────────────
    // DockerImageFunction builds the container from apps/server/Dockerfile
    // during cdk deploy. No manual docker build/push needed.
    const serverFunction = new lambda.DockerImageFunction(this, 'ServerFunction', {
      functionName: 'my-binder-server',
      code: lambda.DockerImageCode.fromImageAsset(
        // Build context is the repo root so all COPY paths in the Dockerfile
        // (pnpm-workspace.yaml, packages/core/, apps/server/) resolve correctly.
        path.join(__dirname, '..', '..', '..'),
        {
          file: 'apps/server/Dockerfile',
        },
      ),
      memorySize: 1024,
      ephemeralStorageSize: cdk.Size.gibibytes(1),
      timeout: cdk.Duration.seconds(60),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/data'),
      environment: {
        NODE_ENV: 'production',
        DB_PATH: '/mnt/data/db/binder.duckdb',
        MTGJSON_CACHE_DIR: '/mnt/data/mtgjson-cache',
        CARD_PROVIDER: 'mtgjson',
        EFS_PATH: '/mnt/data',
        // Secret names only — values are fetched at runtime via the AWS SDK.
        // This keeps plaintext secrets out of Lambda environment variables.
        SESSION_JWT_SECRET_NAME: jwtSecret.secretName,
        GOOGLE_CLIENT_IDS_SECRET_NAME: googleClientIds.secretName,
        GOOGLE_WEB_CLIENT_ID_SECRET_NAME: googleWebClientId.secretName,
      },
    });

    // Grant Lambda read access to the secrets.
    jwtSecret.grantRead(serverFunction);
    googleClientIds.grantRead(serverFunction);
    googleWebClientId.grantRead(serverFunction);

    // ─── API Gateway HTTP API ────────────────────────────────────────────────
    // $default catch-all route — Fastify handles all routing internally.
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      defaultIntegration: new apigwv2Integrations.HttpLambdaIntegration(
        'LambdaIntegration',
        serverFunction,
        { payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_2_0 },
      ),
    });

    // ─── Stack Outputs ───────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway HTTP API endpoint URL',
      exportName: 'MyBinderApiUrl',
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepository.repositoryUri,
      description: 'ECR repository URI for the server container image',
      exportName: 'MyBinderEcrRepositoryUri',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: serverFunction.functionName,
      description: 'Lambda function name',
      exportName: 'MyBinderLambdaFunctionName',
    });
  }
}
