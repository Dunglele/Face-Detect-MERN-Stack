import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Unrecognized'],
      default: 'Present',
    },
    confidence: {
      type: Number, // percentage match, e.g., 94.5
      default: 100,
    },
    checkInType: {
      type: String,
      enum: ['Check-in', 'Check-out'],
      default: 'Check-in',
    },
    snapshotUrl: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const Attendance = mongoose.model('Attendance', attendanceSchema);
