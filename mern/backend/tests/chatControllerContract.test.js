import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import axios from 'axios';
import express from 'express';
import jwt from 'jsonwebtoken';
import { handleChat } from '../controllers/chatController.js';
import chatRouter from '../routes/chatRoutes.js';
import { getJwtSecret } from '../middleware/authMiddleware.js';

test('chatController contract: proxy authenticated {text} to Central /api/chat returning {answer, intent, intentConfidence} with 30s timeout', async () => {
  const originalPost = axios.post;
  let capturedUrl = null;
  let capturedPayload = null;
  let capturedHeaders = null;
  let capturedTimeout = null;

  try {
    axios.post = async (url, payload, options) => {
      capturedUrl = url;
      capturedPayload = payload;
      capturedHeaders = options?.headers;
      capturedTimeout = options?.timeout;
      return {
        status: 200,
        data: {
          answer: 'Hôm nay có 25 người đi làm.',
          intent: 'count_present',
          intentConfidence: 0.98,
        },
      };
    };

    const req = {
      body: { message: '  Hôm nay có bao nhiêu người đi làm?  ' },
      headers: { authorization: 'Bearer valid-jwt-token' },
      user: { fullName: 'Nguyen Van A' },
    };

    let responseStatus = 200;
    let responseData = null;

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    await handleChat(req, res);

    assert.equal(responseStatus, 200);
    assert.ok(capturedUrl.endsWith('/api/chat'), 'Must call /api/chat endpoint');
    assert.deepEqual(capturedPayload, { text: 'Hôm nay có bao nhiêu người đi làm?' });
    assert.equal(capturedHeaders.Authorization, 'Bearer valid-jwt-token');
    assert.equal(capturedTimeout, 30000, 'Must use 30000ms timeout');
    assert.equal(responseData.answer, 'Hôm nay có 25 người đi làm.');
    assert.equal(responseData.intent, 'count_present');
    assert.equal(responseData.intentConfidence, 0.98);
    assert.equal(responseData.source, undefined, 'No fake fallback source fields');
  } finally {
    axios.post = originalPost;
  }
});

test('chatController validation: rejects 400 when req.body is undefined, empty, non-string or whitespace', async () => {
  const cases = [
    { req: {} }, // undefined req.body
    { req: { body: null } },
    { req: { body: '' } },
    { req: { body: { message: '' } } },
    { req: { body: { message: '   ' } } },
    { req: { body: { message: null } } },
    { req: { body: { message: 12345 } } },
    { req: { body: {} } },
  ];

  for (const c of cases) {
    let responseStatus = 200;
    let responseData = null;
    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      },
    };

    const requestObj = {
      headers: { authorization: 'Bearer token' },
      ...c.req,
    };

    await handleChat(requestObj, res);

    assert.equal(responseStatus, 400, `Expected 400 for input: ${JSON.stringify(c.req)}`);
    assert.ok(
      responseData.error.includes('không hợp lệ') ||
      responseData.error.includes('không được để trống') ||
      responseData.error.includes('chuỗi hợp lệ')
    );
  }
});

test('chatController auth enforcement: rejects 401 when authorization header is missing in controller', async () => {
  let responseStatus = 200;
  let responseData = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const req = {
    body: { message: 'Kiểm tra điểm danh' },
    headers: {},
  };

  await handleChat(req, res);

  assert.equal(responseStatus, 401);
  assert.ok(responseData.error.includes('Yêu cầu đăng nhập'));
});

test('chatController upstream contract: rejects 502 when Central returns malformed, empty answer, or success:false', async () => {
  const originalPost = axios.post;

  const malformedCases = [
    { data: null },
    { data: 'not an object' },
    { data: { success: false, error: 'Database query failed' } },
    { data: { answer: '' } },
    { data: { answer: '   ' } },
    { data: { answer: null } },
    { data: { answer: 123 } },
    { data: { intent: 'employee_summary' } }, // missing answer
  ];

  try {
    for (const c of malformedCases) {
      axios.post = async () => ({
        status: 200,
        data: c.data,
      });

      let responseStatus = 200;
      let responseData = null;

      const res = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(data) {
          responseData = data;
          return this;
        },
      };

      await handleChat({ body: { message: 'Test malformed' }, headers: { authorization: 'Bearer token' } }, res);

      assert.equal(responseStatus, 502, `Expected 502 for upstream data: ${JSON.stringify(c.data)}`);
      assert.ok(responseData.error, 'Must provide honest error message');
      assert.equal(responseData.answer, undefined, 'Must not return empty or fake success answer');
    }
  } finally {
    axios.post = originalPost;
  }
});

test('chatController error handling: honestly handles Central HTTP 401 & 403', async () => {
  const originalPost = axios.post;

  try {
    // Test 401
    axios.post = async () => {
      const err = new Error('Unauthorized');
      err.response = {
        status: 401,
        data: { error: 'Token expired or invalid' },
      };
      throw err;
    };

    let status401 = 200;
    let data401 = null;
    const res401 = {
      status(code) {
        status401 = code;
        return this;
      },
      json(data) {
        data401 = data;
        return this;
      },
    };
    await handleChat({ body: { message: 'Xin chào' }, headers: { authorization: 'Bearer expired' } }, res401);
    assert.equal(status401, 401);
    assert.equal(data401.error, 'Token expired or invalid');

    // Test 403
    axios.post = async () => {
      const err = new Error('Forbidden');
      err.response = {
        status: 403,
        data: { error: 'Bạn chỉ được tra cứu thông tin trong phòng ban của mình' },
      };
      throw err;
    };

    let status403 = 200;
    let data403 = null;
    const res403 = {
      status(code) {
        status403 = code;
        return this;
      },
      json(data) {
        data403 = data;
        return this;
      },
    };
    await handleChat({ body: { message: 'Xem bảng lương' }, headers: { authorization: 'Bearer emp' } }, res403);
    assert.equal(status403, 403);
    assert.equal(data403.error, 'Bạn chỉ được tra cứu thông tin trong phòng ban của mình');
  } finally {
    axios.post = originalPost;
  }
});

test('chatController error handling: honestly handles Central timeout (30s) and offline connection errors', async () => {
  const originalPost = axios.post;

  try {
    // ECONNABORTED (timeout)
    axios.post = async () => {
      const err = new Error('timeout of 30000ms exceeded');
      err.code = 'ECONNABORTED';
      throw err;
    };

    let status504 = 200;
    let data504 = null;
    const res504 = {
      status(code) {
        status504 = code;
        return this;
      },
      json(data) {
        data504 = data;
        return this;
      },
    };
    await handleChat({ body: { message: 'Ai vắng mặt' }, headers: { authorization: 'Bearer token' } }, res504);
    assert.equal(status504, 504);
    assert.ok(data504.error.includes('quá hạn'));

    // ECONNREFUSED (offline)
    axios.post = async () => {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:4000');
      err.code = 'ECONNREFUSED';
      throw err;
    };

    let status503 = 200;
    let data503 = null;
    const res503 = {
      status(code) {
        status503 = code;
        return this;
      },
      json(data) {
        data503 = data;
        return this;
      },
    };
    await handleChat({ body: { message: 'Ai vắng mặt' }, headers: { authorization: 'Bearer token' } }, res503);
    assert.equal(status503, 503);
    assert.ok(data503.error.includes('Không thể kết nối'));
  } finally {
    axios.post = originalPost;
  }
});

test('actual Express chat route: rejects missing, malformed, or expired/invalid JWT without upstream calls', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/chat', chatRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const originalPost = axios.post;
  let upstreamCalled = false;
  axios.post = async () => {
    upstreamCalled = true;
    return { data: { answer: 'ok' } };
  };

  try {
    // 1. Missing Authorization header
    const resNoAuth = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Xin chào' }),
    });
    const dataNoAuth = await resNoAuth.json();
    assert.equal(resNoAuth.status, 401);
    assert.ok(dataNoAuth.error.includes('Bearer token'));
    assert.equal(upstreamCalled, false);

    // 2. Non-Bearer header
    const resBasic = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic dXNlcjpwYXNz',
      },
      body: JSON.stringify({ message: 'Xin chào' }),
    });
    const dataBasic = await resBasic.json();
    assert.equal(resBasic.status, 401);
    assert.ok(dataBasic.error.includes('Bearer token'));
    assert.equal(upstreamCalled, false);

    // 3. Invalid / malformed JWT
    const resInvalidJwt = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer not-a-valid-jwt-token',
      },
      body: JSON.stringify({ message: 'Xin chào' }),
    });
    const dataInvalidJwt = await resInvalidJwt.json();
    assert.equal(resInvalidJwt.status, 401);
    assert.ok(dataInvalidJwt.error.includes('hết hạn hoặc token không hợp lệ'));
    assert.equal(upstreamCalled, false);

    // 4. Correctly signed but expired JWT (expiresIn: -1)
    const previousSecret = process.env.JWT_SECRET;
    try {
      process.env.JWT_SECRET = 'isolated-chat-route-test-secret-at-least-32-chars';
      const expiredToken = jwt.sign(
        { employeeId: '60d5ecb8b5c0c82d8c8e1111', role: 'employee' },
        getJwtSecret(),
        { expiresIn: -1 }
      );
      const resExpiredJwt = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expiredToken}`,
        },
        body: JSON.stringify({ message: 'Xin chào' }),
      });
      const dataExpiredJwt = await resExpiredJwt.json();
      assert.equal(resExpiredJwt.status, 401);
      assert.ok(dataExpiredJwt.error.includes('hết hạn hoặc token không hợp lệ'));
      assert.equal(upstreamCalled, false);
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  } finally {
    axios.post = originalPost;
    await new Promise((resolve) => server.close(resolve));
  }
});
