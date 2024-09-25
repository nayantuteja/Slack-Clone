// models.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    username: String,
    userType: { type: String, enum: ['employer', 'sub-employee'] },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    socketId: String,
});

const groupSchema = new mongoose.Schema({
    name: String,
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const messageSchema = new mongoose.Schema({
    text: String,
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    chatId: String,
    createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const Group = mongoose.model('Group', groupSchema);
const Message = mongoose.model('Message', messageSchema);

export { User, Group, Message };
