import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { loginRoutes } from './login';

describe('GET /auth/login', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    process.env['GOOGLE_WEB_CLIENT_ID'] = 'test-web-client-id.apps.googleusercontent.com';
    await fastify.register(fastifyCookie);
    await fastify.register(loginRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('returns 200', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.statusCode).toBe(200);
  });

  test('returns Content-Type: text/html', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.headers['content-type']).toContain('text/html');
  });

  test('response body contains google.accounts script tag', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.body).toContain('accounts.google.com/gsi/client');
  });

  test('response body contains GOOGLE_WEB_CLIENT_ID', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.body).toContain('test-web-client-id.apps.googleusercontent.com');
  });
});
