const mongoose = require("mongoose");
const reviewbookSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    book_id: { type: mongoose.Schema.Types.ObjectId, ref: "books" },
    text: String,
    rating: { type: Number, required: true },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ReviewBook = mongoose.model("reviewbooks", reviewbookSchema);
module.exports = ReviewBook;
