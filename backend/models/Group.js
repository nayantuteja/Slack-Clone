import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  members: [{ type: String }],
  parentId: { type: String },
});

export default mongoose.model('Group', groupSchema);
