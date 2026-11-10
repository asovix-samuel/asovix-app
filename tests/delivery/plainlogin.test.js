import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';
import { checkLogin, loginConfigured, createSessionToken, verifySessionToken } from '../../lib/delivery/auth.js';

test('a plain DELIVERY_PASSWORD alone is enough to sign in', () => {
  const saved = { ...process.env };
  delete process.env.DELIVERY_PASSWORD_HASH;
  delete process.env.DELIVERY_SESSION_SECRET;
  process.env.DELIVERY_PASSWORD = 'a-long-test-password';
  try {
    assert.equal(loginConfigured(), true);
    assert.equal(checkLogin('a-long-test-password'), true);
    assert.equal(checkLogin('wrong'), false);
    assert.equal(verifySessionToken(createSessionToken()), true);
  } finally {
    process.env = saved;
  }
});
