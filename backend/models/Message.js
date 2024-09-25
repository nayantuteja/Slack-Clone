import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  text: { type: String, required: true },
  sender: { type: String, required: true },
  chatId: { type: String, required: true },
  receiver: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Message', messageSchema);
