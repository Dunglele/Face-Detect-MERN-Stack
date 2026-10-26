import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import {
  getJwtSecret,
  signAuthToken,
  verifyAuthToken,
} from '../middleware/authMiddleware.js';

test('JWT config loaded after module import is used consistently for login, BFF auth, and Central auth', () => {
  const originalSecret = process.env.JWT_SECRET;
  const sharedSecret = 'isolated-test-shared-secret-at-least-32-chars';

  try {
    // Regression: server.js previously loaded dotenv only after route modules
    // had frozen a development fallback at import time.
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /JWT_SECRET chưa được cấu hình/);

    process.env.JWT_SECRET = sharedSecret;
    const token = signAuthToken(
      { employeeId: '507f1f77bcf86cd799439011', role: 'employee' },
      { expiresIn: '1h' }
    );

    assert.equal(verifyAuthToken(token).employeeId, '507f1f77bcf86cd799439011');
    assert.equal(jwt.verify(token, sharedSecret).role, 'employee');
    assert.throws(
      () => jwt.verify(token, 'old-import-time-development-fallback'),
      /invalid signature/
    );
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
