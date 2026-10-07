import mongoose from 'mongoose';

const aiEvidenceSchema = new mongoose.Schema(
  {
    similarity: Number,
    threshold: Number,
    livenessScore: Number,
    detScore: Number,
    timingMs: Number,
    modelVersion: String,
    deviceId: String,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    workDate: { type: Date, required: true },

    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['on_time', 'late', 'early_leave', 'absent', 'invalid'],
      required: true,
      index: true,
    },
    lateMinutes: { type: Number, default: 0 },
    earlyLeaveMinutes: { type: Number, default: 0 },
    workedMinutes: { type: Number, default: 0 },
    method: { type: String, enum: ['face', 'manual'], default: 'manual' },

    aiEvidence: { type: aiEvidenceSchema, default: () => ({}) },
  },
  { timestamps: true }
);

schema.index({ userId: 1, workDate: 1 }, { unique: true });
schema.index({ workDate: 1, departmentId: 1 });

export const AttendanceRecord = mongoose.models.AttendanceRecord || mongoose.model('AttendanceRecord', schema);
export default AttendanceRecord;
