// backend/controllers/messageController.js

import Message from '../models/Message.js';

export const getMessages = async (req, res) => {
  try {
    const { appId } = req.query;
    const messages = await Message.find({ appId }).sort({ createdAt: -1 });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

export const createMessage = async (req, res) => {
  try {
    const { appId, message } = req.body;
    const newMessage = new Message({ appId, message });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ message: 'Failed to send message' });
  }
};

