import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, verifyToken } from './sessionJwt';

const TEST_SECRET = 'a-test-secret-that-is-at-least-32-characters-long';

describe('sessionJwt', () => {
  test('issueToken returns a non-empty string', () => {
    const token = issueToken('user-id-123', TEST_SECRET);
    assert.ok(typeof token === 'string');
    assert.ok(token.length > 0);
  });

  test('issued token has three parts (header.payload.signature)', () => {
    const token = issueToken('user-id-123', TEST_SECRET);
    const parts = token.split('.');
    assert.equal(parts.length, 3);
  });

  test('verifyToken returns the userId (sub) for a valid JWT', () => {
    const userId = 'user-abc-123';
    const token = issueToken(userId, TEST_SECRET);
    const result = verifyToken(token, TEST_SECRET);
    assert.equal(result, userId);
  });

  test('issued token has 7-day exp', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = issueToken('user-id', TEST_SECRET);
    const after = Math.floor(Date.now() / 1000);

    // Decode payload without verifying (just check the exp claim)
    const payloadBase64 = token.split('.')[1] as string;
    const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr) as Record<string, unknown>;
    const exp = payload['exp'] as number;
    const expectedMin = before + 7 * 24 * 60 * 60 - 1;
    const expectedMax = after + 7 * 24 * 60 * 60 + 1;
    assert.ok(exp >= expectedMin, `exp ${exp} should be >= ${expectedMin}`);
    assert.ok(exp <= expectedMax, `exp ${exp} should be <= ${expectedMax}`);
  });

  test('verifyToken throws for a tampered token', () => {
    const token = issueToken('user-id', TEST_SECRET);
    const parts = token.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;
    assert.throws(() => verifyToken(tamperedToken, TEST_SECRET));
  });

  test('verifyToken throws for a token signed with a different secret', () => {
    const token = issueToken('user-id', TEST_SECRET);
    assert.throws(() => verifyToken(token, 'a-completely-different-secret-value-32+'));
  });
});
