import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '@src/db/client';
import { upsertUser, findUserById } from './userRepository';

describe('userRepository', () => {
  before(async () => {
    await initDb(':memory:');
  });

  const baseUser = {
    googleSub: 'google-sub-abc',
    email: 'user@gmail.com',
    displayName: 'Jane Doe',
    avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
  };

  test('upsertUser creates a new user and returns it', async () => {
    const user = await upsertUser(baseUser);
    assert.ok(user.id, 'should have an id');
    assert.equal(user.email, 'user@gmail.com');
    assert.equal(user.displayName, 'Jane Doe');
    assert.equal(user.avatarUrl, 'https://lh3.googleusercontent.com/photo.jpg');
  });

  test('upsertUser is idempotent on google_sub — returns same id on second call', async () => {
    const first = await upsertUser(baseUser);
    const second = await upsertUser(baseUser);
    assert.equal(first.id, second.id);
  });

  test('upsertUser updates display_name and email on re-sign-in', async () => {
    const original = await upsertUser(baseUser);
    const updated = await upsertUser({
      ...baseUser,
      displayName: 'Jane Smith',
      email: 'jane.smith@gmail.com',
    });
    assert.equal(updated.id, original.id);
    assert.equal(updated.displayName, 'Jane Smith');
    assert.equal(updated.email, 'jane.smith@gmail.com');
  });

  test('upsertUser handles null avatarUrl', async () => {
    const user = await upsertUser({
      googleSub: 'google-sub-no-avatar',
      email: 'noavatar@gmail.com',
      displayName: 'No Avatar',
      avatarUrl: null,
    });
    assert.equal(user.avatarUrl, null);
  });

  test('findUserById returns the user when found', async () => {
    const created = await upsertUser({
      googleSub: 'google-sub-find-test',
      email: 'findme@gmail.com',
      displayName: 'Find Me',
      avatarUrl: null,
    });
    const found = await findUserById(created.id);
    assert.ok(found !== null, 'should find the user');
    assert.equal(found.id, created.id);
    assert.equal(found.email, 'findme@gmail.com');
  });

  test('findUserById returns null for unknown id', async () => {
    const result = await findUserById('00000000-0000-0000-0000-000000000000');
    assert.equal(result, null);
  });
});
