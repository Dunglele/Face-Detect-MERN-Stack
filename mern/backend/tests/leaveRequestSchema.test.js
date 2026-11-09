import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import LeaveRequest from '../models/LeaveRequest.js';
import User from '../models/User.js';
import { getMyLeaveRequests } from '../controllers/employeeController.js';

test('LeaveRequest accepts ordinary requests without a chatbot key and defines the shared sparse unique index', () => {
  const request = new LeaveRequest({
    userId: new mongoose.Types.ObjectId(),
    departmentId: new mongoose.Types.ObjectId(),
    fromDate: new Date('2026-11-10T00:00:00Z'),
    toDate: new Date('2026-11-10T00:00:00Z'),
    numDays: 1,
    reasonText: 'Personal leave',
  });

  assert.equal(request.validateSync(), undefined);
  assert.equal(request.chatbotRequestKey, undefined);
  assert.equal(Object.hasOwn(request.toObject(), 'chatbotRequestKey'), false);

  request.chatbotRequestKey = 'chatbot-request-123';
  assert.equal(request.validateSync(), undefined);
  assert.equal(request.chatbotRequestKey, 'chatbot-request-123');
  assert.ok(LeaveRequest.schema.indexes().some(([fields, options]) =>
    fields.chatbotRequestKey === 1 && options.unique === true && options.sparse === true
  ));
});

test('employee leave list does not expose the internal chatbot request key', async () => {
  const originalFind = LeaveRequest.find;
  const originalFindById = User.findById;
  const userId = new mongoose.Types.ObjectId();
  const leave = {
    _id: new mongoose.Types.ObjectId(),
    type: 'annual',
    fromDate: new Date('2026-11-10T00:00:00Z'),
    toDate: new Date('2026-11-10T00:00:00Z'),
    numDays: 1,
    reasonText: 'Personal leave',
    status: 'pending',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    decidedBy: null,
    decisionNote: null,
    decidedAt: null,
    chatbotRequestKey: 'internal-key',
  };

  try {
    LeaveRequest.find = () => ({
      populate() { return this; },
      sort: async () => [leave],
    });
    User.findById = () => ({ select: async () => ({ leave: { quota: 12, used: 0, remaining: 12 } }) });

    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };
    await getMyLeaveRequests({ user: { _id: userId } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.data.length, 1);
    assert.equal(Object.hasOwn(res.payload.data[0], 'chatbotRequestKey'), false);
  } finally {
    LeaveRequest.find = originalFind;
    User.findById = originalFindById;
  }
});
