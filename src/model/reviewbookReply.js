const mongoose = require("mongoose");

const reviewbookReplySchema = new mongoose.Schema(
  {
    review_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "reviewbooks",
      required: true,
    }, // 🔹 Liên kết đến review gốc
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    text: { type: String, required: true },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ReviewBookReply = mongoose.model(
  "reviewbookreplys",
  reviewbookReplySchema
);
module.exports = ReviewBookReply;
