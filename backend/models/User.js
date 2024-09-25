import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  userType: { type: String, enum: ['employer', 'sub-employee'], required: true },
  parentId: { type: String },
});

export default mongoose.model('User', userSchema);
