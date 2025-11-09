const mongoose = require("mongoose");
const forgotSchema = new mongoose.Schema(
  {
    email: String,
    otp: String,
    expireAt: {
      type: Date,
      expires: 180, 
    },
  },
  {
    timestamps: true,
  }
);
const forgot = mongoose.model("forgots", forgotSchema);
module.exports = forgot;
