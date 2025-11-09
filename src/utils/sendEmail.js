// Import the Nodemailer library
const nodemailer = require("nodemailer");
module.exports.sendmail = (email, subject, htmlContent) => {
  // Create a transporter object
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // <- Bỏ kiểm tra chứng chỉ tự ký
    },
  });
  console.log(process.env.EMAIL_USER);
  console.log(process.env.EMAIL_PASSWORD);
  // Configure the mailoptions object
  const mailOptions = {
    from: "daoson090103@gmail.com",
    to: email,
    subject: subject,
    html: htmlContent,
  };

  // Send the email
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log("Error:", error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};
