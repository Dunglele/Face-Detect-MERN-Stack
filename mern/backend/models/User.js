import mongoose from 'mongoose';

const faceSchema = new mongoose.Schema(
  {
    enrolled: { type: Boolean, default: false },
    embedding: { type: [Number], default: undefined },
    sampleCount: { type: Number, default: 0 },
    modelVersion: { type: String, default: null },
    enrolledAt: { type: Date, default: null },
  },
  { _id: false }
);

const leaveSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    quota: { type: Number, default: 12 },
    used: { type: Number, default: 0 },
    remaining: { type: Number, default: 12 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    searchName: { type: String, required: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'manager', 'employee'], default: 'employee', index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    position: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
    face: { type: faceSchema, default: () => ({}) },
    leave: { type: leaveSchema, default: () => ({ year: new Date().getFullYear() }) },
  },
  { timestamps: true }
);

userSchema.index({ departmentId: 1, status: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
