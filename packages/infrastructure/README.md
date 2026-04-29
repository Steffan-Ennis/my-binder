# @my-binder/infrastructure

AWS CDK v2 stack for my-binder (Lambda + API Gateway + EFS + ECR + Aurora PostgreSQL).

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `pnpm build`             compile typescript to js
* `pnpm watch`             watch for changes and compile
* `pnpm cdk:dev:synth`     synthesize the CloudFormation template (dev)
* `pnpm cdk:dev:diff`      compare deployed stack with current state (dev)
* `pnpm cdk:dev:deploy`    deploy this stack to your default AWS account/region (dev)
* `pnpm cdk:dev:destroy`   tear the stack down (dev)

Scripts are namespaced per environment (`cdk:<env>:<cmd>`). Each `cdk:dev:*`
script runs CDK via `node --env-file=.env.dev --import tsx bin/app.ts`,
mirroring the `--env-file` pattern used by `apps/server`. Node 22's built-in
`--env-file` flag loads `.env.dev` into `process.env` before `bin/app.ts`
executes — no `dotenv` dependency, and no runtime `process.loadEnvFile()` call.
Add a matching `cdk:staging:*` / `cdk:prod:*` group when you introduce more
environments, each pointing at their own `.env.<env>` file.

Running `npx cdk` directly (bypassing the scripts) uses the `app` setting from
`cdk.json`, which does **not** load any `.env.*` file — so you must export the
vars yourself or use the `pnpm cdk:<env>:*` scripts.

## Environment variables

Only `.env.example` is committed; copy it to `.env.dev` (gitignored) and edit
locally. The `pnpm cdk:*` scripts load it automatically via `--env-file`.

| Variable | Values | Purpose |
|---|---|---|
| `CDK_DEFAULT_ACCOUNT` | AWS account ID | Target account for deploy (set by AWS CLI profile, not `.env.dev`) |
| `CDK_DEFAULT_REGION` | AWS region | Target region for deploy (set by AWS CLI profile, not `.env.dev`) |
| `ENVIRONMENT` | `dev` / `staging` / `prod` / … | **Required.** Suffixed onto every physical resource name and the stack ID — see below |
| `REUSE_ORPHANS` | `true` / `false` | Import retained secrets instead of creating them — see below |

### `ENVIRONMENT`

Required. `bin/app.ts` throws at synth time if it's missing. The value is
passed to `MyBinderStack` as the `environment` prop and threaded through
every physical resource name so multiple environments can coexist in one
AWS account:

| Resource | Physical name |
|---|---|
| Stack ID | `MyBinderStack-${env}` |
| ECR repository | `my-binder-server-${env}` |
| Lambda function | `my-binder-server-${env}` |
| Aurora database | `my_binder_${env}` |
| Aurora master user | `my_binder_rds_${env}` |
| JWT secret | `my-binder-${env}/SESSION_JWT_SECRET` |
| Google client IDs secret | `my-binder-${env}/GOOGLE_CLIENT_IDS` |
| Google web client ID secret | `my-binder-${env}/GOOGLE_WEB_CLIENT_ID` |
| CfnOutput export names | `MyBinder{ApiUrl,EcrRepositoryUri,LambdaFunctionName}-${env}` |

Every resource in the stack is also tagged with `Environment=${env}` via
`cdk.Tags.of(this).add()`, which propagates to all taggable resources for
filtering in the AWS console and Cost Explorer.

Auto-generated names (VPC, EFS, NAT instance, etc.) already include the
stack ID, so they pick up the environment for free.

### `REUSE_ORPHANS`

Three secrets in the stack are created with `RemovalPolicy.RETAIN` so they
survive a `cdk destroy`:

* `my-binder/SESSION_JWT_SECRET`
* `my-binder/GOOGLE_CLIENT_IDS`
* `my-binder/GOOGLE_WEB_CLIENT_ID`

After a `cdk destroy`, these secrets are left behind as **orphans** in AWS.
The next `cdk deploy` would then fail with "resource already exists" errors
because CloudFormation tries to recreate them.

To recover, set `REUSE_ORPHANS=true` in `.env.dev` (or inline on the command
line) before deploying:

```bash
# Option 1: persist in .env.dev
echo 'REUSE_ORPHANS=true' > .env.dev
npx cdk deploy

# Option 2: one-off inline override
REUSE_ORPHANS=true npx cdk deploy
```

`bin/app.ts` reads the variable and passes it as the `reuseOrphans` prop to
`MyBinderStack`. The stack then calls `secretsmanager.Secret.fromSecretNameV2`
instead of `new secretsmanager.Secret` for each of the three secrets above.
Leave the flag at `false` for normal first-time or ongoing deploys.

**Caveats:**

* CDK's `from*` factories do **not** verify the resource exists — they just
  wrap the name in a reference. If you set `REUSE_ORPHANS=true` and the
  orphan isn't actually there, deploy will fail at CloudFormation time with
  a reference-resolution error.
* Imported secrets are **not managed** by the stack. You can't update
  descriptions, rotation, or other properties through CDK while they are
  imported — modify them out-of-band or delete the orphan and redeploy
  with `REUSE_ORPHANS=false`.
* The ECR repository is always created fresh (no `REUSE_ORPHANS` branch).
  If a `cdk destroy` leaves an orphaned ECR repo, delete it manually before
  the next deploy.
