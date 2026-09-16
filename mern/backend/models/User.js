import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    department: {
      type: String,
      default: 'General',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    isFaceEnrolled: {
      type: Boolean,
      default: false,
    },
    faceSampleCount: {
      type: Number,
      default: 0,
    },
    faceDescriptors: {
      type: [[Number]],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: false, // Cho phép đọc/ghi mọi cấu trúc document trong collection test/user
  }
);

// Ràng buộc tường minh collection 'user' trong database 'test'
export const User = mongoose.model('User', userSchema, 'user');
