// backend/models/Project.js
const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
  appId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Project', ProjectSchema);
