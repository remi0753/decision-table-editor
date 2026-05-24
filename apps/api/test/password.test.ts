import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/password.js';

describe('password hashing', () => {
  it('creates Better Auth-compatible scrypt hashes and verifies them', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    await expect(
      verifyPassword({
        hash,
        password: 'correct horse battery staple',
      }),
    ).resolves.toBe(true);
    await expect(
      verifyPassword({
        hash,
        password: 'wrong password',
      }),
    ).resolves.toBe(false);
  });

  it('rejects malformed password hashes', async () => {
    await expect(
      verifyPassword({
        hash: 'not-a-valid-hash',
        password: 'correct horse battery staple',
      }),
    ).resolves.toBe(false);
  });
});
