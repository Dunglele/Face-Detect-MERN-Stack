import mongoose from 'mongoose';

const nluSchema = new mongoose.Schema(
  {
    intent: String,
    intentConfidence: Number,
    extractedFrom: String,
    extractedTo: String,
    reasonCategory: { type: String, enum: ['sick', 'family', 'personal', 'other'], default: null },
    suggestion: { type: String, enum: ['approve', 'reject', 'needs_review'], default: 'needs_review' },
    modelVersion: String,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },

    type: { type: String, enum: ['annual', 'sick', 'unpaid', 'remote'], default: 'annual' },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    numDays: { type: Number, required: true },
    reasonText: { type: String, required: true },

    nlu: { type: nluSchema, default: () => ({}) },

    status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending', index: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null },
  },
  { timestamps: true }
);

schema.index({ userId: 1, fromDate: 1 });
schema.index({ status: 1, fromDate: 1 });

export const LeaveRequest = mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', schema);
export default LeaveRequest;
