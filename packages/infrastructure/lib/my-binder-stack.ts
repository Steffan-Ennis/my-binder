import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as rds from 'aws-cdk-lib/aws-rds'
import { Duration } from "aws-cdk-lib"
import { Construct } from 'constructs';

export interface MyBinderStackProps extends cdk.StackProps {
  /**
   * Environment identifier (e.g. `dev`, `staging`, `prod`) suffixed onto
   * every physical resource name and the `Environment` stack tag so
   * multiple environments can coexist in one AWS account.
   */
  readonly environment: string;

  /**
   * When true, import the retained secrets (SESSION_JWT_SECRET,
   * GOOGLE_CLIENT_IDS, GOOGLE_WEB_CLIENT_ID) from AWS by name instead of
   * creating them. Use this after a `cdk destroy` has left orphans behind
   * so the next deploy doesn't fail with "resource already exists" errors.
   *
   * Note: CDK's `from*` factories do NOT verify the resource exists — they
   * just wrap the name in a reference. If this is `true` and the orphan
   * isn't actually there, deploy will fail at CloudFormation time.
   *
   * @default false
   */
  readonly reuseOrphans?: boolean;
}

export class MyBinderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MyBinderStackProps) {
    super(scope, id, props);

    const env = props.environment;
    const reuseOrphans = props.reuseOrphans ?? false;

    // Tag every resource in the stack with the environment so we can filter
    // in the AWS console / cost explorer.
    cdk.Tags.of(this).add('Environment', env);

    // Physical resource names — suffixed with `env` so multiple environments
    // can coexist in one AWS account without colliding.
    const ecrRepoName = `my-binder-server-${env}`;
    const jwtSecretName = `my-binder-${env}/SESSION_JWT_SECRET`;
    const googleClientIdsSecretName = `my-binder-${env}/GOOGLE_CLIENT_IDS`;
    const googleWebClientIdSecretName = `my-binder-${env}/GOOGLE_WEB_CLIENT_ID`;
    const lambdaFunctionName = `my-binder-server-${env}`;
    const databaseName = `my_binder_${env}`;

    // ─── VPC ────────────────────────────────────────────────────────────────
    // 2 AZs, private subnets with a NAT instance for Lambda internet access
    // (MTGJSON parquet downloads, Google OAuth token verification).
    //
    // NAT instance (t4g.nano, ~$3/month) replaces Managed NAT Gateway (~$32/month).
    // CDK NatProvider.instanceV2 uses Amazon Linux 2023 with iptables-based NAT;
    // it creates the instance in the public subnet and configures routing automatically.
    const natProvider = ec2.NatProvider.instanceV2({
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
    });

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      natGatewayProvider: natProvider,
    });

    // ─── EFS ────────────────────────────────────────────────────────────────
    // Persistent storage for DuckDB database and MTGJSON parquet cache.
    const fileSystem = new efs.FileSystem(this, 'FileSystem', {
      vpc,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.ELASTIC,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never delete data on stack destroy.
    });

    const rdsUserName = `my_binder_rds_${env}`;

    // ─── RDS Aurora ─────────────────────────────────────────────────────────
    // Aurora Serverless V2 PostgreSQL for user and card collection storage.
    const rdsCredentials = new rds.DatabaseSecret(this, 'my-binder-rds-credentials', {
      username: rdsUserName,
      secretName: `my-binder-rds-credentials-${env}`
    });
    rdsCredentials.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Security group for RDS — allows inbound on 5432 from VPC (Lambda) and
    // from the internet (local developer access).
    // TODO: restrict 0.0.0.0/0 to your static IP for production hardening.
    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc,
      description: 'database-security-group',
      allowAllOutbound: false,
    });
    rdsSg.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'Lambda-RDS');
    rdsSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(5432), 'Local-developer-access');

    // Persistence for user data and card collections.
    // Placed in public subnets with publiclyAccessible so developers can
    // connect directly from a local machine via a standard psql client.
    const userRDS = new rds.DatabaseCluster(this, 'DatabaseCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_17_7 }),
      writer: rds.ClusterInstance.serverlessV2('writerInstance', {
        publiclyAccessible: true,
      }),
      vpc,
      credentials: rds.Credentials.fromSecret(rdsCredentials),
      defaultDatabaseName: databaseName,
      autoMinorVersionUpgrade: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [rdsSg],
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 2,
      serverlessV2AutoPauseDuration: Duration.minutes(30),
    });


    // Access point at /lambda with POSIX user 1001:1001.
    // Lambda mounts at /mnt/data — maps to /lambda on EFS.
    const accessPoint = fileSystem.addAccessPoint('LambdaAccessPoint', {
      path: '/lambda',
      posixUser: { uid: '1001', gid: '1001' },
      createAcl: { ownerUid: '1001', ownerGid: '1001', permissions: '755' },
    });

    // ─── ECR Repository ─────────────────────────────────────────────────────
    // Retained on stack destroy — when reuseOrphans=true, import the orphan
    // left behind by a prior deploy instead of creating fresh.
    const ecrRepository = new ecr.Repository(this, 'ServerRepository', {
      repositoryName: ecrRepoName,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          maxImageCount: 5,
          description: 'Keep only the 5 most recent images',
        },
      ],
    });

    // ─── Secrets Manager ────────────────────────────────────────────────────
    // Secrets are created by CDK with safe defaults. Overwrite the Google
    // secrets manually after first deploy with real values:
    //
    //   aws secretsmanager put-secret-value \
    //     --secret-id my-binder/GOOGLE_CLIENT_IDS \
    //     --secret-string "ios-client-id,android-client-id,web-client-id"
    //
    //   aws secretsmanager put-secret-value \
    //     --secret-id my-binder/GOOGLE_WEB_CLIENT_ID \
    //     --secret-string "your-web-client-id"
    //
    // SESSION_JWT_SECRET is auto-generated by CDK — no manual update needed.

    // Auto-generated random 64-char alphanumeric string. Safe to use immediately.
    // When reuseOrphans=true, import the orphan from a prior deploy.
    const jwtSecret: secretsmanager.ISecret = reuseOrphans
      ? secretsmanager.Secret.fromSecretNameV2(this, 'JwtSecret', jwtSecretName)
      : new secretsmanager.Secret(this, 'JwtSecret', {
          secretName: jwtSecretName,
          description: 'HS256 secret for signing session JWTs',
          generateSecretString: {
            excludePunctuation: true,
            passwordLength: 64,
          },
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    // Placeholder — overwrite with real client IDs after first deploy.
    // When reuseOrphans=true, import the orphan from a prior deploy.
    const googleClientIds: secretsmanager.ISecret = reuseOrphans
      ? secretsmanager.Secret.fromSecretNameV2(
          this,
          'GoogleClientIds',
          googleClientIdsSecretName,
        )
      : new secretsmanager.Secret(this, 'GoogleClientIds', {
          secretName: googleClientIdsSecretName,
          description: 'Comma-separated Google OAuth client IDs (iOS, Android, Web)',
          secretStringValue: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    // Placeholder — overwrite with real web client ID after first deploy.
    // When reuseOrphans=true, import the orphan from a prior deploy.
    const googleWebClientId: secretsmanager.ISecret = reuseOrphans
      ? secretsmanager.Secret.fromSecretNameV2(
          this,
          'GoogleWebClientId',
          googleWebClientIdSecretName,
        )
      : new secretsmanager.Secret(this, 'GoogleWebClientId', {
          secretName: googleWebClientIdSecretName,
          description: 'Google OAuth web client ID for the /auth/login page',
          secretStringValue: cdk.SecretValue.unsafePlainText('REPLACE_ME'),
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    // ─── Lambda Function ─────────────────────────────────────────────────────
    // DockerImageFunction builds the container from apps/server/Dockerfile
    // during cdk deploy. No manual docker build/push needed.
    const serverFunction = new lambda.DockerImageFunction(this, 'ServerFunction', {
      functionName: lambdaFunctionName,
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
      timeout: cdk.Duration.seconds(300),
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
        DATABASE_URL: userRDS.clusterEndpoint.hostname,
        DATABASE_PORT: userRDS.clusterEndpoint.port.toString(),
        DATABASE_USER: rdsUserName,
        DATABASE_SECRET_NAME: rdsCredentials.secretName,
      },
    });

    // Grant Lambda read access to the secrets.
    jwtSecret.grantRead(serverFunction);
    googleClientIds.grantRead(serverFunction);
    googleWebClientId.grantRead(serverFunction);
    rdsCredentials.grantRead(serverFunction)

    // Grant Lambda connect access to the rds cluster
    userRDS.grantConnect(serverFunction, rdsUserName)

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
      exportName: `MyBinderApiUrl-${env}`,
    });

    new cdk.CfnOutput(this, 'EcrRepositoryUri', {
      value: ecrRepository.repositoryUri,
      description: 'ECR repository URI for the server container image',
      exportName: `MyBinderEcrRepositoryUri-${env}`,
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: serverFunction.functionName,
      description: 'Lambda function name',
      exportName: `MyBinderLambdaFunctionName-${env}`,
    });
  }
}
