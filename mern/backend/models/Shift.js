import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    breakMinutes: { type: Number, default: 60 },
    graceMinutes: { type: Number, default: 5 },
    earlyLeaveThresholdMin: { type: Number, default: 15 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Shift = mongoose.models.Shift || mongoose.model('Shift', schema);
export default Shift;
