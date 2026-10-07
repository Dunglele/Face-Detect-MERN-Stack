import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    deadline: { type: Date, required: true },
    weight: { type: Number, default: 1 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    evaluatorNote: { type: String, default: null },
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active', index: true },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
);

export const KpiTask = mongoose.models.KpiTask || mongoose.model('KpiTask', schema);
export default KpiTask;
