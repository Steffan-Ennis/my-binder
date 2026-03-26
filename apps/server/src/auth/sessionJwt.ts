import jwt from 'jsonwebtoken';
import { SESSION_JWT_TTL_DAYS } from '@my-binder/core';

/**
 * Issue a signed HS256 session JWT with a 7-day TTL.
 * The `sub` claim holds the user's UUID.
 */
export function issueToken(userId: string, secret: string): string {
  return jwt.sign({ sub: userId }, secret, {
    algorithm: 'HS256',
    expiresIn: SESSION_JWT_TTL_DAYS * 24 * 60 * 60,
  });
}

/**
 * Verify a session JWT and return the user ID (`sub` claim).
 * Throws if the token is invalid, expired, or tampered.
 */
export function verifyToken(token: string, secret: string): string {
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof payload === 'string' || !payload['sub']) {
    throw new Error('Invalid token payload: missing sub claim');
  }
  return payload['sub'] as string;
}
