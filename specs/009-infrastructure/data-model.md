# Data Model: 009-infrastructure

**Date**: 2026-03-29 (revised -- single DuckDB on EFS with imported card data)

## Overview

This feature changes how card data is stored: instead of querying parquet files directly via the MTGJSON SDK, card data is imported into DuckDB tables. The single DuckDB file on EFS contains both user data and card data. A metadata table tracks import state.

## Infrastructure Resources (CDK-Managed)

### API Gateway HTTP API

- **Purpose**: Public HTTPS entry point for all API requests
- **URL**: `https://<id>.execute-api.<region>.amazonaws.com`
- **TLS**: AWS-managed, automatic, TLS 1.2 minimum
- **Route**: `$default` catch-all -- Fastify handles all routing internally
- **Payload format**: v2.0 (supported by `@fastify/aws-lambda`)
- **Timeout**: 29 seconds per request (hard limit)

### Lambda Function (Container Image)

- **Runtime**: Node.js 22 (container image based on `public.ecr.aws/lambda/nodejs:22`)
- **Handler**: `@fastify/aws-lambda` wrapper around existing Fastify app
- **Memory**: 1024 MB (sufficient for DuckDB + Fastify)
- **Ephemeral storage**: 1-2 GB `/tmp` (for DuckDB temp files)
- **Timeout**: 60 seconds (Lambda-side; API Gateway enforces 29s for HTTP requests)
- **VPC**: Required (for EFS access)
- **EFS mount**: `/mnt/data` (database + parquet cache)
- **Environment variables**: PORT, DB_PATH, MTGJSON_CACHE_DIR, NODE_ENV, CARD_PROVIDER, EFS_PATH
- **Secrets** (from Secrets Manager): SESSION_JWT_SECRET, GOOGLE_CLIENT_IDS, GOOGLE_WEB_CLIENT_ID
- **Initialization**: Card data import check runs during Lambda init phase (outside handler)

### ECR Repository

- **Name**: `my-binder-server`
- **Purpose**: Stores Lambda container images
- **Lifecycle**: Keep last 5 images; old images cleaned up via lifecycle rule

### EFS Filesystem

- **Performance mode**: General Purpose
- **Throughput mode**: Elastic (pay-per-use)
- **Purpose**: Persistent storage for DuckDB database and MTGJSON parquet cache
- **Access point**: `/lambda` with POSIX user 1001:1001
- **Lambda mount path**: `/mnt/data`
- **Contents**:
  - `db/binder.duckdb` -- single DuckDB database (card data + user data)
  - `mtgjson-cache/parquet/*.parquet` -- SDK-managed parquet cache
  - `locks/card-import.lock` -- rebuild coordination lock file

### VPC & Networking

- **VPC**: CDK-managed with public + private subnets (2 AZs minimum)
- **Lambda placement**: Private subnets (required for EFS access)
- **Security groups**: Lambda SG allows outbound NFS (port 2049) to EFS SG; EFS SG allows inbound from Lambda SG
- **NAT Gateway**: Required for Lambda internet access (MTGJSON API downloads, Google OAuth verification). CDK creates one by default.

### Secrets Manager

- **`my-binder/SESSION_JWT_SECRET`**: HS256 signing key (min 32 chars)
- **`my-binder/GOOGLE_CLIENT_IDS`**: Comma-separated OAuth client IDs
- **`my-binder/GOOGLE_WEB_CLIENT_ID`**: Web-specific Google OAuth client ID

## New Application Data: Card Import Metadata

### `card_import_metadata` table

Tracks when card data was last imported from parquet, enabling timestamp-based rebuild decisions.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Always 1 (singleton row) |
| last_import_at | TIMESTAMP | When the last successful import completed |
| parquet_mtime | TIMESTAMP | Modification time of the source parquet file at import |
| parquet_count | INTEGER | Number of cards imported |

**Created by**: Migration `003_card_import_metadata.sql`
**Updated by**: Card importer after each successful rebuild

## Storage Architecture

```
EFS Mount (/mnt/data):
  ├── db/
  │   └── binder.duckdb              (single DB: card data + user data)
  ├── mtgjson-cache/
  │   └── parquet/
  │       ├── cards.parquet          (~14 MB, SDK-managed)
  │       ├── cardIdentifiers.parquet (~12 MB, SDK-managed)
  │       └── cardLegalities.parquet (~2.4 MB, SDK-managed)
  └── locks/
      └── card-import.lock           (transient, created during rebuild)

Lambda /tmp (ephemeral per invocation):
  └── (DuckDB temp files during query execution)

Local Development (same structure, local paths):
  ├── ./binder.duckdb                (DB_PATH default)
  └── ./data/mtgjson-cache/          (MTGJSON_CACHE_DIR default)
```

## Cold Start Flow

```
1. Lambda init phase starts (15-minute timeout)
2. Open DuckDB at DB_PATH (create if missing)
3. SET temp_directory='/tmp'
4. Run migrations (schema_migrations, users, card_import_metadata)
5. Check MTGJSON_CACHE_DIR for parquet files
   ├── Missing → SDK downloads from MTGJSON API to cache dir
   └── Present → continue
6. Compare parquet mtime vs card_import_metadata.parquet_mtime
   ├── Newer → acquire lock → import parquet into card tables → release lock
   ├── Current → skip import
   └── Lock held → wait briefly or serve with existing data
7. Lambda init complete, handler ready
```

## Existing Data Model (Unchanged at schema level)

- **users** table: `id`, `google_sub`, `email`, `display_name`, `avatar_url`, `created_at`, `updated_at`
- **schema_migrations** table: migration tracking
- Card data tables: schema defined by MTGJSON parquet structure (cards, identifiers, legalities) -- now persisted in DuckDB instead of queried from parquet at runtime
