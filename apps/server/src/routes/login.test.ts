import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { loginRoutes } from './login';

describe('GET /auth/login', () => {
  const fastify = Fastify();

  before(async () => {
    process.env['GOOGLE_WEB_CLIENT_ID'] = 'test-web-client-id.apps.googleusercontent.com';
    await fastify.register(fastifyCookie);
    await fastify.register(loginRoutes);
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  test('returns 200', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    assert.equal(response.statusCode, 200);
  });

  test('returns Content-Type: text/html', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    assert.ok(
      response.headers['content-type']?.includes('text/html'),
      `expected text/html, got: ${response.headers['content-type']}`,
    );
  });

  test('response body contains google.accounts script tag', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    assert.ok(
      response.body.includes('accounts.google.com/gsi/client'),
      'expected GIS SDK script tag in response body',
    );
  });

  test('response body contains GOOGLE_WEB_CLIENT_ID', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    assert.ok(
      response.body.includes('test-web-client-id.apps.googleusercontent.com'),
      'expected GOOGLE_WEB_CLIENT_ID in response body',
    );
  });
});
