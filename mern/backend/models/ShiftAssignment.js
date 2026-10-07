import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', required: true },
    workDate: { type: Date, required: true },
    isDayOff: { type: Boolean, default: false },
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ userId: 1, workDate: 1 }, { unique: true });
schema.index({ workDate: 1, departmentId: 1 });

export const ShiftAssignment = mongoose.models.ShiftAssignment || mongoose.model('ShiftAssignment', schema);
export default ShiftAssignment;
