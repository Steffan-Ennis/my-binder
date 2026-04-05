import 'reflect-metadata';
import awsLambdaFastify from '@fastify/aws-lambda';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { buildApp } from './app';

// Build the Fastify app during the Lambda init phase (outside the handler).
// This runs within the 15-minute init timeout, giving time for:
//   1. Config load + Secrets Manager fetch
//   2. DuckDB open + migrations
//   3. MTGJSON SDK parquet download/cache check
//   4. Card import from parquet into DuckDB
// Subsequent warm invocations reuse this context with no re-initialisation.
const proxyPromise = buildApp().then(({ fastify }) =>
  awsLambdaFastify(fastify, { callbackWaitsForEmptyEventLoop: false }),
);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<unknown> {
  const proxy = await proxyPromise;
  return proxy(event, context);
}
