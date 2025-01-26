const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    match: /@nitc\.ac\.in$/,
  },
  name: { type: String, required: true },
  profilePic: { type: String }, // Optional: URL of the student's profile picture
  keywords: { type: [String], default: [] }, // List of keywords for pairing
  reports: {
    count: { type: Number, default: 0 }, // Number of reports against this user
    lastReported: { type: Date }, // Date of the last report
    banLevel: { type: Number, default: 0 }, // 0: no ban, 1: 5 min, 2: 1 hour, etc.
    banExpires: { type: Date }, // When the ban expires
  },
  savedMeetings: [{ type: String }], // List of file paths or video URLs for saved meetings
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

module.exports = User;
