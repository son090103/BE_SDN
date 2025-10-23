const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    content: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Message = mongoose.model("messages", messageSchema);
module.exports = Message;
