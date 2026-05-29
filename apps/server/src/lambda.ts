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
// `parseCommaSeparatedQueryParams` defaults to `true` in @fastify/aws-lambda v6,
// which auto-splits any comma-containing v2.0 query value into an array before it
// reaches Fastify (e.g. `creature_types=Human, Dwarf` → ["Human", " Dwarf"]). Our
// routes expect these filters as raw comma-separated *strings* (schema declares
// `type: 'string'`; the handlers call `.split(',')` themselves), so we disable it
// to make the Lambda path behave identically to local dev.
const proxyPromise = buildApp().then(({ fastify }) =>
  awsLambdaFastify(fastify, {
    callbackWaitsForEmptyEventLoop: false,
    parseCommaSeparatedQueryParams: false,
  }),
);

export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<unknown> {
  const proxy = await proxyPromise;
  return proxy(event, context);
}
