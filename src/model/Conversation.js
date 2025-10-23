const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    librarian_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    lastMessages: { type: String, required: true },
    lastMessagesTime: Date,
  },
  { timestamps: true }
);
const Conversation = mongoose.model("conversations", conversationSchema);
module.exports = Conversation;
