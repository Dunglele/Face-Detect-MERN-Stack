import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    searchName: { type: String, required: true, index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Department = mongoose.models.Department || mongoose.model('Department', schema);
export default Department;
