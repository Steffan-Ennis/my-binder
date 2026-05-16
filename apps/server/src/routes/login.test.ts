import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import { loginRoutes } from './login';

const TEST_WEB_CLIENT_ID = 'test-web-client-id.apps.googleusercontent.com';

describe('Login API', () => {
  const fastify = Fastify();

  beforeAll(async () => {
    process.env['GOOGLE_WEB_CLIENT_ID'] = TEST_WEB_CLIENT_ID;
    await fastify.register(fastifyCookie);
    await fastify.register(loginRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  test('GET /auth/login returns 200', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.statusCode).toBe(200);
  });

  test('GET /auth/login returns Content-Type: text/html', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.headers['content-type']).toContain('text/html');
  });

  test('GET /auth/login body contains the google.accounts script tag', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.body).toContain('accounts.google.com/gsi/client');
  });

  test('GET /auth/login body interpolates GOOGLE_WEB_CLIENT_ID', async () => {
    const response = await fastify.inject({ method: 'GET', url: '/auth/login' });
    expect(response.body).toContain(TEST_WEB_CLIENT_ID);
  });
});
