const Product = require("../../model/Book");
const Category = require("../../model/Category");
const bcrypt = require("bcrypt");
var jwt = require("jsonwebtoken");
const user = require("./../../model/User");
const Book = require("../../model/Book");
const UserBook = require("../../model/User_book");
const Author = require("../../model/Author");
const TimeSlot = require("./../../model/TimeBook");
const { response } = require("express");
const Table = require("../../model/Table");
const User_table = require("../../model/User_table");
const FaouriteBook = require("../../model/FaouriteBook");
const cloudinary = require("../../config/cloudinary");
const Message = require("../../model/Messages");
const Conversation = require("../../model/Conversation");
// lưu ý payload có thể là algorithm (default: HS256) hoặc expiresInMinutes
module.exports.login = async (req, res) => {
  console.log("chạy vào login của user");
  const { email, password } = req.body;
  console.log("email , password ", email, password);
  const response = {};
  if (!email || !password) {
    Object.assign(response, {
      status: 404,
      message: "Not Found",
    });
  } else {
    try {
      const users = await user.findOne({
        email: email,
        status: "active",
      });
      if (!users) {
        console.log("không tồn tại user");
        Object.assign(response, {
          status: 404,
          message: "Not Found",
        });
        res.status(response.status).json({ response });
      }
      const result = bcrypt.compareSync(password, users.password);
      if (!result) {
        Object.assign(response, {
          status: 404,
          message: "Not Found",
        });
      } else {
        console.log(
          "thời gian sống của acctoken là : ",
          process.env.JWT_EXPRIRE
        );
        const accesstoken = jwt.sign(
          { userId: users.id, roleId: users.role_id },
          process.env.JWT_SECRET,
          {
            expiresIn: process.env.JWT_EXPRIRE,
          }
        );
        const refresh_token = jwt.sign(
          { random: new Date().getTime + Math.random() },
          process.env.JWT_SECRET,
          {
            expiresIn: process.env.JWT_REFRESH_JWT_EXPRIRE,
          }
        );
        await user.updateOne(
          { _id: users.id },
          {
            refresh_token: refresh_token,
          }
        );
        Object.assign(response, {
          status: 200,
          message: "Success",
          access_Token: accesstoken,
          refresh_token: refresh_token,
        });
      }
    } catch (e) {
      console.log("lỗi trong chương trình trên là : ", e);
      Object.assign(response, {
        status: 400,
        message: "Bad request",
      });
    }
  }
  res.status(response.status).json({ response });
};
//đăng ký
module.exports.register = async (req, res) => {
  console.log("chạy vào register");
  try {
    var { fullname, email, password, phone, role_id } = req.body;
    const existingUser = await user.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    password = bcrypt.hashSync(password, 10);
    if (!req.body.avatar) {
      var avatar = (req.body.avatar =
        "https://res.cloudinary.com/dmdogr8na/image/upload/v1746949468/hnrnjeaoymnbudrzs7v9.jpg");
    }
    const newUser = new user({
      fullname,
      email,
      password,
      phone,
      role_id: role_id || null,
      avatar,
    });
    console.log("đăng ký thành công");
    await newUser.save();
    return res.status(201).json({
      message: "User registered successfully",
      user: newUser,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
// Hàm Search và Filter Book theo category
module.exports.findAndFilterProductPaginated = async (req, res) => {
  try {
    const { categoryTitle = "", keyword = "", page = 1 } = req.query;
    const pageSize = 10;
    const skip = (page - 1) * pageSize; // ==> Bỏ qua sản phẩm để phân trang,Ví dụ: page = 2, limit = 5 → skip = 5
    // → bỏ 5 sản phẩm đầu, lấy sản phẩm từ thứ 6 trở đi.
    // Hàm lấy tất cả Product
    const allProductsQuery = { status: "active" };
    let allProducts = await Product.find(allProductsQuery).populate(
      "categori_id",
      "title"
    );
    //Hàm search product theo keyword
    const query = {
      title: { $regex: keyword, $options: "i" },
      status: "active",
    };
    allProducts = await Product.find(query).populate("authors");

    if (categoryTitle) {
      const categoryQuery = { title: categoryTitle };
      const category = await Category.findOne(categoryQuery);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      allProducts = allProducts.filter(
        (
          p // ==> Sau sửa lại
        ) =>
          p.categori_id.some((cat) => String(cat._id) === String(category._id))
      );
    }
    const paginatedProducts = allProducts.slice(skip, skip + pageSize);
    const totalItems = allProducts.length;
    const totalPages = Math.ceil(totalItems / pageSize); // Tính tổng số page dựa trên sản phẩm đã tính
    res.json({
      page: page, //trang hiện tại
      pageSize, // số sản phẩm/trang
      totalItems, // tổng sản phẩm
      totalPages, // tổng page
      data: paginatedProducts, // danh sách sản phẩm phân trang
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// mượn sách
const { v4: uuidv4 } = require("uuid");
let crypto = require("crypto");
const moment = require("moment");
const os = require("os");
const { sendToUser } = require("../../config/websocket");
// module.exports.borrowBookFunction = async (req, res) => {
//   console.log("📚 Chạy vào borrowBookFunction");

//   try {
//     // 🧩 1. Lấy dữ liệu từ request
//     const { bookId, quantityInput, slug } = req.body;
//     console.log("dữ liệu về là : ", bookId, quantityInput, slug);
//     const book = await Book.findById(bookId);
//     const userId = res.locals.user?.id;

//     if (!book) {
//       return res.status(404).json({ message: "❌ Không tìm thấy sách." });
//     }
//     if (book.quantity <= 0) {
//       return res.status(400).json({ message: "❌ Sách này đã hết hàng." });
//     }
//     if (book.quantity < quantityInput) {
//       return res.status(400).json({
//         message: `⚠️ Chỉ còn ${book.quantity} cuốn trong kho, không thể mượn ${quantityInput} cuốn.`,
//       });
//     }
//     if (!userId) {
//       return res
//         .status(400)
//         .json({ message: "Thiếu user_id (token không hợp lệ)." });
//     }
//     let amount = 0;
//     // 🧩 2. Tính tổng tiền
//     amount = Number(book.price) * Number(quantityInput);
//     console.log("💰 amount:", amount, "| kiểu:", typeof amount);

//     let date = new Date();
//     let createDate = moment(date).format("YYYYMMDDHHmmss");
//     function getLocalIpAddress() {
//       const interfaces = os.networkInterfaces();

//       for (const name of Object.keys(interfaces)) {
//         for (const iface of interfaces[name]) {
//           // Bỏ qua địa chỉ nội bộ (127.0.0.1) và địa chỉ IPv6
//           if (iface.family === "IPv4" && !iface.internal) {
//             return iface.address;
//           }
//         }
//       }

//       return "127.0.0.1"; // fallback nếu không có IP nào phù hợp
//     }

//     const clientIp = getLocalIpAddress();
//     let locale = req.body.language;
//     if (locale === null || locale === "") {
//       locale = "vn";
//     }
//     // console.log("locale: ", locale);
//     // console.log("process.env.VNP_HASH_SECRET: ", process.env.VNP_HASH_SECRET);
//     const txnRef = uuidv4();
//     const returnUrl = `${process.env.VNP_RETURNURL}/${req.body.slug || ""}`;
//     let currCode = "VND";
//     let vnp_Params = {};
//     vnp_Params["vnp_Version"] = "2.1.0";
//     vnp_Params["vnp_Command"] = "pay";
//     vnp_Params["vnp_TmnCode"] = process.env.VNP_TMNCODE;
//     vnp_Params["vnp_Locale"] = "vn";
//     vnp_Params["vnp_CurrCode"] = currCode;
//     vnp_Params["vnp_TxnRef"] = txnRef;
//     vnp_Params["vnp_OrderInfo"] = `${userId}`;
//     vnp_Params["vnp_OrderType"] = "other";
//     vnp_Params["vnp_Amount"] = amount * 100;
//     vnp_Params["vnp_ReturnUrl"] = encodeURIComponent(returnUrl);
//     vnp_Params["vnp_IpAddr"] = clientIp;
//     vnp_Params["vnp_CreateDate"] = createDate;
//     // Optional bankCode nếu có
//     let bankCode = req.body.bankCode;
//     if (bankCode !== null && bankCode !== "") {
//       vnp_Params["vnp_BankCode"] = bankCode;
//     }
//     let querystring = require("qs");
//     // let vnpUrl = process.env.VNP_PAYURL;
//     const sortedParams = Object.keys(vnp_Params)
//       .sort()
//       .reduce((obj, key) => {
//         obj[key] = vnp_Params[key];
//         return obj;
//       }, {});

//     // Tạo vnp_SecureHash với SHA-256
//     const signData = querystring.stringify(sortedParams, { encode: false });
//     const hmac = crypto.createHmac("sha512", process.env.VNP_HASH_SECRET);
//     const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
//     vnp_Params["vnp_SecureHash"] = signed;

//     // Tạo URL thanh toán
//     const vnpUrl =
//       process.env.VNP_PAYURL +
//       "?" +
//       querystring.stringify(vnp_Params, { encode: false });
//     console.log("signData:", signData);
//     console.log("vnp_SecureHash:", vnp_Params["vnp_SecureHash"]);
//     console.log("vnp_Params:", vnp_Params);
//     console.log("vnpUrl:", vnpUrl);
//     // 🧩 9. Lưu thông tin mượn sách
//     const userBook = new UserBook({
//       user_id: res.locals.user._id,
//       book_id: bookId,
//       quantity: quantityInput,
//       borrow_date: new Date(),
//       book_detail: {
//         price: amount,
//         date: new Date(),
//         transaction_type: "Booking_book",
//       },
//     });
//     await userBook.save();

//     // Giảm số lượng trong kho
//     book.quantity -= Number(quantityInput);
//     await book.save();

//     // 🧩 10. Trả về URL thanh toán cho FE
//     res.status(200).json({
//       success: true,
//       message: "Tạo yêu cầu mượn sách và thanh toán thành công!",
//       url: vnpUrl,
//     });
//   } catch (err) {
//     console.error("🚨 Lỗi trong borrowBookFunction:", err);
//     res.status(500).json({ message: err.message });
//   }
// };
//
// mượn sách check
module.exports.borrowBookFunction = async (req, res) => {
  console.log("📚 Chạy vào borrowBookFunction");
  try {
    // 🧩 1. Lấy dữ liệu từ request
    const { bookId, quantityInput, slug } = req.body;
    console.log("dữ liệu về là : ", bookId, quantityInput, slug);
    const book = await Book.findById(bookId);

    const userId = res.locals.user?.id;
    if (!book) {
      return res.status(404).json({ message: "❌ Không tìm thấy sách." });
    }
    if (book.quantity <= 0) {
      return res.status(400).json({ message: "❌ Sách này đã hết hàng." });
    }
    if (book.quantity < quantityInput) {
      return res.status(400).json({
        message: `⚠️ Chỉ còn ${book.quantity} cuốn trong kho, không thể mượn ${quantityInput} cuốn.`,
      });
    }
    if (!userId) {
      return res
        .status(400)
        .json({ message: "Thiếu user_id (token không hợp lệ)." });
    }
    const orderPayload = {
      userId,
      bookId,
      quantity: quantityInput,
      slug,
    };
    const orderInfo = Buffer.from(JSON.stringify(orderPayload), "utf8")
      .toString("base64")
      .replace(/\+/g, "-") // URL-safe
      .replace(/\//g, "_") // URL-safe
      .replace(/=+$/, ""); // bỏ padding

    let amount = 0;
    // 🧩 2. Tính tổng tiền
    amount = Number(book.price) * Number(quantityInput);
    console.log("💰 amount:", amount, "| kiểu:", typeof amount);
    let date = new Date();
    let createDate = moment(date).format("YYYYMMDDHHmmss");
    function getLocalIpAddress() {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          // Bỏ qua địa chỉ nội bộ (127.0.0.1) và địa chỉ IPv6
          if (iface.family === "IPv4" && !iface.internal) {
            return iface.address;
          }
        }
      }
      return "127.0.0.1"; // fallback nếu không có IP nào phù hợp
    }
    const clientIp = getLocalIpAddress();
    let locale = req.body.language;
    if (locale === null || locale === "") {
      locale = "vn";
    }
    // console.log("locale: ", locale);
    // console.log("process.env.VNP_HASH_SECRET: ", process.env.VNP_HASH_SECRET);
    const txnRef = uuidv4();
    // const returnUrl = `${process.env.VNP_RETURNURL}/${req.body.slug || ""}`;
    const returnUrl = `${process.env.RETURNURL}`;
    let currCode = "VND";
    let vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = process.env.VNP_TMNCODE;
    vnp_Params["vnp_Locale"] = "vn";
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = txnRef;
    vnp_Params["vnp_OrderInfo"] = `${orderInfo}`;
    vnp_Params["vnp_OrderType"] = "other";
    vnp_Params["vnp_Amount"] = amount * 100;
    vnp_Params["vnp_ReturnUrl"] = encodeURIComponent(returnUrl);
    vnp_Params["vnp_IpAddr"] = clientIp;
    vnp_Params["vnp_CreateDate"] = createDate;
    // Optional bankCode nếu có
    let bankCode = req.body.bankCode;
    if (bankCode !== null && bankCode !== "") {
      vnp_Params["vnp_BankCode"] = bankCode;
    }
    let querystring = require("qs");
    // let vnpUrl = process.env.VNP_PAYURL;
    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});
    // Tạo vnp_SecureHash với SHA-256
    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac("sha512", process.env.VNP_HASH_SECRET);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
    vnp_Params["vnp_SecureHash"] = signed;
    // Tạo URL thanh toán
    const vnpUrl =
      process.env.VNP_PAYURL +
      "?" +
      querystring.stringify(vnp_Params, { encode: false });
    return res.status(200).json({
      success: true,
      message: "Tạo URL thanh toán thành công!",
      url: vnpUrl,
      slug: slug,
      bookId,
      quantityInput,
    });
  } catch (err) {
    console.error("🚨 Lỗi trong borrowBookFunction:", err);
    res.status(500).json({ message: err.message });
  }
};
module.exports.vnpayborrowBookFunction = async (req, res) => {
  console.log("chạy vào trả lại vnpay");
  try {
    console.log("body ;là :", req.body);
    console.log("🏦 Callback VNPay:", req.query);
    const vnp_Params = { ...req.query };
    let decodedInfo = {};
    try {
      const rawOrderInfo = vnp_Params.vnp_OrderInfo || "";

      // decode base64 (nếu bạn encode theo chuẩn Base64)
      const jsonStr = Buffer.from(rawOrderInfo, "base64").toString("utf8");

      // parse sang object
      decodedInfo = JSON.parse(jsonStr);
    } catch (err) {
      console.error("❌ Không thể decode vnp_OrderInfo:", err);
    }

    // Destructure từ object sau khi decode
    const { slug, bookId, quantity: quantityInput, userId } = decodedInfo || {};
    console.log("📦 Dữ liệu giải mã từ vnp_OrderInfo:", {
      userId,
      bookId,
      quantityInput,
      slug,
    });
    const secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});
    let qs = require("qs");
    const signData = qs.stringify(sortedParams, { encode: false });
    const signed = crypto
      .createHmac("sha512", process.env.VNP_HASH_SECRET)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    if (secureHash !== signed) {
      return res.status(400).json({ message: "❌ Sai chữ ký VNPay" });
    }

    // ✅ Chỉ xử lý khi thanh toán thành công
    if (vnp_Params["vnp_ResponseCode"] === "00") {
      // ❌ Đừng làm thế này nữa
      // const [userId] = vnp_Params["vnp_OrderInfo"];

      // ✅ Dùng userId đã decode từ base64 JSON ở trên
      const { userId, bookId, quantity: quantityInput, slug } = decodedInfo;

      const amount = Number(vnp_Params["vnp_Amount"]) / 100;
      const quantity = quantityInput;

      const book = await Book.findById(bookId);
      if (!book) {
        return res.status(404).json({ message: "Không tìm thấy sách." });
      }

      if (book.quantity < quantity) {
        return res.status(400).json({ message: "Sách không đủ số lượng." });
      }

      // 🧩 Lưu vào DB
      const userBook = new UserBook({
        user_id: userId, // ✅ đúng giá trị ObjectId
        book_id: bookId,
        quantity: quantity,
        borrow_date: new Date(),
        book_detail: {
          price: amount,
          date: new Date(),
          transaction_type: "Booking_book",
          txnRef: vnp_Params["vnp_TxnRef"],
        },
      });
      await userBook.save();

      // 🧩 Trừ số lượng sách
      book.quantity -= Number(quantity);
      await book.save();

      console.log("✅ Thanh toán thành công cho user:", userId);

      // tạo url
      const returnUrl = `${process.env.VNP_RETURNURL}/${slug || ""}`;
      return res.redirect(
        `${returnUrl}?status=success&txnRef=${vnp_Params["vnp_TxnRef"]}`
      );
    } else {
      return res.redirect(
        `${process.env.FRONTEND_FAIL_PAGE}?status=fail&code=${vnp_Params["vnp_ResponseCode"]}`
      );
    }
  } catch (err) {
    console.error("🚨 Lỗi VNPay callback:", err);
    res.status(500).json({ message: err.message });
  }
};
// lấy ra loại sách
module.exports.getcategory = async (req, res) => {
  const response = {};
  try {
    const Categorys = await Category.find({ status: "active" });
    Object.assign(response, {
      status: 200,
      message: "Successfully",
      data: Categorys,
    });
  } catch (err) {
    console.log("lỗi trong chương trình là: ", err);
    Object.assign(response, {
      status: 500,
      message: "Serrver error",
    });
  }
  return res.status(response.status).json(response);
};

module.exports.getNewBook = async (req, res) => {
  const response = {};
  try {
    const Books = await Book.find({ status: "active" })
      .sort({ createAt: -1 })
      .limit(6);
    Object.assign(response, {
      status: 200,
      message: "successfull",
      data: Books,
    });
  } catch (err) {
    console.log("lỗi trong chương trình trên là : ", err);
    Object.assign(response, {
      status: 500,
      message: "Serror error",
    });
  }
  return res.status(response.status).json(response);
};
// lấy ra tác giả
module.exports.getauthor = async (req, res) => {
  const response = {};
  try {
    const Authors = await Author.find({ status: "active" });
    Object.assign(response, {
      status: 200,
      message: "success",
      data: Authors,
    });
  } catch (err) {
    console.log("lỗi trong chương trình trên là : ", err);
    Object.assign(response, {
      status: 500,
      message: "Server error",
    });
  }
  return res.status(response.status).json(response);
};
// lấy ra profile
module.exports.getUser = async (req, res) => {
  console.log("đang vào profile");
  const response = {
    status: 200,
    message: "Success",
    data: res.locals.user,
  };
  res.status(response.status).json(response);
};
// lấy ra giờ đặt bàn
module.exports.getslotTime = async (req, res) => {
  const response = {};
  try {
    const timeslot = await TimeSlot.find();
    Object.assign(response, {
      status: 200,
      message: "success",
      data: timeslot,
    });
  } catch (err) {
    console.log("lỗi trong chương trình là : ", err);
    Object.assign(response, {
      status: 500,
      message: "success",
    });
  }
  return res.status(response.status).json(response);
};
// lấy ra bàn
module.exports.getTables = async (req, res) => {
  const response = {};
  try {
    const tables = await Table.find({ status: "active", deleted: false });
    if (!tables) {
      Object.assign(response, {
        status: 404,
        message: "Not Found",
      });
    }
    Object.assign(response, {
      status: 200,
      message: "Success",
      data: tables,
    });
  } catch (err) {
    console.log("lỗi trong chương trên là : ", err);
    Object.assign(response, {
      status: 500,
      message: "Serrver error",
    });
  }
  return res.status(response.status).json(response);
};
// lấy ra người dùng danh sách bàn
module.exports.getUserTable = async (req, res) => {
  console.log("đang vào useTable");
  try {
    const { time_date, table_id } = req.body; // "2025-10-01"
    console.log("time_date là:", time_date);
    console.log("table _id là : ", table_id);

    if (!time_date || !table_id) {
      return res.status(400).json({ status: 404, message: "Not Found" });
    }

    // Parse "YYYY-MM-DD" an toàn
    const [year, month, day] = time_date.split("-").map(Number);

    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const query = {
      status: "active",
      table_id: table_id,
      time_date: { $gte: start, $lt: end },
    };

    console.log("query là:", query);

    const userTable = await User_table.find(query).populate({
      path: "user_id",
      select: "-password",
    });

    return res.status(200).json({
      status: 200,
      message: "success",
      data: userTable,
    });
  } catch (err) {
    console.error("Lỗi trong chương trình:", err);

    // response lỗi
    return res.status(500).json({
      status: 500,
      message: "error",
      error: err.message,
    });
  }
};

// đặt bàn
// module.exports.postUserTable = async (req, res) => {
//   const { table_id, time_date, slot_time } = req.body;
//   console.log("req.body là : ", table_id, time_date, slot_time);

//   const [year, month, day] = time_date.split("-").map(Number);

//   const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
//   const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

//   let userTable = await User_table.findOne({
//     user_id: res.locals.user.id,
//     table_id: table_id,
//     time_date: { $gte: start, $lt: end },
//   });
//   console.log("user là : ", res.locals._id);
//   if (!userTable) {
//     userTable = new User_table({
//       user_id: res.locals.user._id,
//       table_id,
//       time_slot: Array.isArray(slot_time) ? slot_time : [slot_time],
//       time_date: start,
//       status: "active",
//     });
//     await userTable.save();
//     console.log("✅ Tạo mới lịch:", userTable);
//   } else {
//     const newSlots = Array.isArray(slot_time) ? slot_time : [slot_time];
//     userTable.time_slot = Array.from(
//       new Set([...userTable.time_slot, ...newSlots])
//     );
//     await userTable.save();
//     console.log("✅ Cập nhật slot_time:", userTable);
//   }
//   const query = {
//     status: "active",
//     table_id: table_id,
//     time_date: { $gte: start, $lt: end },
//   };

//   const newuserTable = await User_table.find(query).populate({
//     path: "user_id",
//     select: "-password",
//   });
//   return res.status(200).json({
//     status: 200,
//     message: "success",
//     data: newuserTable,
//   });
// };
module.exports.postUserTable = async (req, res) => {
  console.log("Chạy vào postUserTableVNPay");
  try {
    const { table_id, time_date, slot_time, language, bankCode } = req.body;
    const userId = res.locals.user?._id;

    if (!userId)
      return res
        .status(400)
        .json({ message: "Thiếu user_id (token không hợp lệ)." });
    if (!table_id || !time_date || !slot_time)
      return res.status(400).json({ message: "Thiếu tham số đầu vào." });

    const table = await Table.findById(table_id);
    if (!table) return res.status(404).json({ message: "Không tìm thấy bàn." });

    const pricePerSlot = Number(table.price);
    const quantity = Array.isArray(slot_time) ? slot_time.length : 1;
    const amount = pricePerSlot * quantity;

    const orderPayload = { userId, table_id, time_date, slot_time, quantity };
    const orderInfo = Buffer.from(JSON.stringify(orderPayload), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const txnRef = uuidv4();
    const createDate = moment(new Date()).format("YYYYMMDDHHmmss");

    function getLocalIpAddress() {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
          if (iface.family === "IPv4" && !iface.internal) return iface.address;
        }
      }
      return "127.0.0.1";
    }
    const clientIp = getLocalIpAddress();
    const locale = language || "vn";

    // QUAN TRỌNG: encodeURIComponent TRƯỚC khi đưa vào params
    // Thay đoạn này:
    const returnUrl = process.env.RETURNURLTable;

    // Thành:
    const returnUrlRaw = process.env.RETURNURLTable;
    const returnUrlEncoded = encodeURIComponent(returnUrlRaw); // encode trước

    let vnp_Params = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: process.env.VNP_TMNCODE,
      vnp_Locale: locale,
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: "other",
      vnp_Amount: amount * 100,
      vnp_ReturnUrl: returnUrlEncoded, // đã encode
      vnp_IpAddr: clientIp,
      vnp_CreateDate: createDate,
    };

    let qs = require("qs");

    const sortedParams = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});

    const signData = qs.stringify(sortedParams, { encode: false }); // không encode
    const signed = crypto
      .createHmac("sha512", process.env.VNP_HASH_SECRET)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    vnp_Params.vnp_SecureHash = signed;

    // TẠO URL: KHÔNG DÙNG { encode: true } → tránh double encode
    const vnpUrl =
      process.env.VNP_PAYURL +
      "?" +
      qs.stringify(vnp_Params, { encode: false });

    console.log("signData:", signData);
    console.log("vnpUrl:", vnpUrl);

    return res.status(200).json({
      success: true,
      message: "Tạo URL thanh toán thành công!",
      url: vnpUrl,
      table_id,
      time_date,
      slot_time,
    });
  } catch (err) {
    console.error("Lỗi trong postUserTableVNPay:", err);
    res.status(500).json({ message: err.message });
  }
};

// router return chạy đến
module.exports.vnpayUserTableCallback = async (req, res) => {
  console.log("🏦 Callback VNPay User Table:", req.query);
  try {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    // 🔒 Verify chữ ký
    const qs = require("qs");
    const signData = qs.stringify(
      Object.keys(vnp_Params)
        .sort()
        .reduce((obj, k) => ((obj[k] = vnp_Params[k]), obj), {}),
      { encode: false }
    );
    const signed = crypto
      .createHmac("sha512", process.env.VNP_HASH_SECRET)
      .update(Buffer.from(signData, "utf-8"))
      .digest("hex");

    if (secureHash !== signed) {
      return res.status(400).json({ message: "❌ Sai chữ ký VNPay" });
    }

    // ✅ Chỉ xử lý khi thanh toán thành công
    if (vnp_Params["vnp_ResponseCode"] === "00") {
      // ✅ Decode thông tin đặt bàn từ OrderInfo
      let decodedJson = "";
      try {
        decodedJson = Buffer.from(vnp_Params.vnp_OrderInfo, "base64").toString(
          "utf8"
        );
      } catch (err) {
        console.error("❌ Không thể decode vnp_OrderInfo:", err);
        return res.status(400).json({ message: "Lỗi giải mã OrderInfo" });
      }

      const { userId, table_id, time_date, slot_time } = JSON.parse(
        decodedJson || "{}"
      );

      // 🧩 Tính khoảng thời gian trong ngày
      const [year, month, day] = time_date.split("-").map(Number);
      const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
      const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      // ✅ Kiểm tra lịch cũ
      let userTable = await User_table.findOne({
        user_id: userId,
        table_id: table_id,
        time_date: { $gte: start, $lt: end },
      });

      if (!userTable) {
        userTable = new User_table({
          user_id: userId,
          table_id,
          time_slot: Array.isArray(slot_time) ? slot_time : [slot_time],
          time_date: start,
          status: "active",
          paid: true,
          payment_info: {
            txnRef: vnp_Params["vnp_TxnRef"],
            date: new Date(),
          },
        });
        await userTable.save();
        console.log("✅ Tạo mới lịch đặt bàn:", userTable);
      } else {
        const newSlots = Array.isArray(slot_time) ? slot_time : [slot_time];
        userTable.time_slot = Array.from(
          new Set([...userTable.time_slot, ...newSlots])
        );
        await userTable.save();
        console.log("✅ Cập nhật slot_time:", userTable);
      }

      // ✅ Tạo URL redirect về FE
      const returnUrl = `http://localhost:5173/bookingtable`;

      // encode query param để tránh lỗi ký tự đặc biệt
      const redirectUrl = `${returnUrl}?status=success&type=table&table=${encodeURIComponent(
        table_id
      )}&date=${encodeURIComponent(time_date)}&txnRef=${encodeURIComponent(
        vnp_Params["vnp_TxnRef"]
      )}`;

      console.log("🌐 Redirect về FE:", redirectUrl);
      return res.redirect(redirectUrl);
    } else {
      const failUrl = `http://localhost:5173/bookingtable?status=fail&code=${vnp_Params["vnp_ResponseCode"]}`;
      console.warn("❌ Thanh toán thất bại:", failUrl);
      return res.redirect(failUrl);
    }
  } catch (err) {
    console.error("🚨 Lỗi VNPay callback (UserTable):", err);
    res.status(500).json({ message: err.message });
  }
};
module.exports.updateProfile = async (req, res) => {
  try {
    const me = await user.findById(res.locals.user._id);
    if (!me) return res.status(404).json({ message: "User not found" });
    const { fullname, phone } = req.body;
    if (fullname !== undefined) me.fullname = fullname;
    if (phone !== undefined) me.phone = phone;

    // Nếu có file avatar, upload lên Cloudinary
    if (req.file && req.file.buffer) {
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "profiles" },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(req.file.buffer);
      });
      me.avatar = uploaded.secure_url;
    }

    await me.save();
    const safe = await user.findById(me._id).select("-password -refresh_token");
    return res.json({ message: "Profile updated", data: safe });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// change pass
module.exports.changePassword = async (req, res) => {
  try {
    const me = await user.findById(res.locals.user._id);
    if (!me)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: "Thiếu thông tin mật khẩu" });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Mật khẩu mới không khớp" });
    }

    const ok = bcrypt.compareSync(oldPassword, me.password);
    if (!ok) return res.status(400).json({ message: "Mật khẩu cũ không đúng" });

    me.password = bcrypt.hashSync(newPassword, 10);
    await me.save();
    return res.json({ message: "Đã cập nhật mật khẩu" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// GET fav book
module.exports.getFavouriteBooks = async (req, res) => {
  try {
    const userId = res.locals.user?._id;
    if (!userId) return res.status(401).json({ message: "Chưa được xác thực" });

    const keyword = (req.query.keyword || "").trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );
    const skip = (page - 1) * limit;

    const baseBookFilter = { status: "active", deleted: false };
    let bookIdFilter = {};
    if (keyword) {
      baseBookFilter.title = { $regex: keyword, $options: "i" };
    }
    const bookIds = await Book.find(baseBookFilter).select("_id").lean();
    if (bookIds.length === 0) {
      return res.status(200).json({
        message: "Thành công",
        keyword,
        page,
        limit,
        total: 0,
        totalPages: 0,
        count: 0,
        data: [],
      });
    }
    bookIdFilter.book_id = { $in: bookIds.map((b) => b._id) };

    const favFilter = {
      user_id: userId,
      deleted: false,
      ...bookIdFilter,
    };

    const total = await FaouriteBook.countDocuments(favFilter);

    const favourites = await FaouriteBook.find(favFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "book_id",
        match: { status: "active", deleted: false },
        select: "title image authors price quantity slug published_year",
        populate: { path: "authors", select: "name" },
      })
      .lean();

    const data = favourites
      .filter((f) => f.book_id)
      .map((f) => {
        const b = f.book_id;
        let authorsName = [];
        if (b && b.authors) {
          if (Array.isArray(b.authors)) {
            authorsName = b.authors.map((a) => a.name);
          } else {
            authorsName = b.authors.name ? [b.authors.name] : [];
          }
        }
        return {
          favouriteId: f._id,
          createdAt: f.createdAt,
          book: {
            ...b,
            authorsName,
          },
        };
      });

    return res.status(200).json({
      message: "Thành công",
      keyword,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      count: data.length,
      data,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST fav book
module.exports.addFavouriteBook = async (req, res) => {
  try {
    const userId = res.locals.user._id;
    const { bookId } = req.body;
    if (!bookId) return res.status(400).json({ message: "Thiếu bookId" });
    const { Types } = require("mongoose");
    if (!Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "bookId không hợp lệ" });
    }

    const book = await Book.findOne({
      _id: bookId,
      status: "active",
      deleted: false,
    });
    if (!book) return res.status(404).json({ message: "Không tìm thấy sách" });

    let fav = await FaouriteBook.findOne({ user_id: userId, book_id: bookId });

    if (fav && !fav.deleted) {
      return res.status(409).json({ message: "Sách đã có trong yêu thích" });
    }

    let restored = false;
    if (fav && fav.deleted) {
      fav.deleted = false;
      await fav.save();
      restored = true;
    }

    if (!fav) {
      fav = await FaouriteBook.create({ user_id: userId, book_id: bookId });
    }

    const populated = await fav.populate({
      path: "book_id",
      select: "title image authors quantity price slug published_year",
      populate: { path: "authors", select: "name" },
    });

    const b = populated.book_id;
    const authorsName = b?.authors
      ? Array.isArray(b.authors)
        ? b.authors.map((a) => a.name)
        : b.authors.name
        ? [b.authors.name]
        : []
      : [];

    return res.status(restored ? 200 : 201).json({
      message: restored
        ? "Đã khôi phục vào yêu thích"
        : "Đã thêm vào yêu thích",
      data: {
        favouriteId: fav._id,
        createdAt: fav.createdAt,
        book: {
          ...(b.toObject?.() || b),
          authorsName,
        },
      },
    });
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: "Sách đã có trong yêu thích" });
    }
    return res.status(500).json({ message: e.message });
  }
};

// DELETE fav book
module.exports.deleteFavouriteBook = async (req, res) => {
  try {
    const userId = res.locals.user._id;
    const { bookId } = req.params;
    if (!bookId)
      return res.status(400).json({ message: "Thiếu tham số bookId" });
    const { Types } = require("mongoose");
    if (!Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "bookId không hợp lệ" });
    }

    const fav = await FaouriteBook.findOne({
      user_id: userId,
      book_id: bookId,
      deleted: false,
    });
    if (!fav)
      return res
        .status(404)
        .json({ message: "Không tìm thấy trong yêu thích" });

    await FaouriteBook.deleteOne({ user_id: userId, book_id: bookId });
    return res.json({
      success: true,
      message: "Đã xóa khỏi yêu thích",
      bookId,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};
module.exports.refersh_token = async (req, res) => {
  const refresh_token = req.body.refresh_token;
  const response = {};
  if (!response) {
    Object.assign(response, {
      state: 401,
      message: "Unauthorization",
    });
  } else {
    try {
      jwt.verify(refresh_token, process.env.JWT_SECRET); // tạo ra decode
      const users = await user.findOne({ refresh_token: refresh_token });
      if (!users) {
        throw new Error("User not exist");
      }
      // tạo access token mới
      const accesstoken = jwt.sign(
        { userId: users.id }, // chỉ lưu mỗi userId
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPRIRE,
        }
      );
      Object.assign(response, {
        state: 200,
        message: "Success",
        access_Token: accesstoken,
        refresh_token: refresh_token,
      });
    } catch (e) {
      // vì cũng có trường hợp không lấy được refresh token
      Object.assign(response, {
        state: 401,
        message: "Unauthorization",
      });
    }
  }
  res.status(response.state).json(response);
};

// gửi tin nhắn
module.exports.sendMessage = async (req, res) => {
  try {
    console.log("chạy vào gửi tin nhắn ");
    const senderIdInput = res.locals.user.id;
    //const {senderIdInput} = req.body;
    const { contentInput } = req.body; // Dùng body để test trước
    const librarian = await user.findOne({
      _id: "68eb4a6c178e15c0cb07d10e",
      status: "active",
    });
    console.log("thử là : ", librarian);
    if (!librarian) {
      return res.status(404).json({ message: "Không tìm thấy thủ thư" });
    }
    const message = new Message({
      sender_id: senderIdInput,
      receiver_id: librarian._id,
      content: contentInput,
      read: false,
    });
    await message.save();
    console.log("gửi thành công");
    sendToUser(librarian._id, {
      type: "new_message",
      data: message,
    });
    console.log("tin nhắn là : ", sendToUser);
    const conversation = await Conversation.findOne({
      librarian_id: librarian._id,
      user_id: senderIdInput,
    });
    console.log("conversation là : ", conversation);
    if (!conversation) {
      const newConversation = new Conversation({
        librarian_id: librarian._id,
        user_id: senderIdInput,
        lastMessages: contentInput,
        lastMessagesTime: new Date(),
      });
      await newConversation.save();
    } else {
      conversation.lastMessages = contentInput;
      conversation.lastMessagesTime = new Date();
      await conversation.save();
    }
    res.status(200).json({ message: "Gửi tin nhắn thành công", data: message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports.getMessageHistory = async (req, res) => {
  console.log("chay vào history của người dùng");
  try {
    // const { senderIdInput } = res.locals.user.id;
    const senderIdInput = res.locals.user.id;
    const mongoose = require("mongoose");
    const librarian = await user.findOne({
      _id: new mongoose.Types.ObjectId("68eb4a6c178e15c0cb07d10e"),
      status: "active",
    });
    if (!librarian) {
      return res.status(404).json({ message: "Không tìm thấy thủ thư" });
    }
    const messages = await Message.find({
      $or: [
        { sender_id: senderIdInput, receiver_id: librarian._id },
        { sender_id: librarian._id, receiver_id: senderIdInput },
      ],
    }).sort({ createdAt: 1 });
    console.log("message là : ", messages);
    res.status(200).json({ message: "Lịch sử tin nhắn", data: messages });
  } catch (error) {}
};

module.exports.getOrderBooks = async (req, res) => {
  try {
    const userId = res.locals.user._id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );
    const skip = (page - 1) * limit;

    const filter = { user_id: userId, deleted: false, status: "active" };
    const total = await require("../../model/User_book").countDocuments(filter);

    const orders = await require("../../model/User_book")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "book_id",
        select: "title image authors price quantity slug published_year",
        populate: { path: "authors", select: "name" },
      })
      .lean();

    return res.status(200).json({
      message: "Thành công",
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: orders,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

//get order table
module.exports.getOrderTables = async (req, res) => {
  try {
    const userId = res.locals.user._id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 10, 1),
      100
    );
    const skip = (page - 1) * limit;

    const filter = { user_id: userId, deleted: false, status: "active" };
    const total = await require("../../model/User_table").countDocuments(
      filter
    );

    const orders = await require("../../model/User_table")
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "table_id",
        select: "title price status",
      })
      .populate({
        path: "time_slot",
        select: "start_time end_time",
      })
      .lean();

    return res.status(200).json({
      message: "Thành công",
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      data: orders,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
const ReviewBook = require("./../../model/Review_book");
const axios = require("axios");

const ANALYZE_URL = process.env.ANALYZE_URL;
const KEY = process.env.API_KEY;

module.exports.addReviewBook = async (req, res) => {
  console.log("➡️ Đang chạy vào thêm review (có kiểm duyệt AI)...");
  try {
    const userId = res.locals.user._id;
    const { bookId, text, rating } = req.body;

    if (!bookId || !text || typeof rating !== "number") {
      return res.status(400).json({ message: "Thiếu thông tin đánh giá" });
    }

    // 🔹 Gọi API phân tích đầy đủ (Full Mode)
    const aiResponse = await axios.post(
      ANALYZE_URL,
      {
        text,
        detail_level: "full",
        modes: ["sentiment", "toxicity", "emotion", "aspects"],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host":
            "ai-text-moderation-toxicity-aspects-sentiment-analyzer.p.rapidapi.com",
          "x-rapidapi-key": KEY,
        },
      }
    );

    const result = aiResponse.data?.data?.items?.[0];
    if (!result) throw new Error("Không nhận được phản hồi từ API.");

    const tox = result.toxicity?.overall || 0;
    const insult = result.toxicity?.dimensions?.insults_and_bullying || 0;
    console.log("kết quả result của AI là : ", result);
    // 🔹 Logic custom: nếu mức độc hại > 0.7 thì chặn
    if (tox > 0.7 || insult > 0.7) {
      return res.status(403).json({
        message: "⚠️ Bình luận bị chặn do chứa ngôn từ xúc phạm hoặc tiêu cực.",
        details: {
          toxicity_overall: tox,
          insults_and_bullying: insult,
          sentiment: result.sentiment,
          emotion: result.emotion.top,
        },
      });
    }

    // 🔹 Nếu an toàn → lưu bình luận
    const review = new ReviewBook({
      user_id: userId,
      book_id: bookId,
      text,
      rating,
    });
    await review.save();

    const populatedReview = await ReviewBook.findById(review._id).populate({
      path: "user_id",
      select: "fullname avatar _id",
    });

    return res.status(201).json({
      message: "✅ Đánh giá thành công (đã kiểm duyệt)",
      data: populatedReview,
    });
  } catch (err) {
    console.error("❌ Lỗi khi thêm review:", err.message);
    return res.status(500).json({ message: "Lỗi server: " + err.message });
  }
};

// module.exports.addReviewBook = async (req, res) => {
//   console.log("đang chạy vào thêm review ");
//   try {
//     const userId = res.locals.user._id;
//     const { bookId, text, rating } = req.body;
//     if (!bookId || !text || typeof rating !== "number") {
//       return res.status(400).json({ message: "Thiếu thông tin đánh giá" });
//     }
//     const review = new ReviewBook({
//       user_id: userId,
//       book_id: bookId,
//       text,
//       rating,
//     });
//     await review.save();
//     // Populate user info khi trả về
//     const populatedReview = await ReviewBook.findById(review._id).populate({
//       path: "user_id",
//       select: "fullname avatar _id",
//     });
//     return res
//       .status(201)
//       .json({ message: "Đánh giá thành công", data: populatedReview });
//   } catch (err) {
//     return res.status(500).json({ message: err.message });
//   }
// };

// Lấy review theo book

module.exports.getReviewBooks = async (req, res) => {
  try {
    const { bookId, page = 1, limit = 5 } = req.query;
    if (!bookId) return res.status(400).json({ message: "Thiếu bookId" });

    const skip = (Number(page) - 1) * Number(limit);
    const total = await ReviewBook.countDocuments({
      book_id: bookId,
      deleted: false,
    });
    const reviews = await ReviewBook.find({ book_id: bookId, deleted: false })
      .populate({ path: "user_id", select: "fullname avatar _id" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({
      data: reviews,
      totalPages: Math.ceil(total / Number(limit)),
      total,
      page: Number(page),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
module.exports.editReviewBook = async (req, res) => {
  try {
    const userId = res.locals.user._id;
    const { reviewId, text, rating } = req.body;
    if (!reviewId) return res.status(400).json({ message: "Thiếu reviewId" });

    const review = await ReviewBook.findOne({ _id: reviewId, deleted: false });
    if (!review)
      return res.status(404).json({ message: "Không tìm thấy review" });
    if (String(review.user_id) !== String(userId))
      return res
        .status(403)
        .json({ message: "Bạn không có quyền sửa review này" });

    if (text !== undefined) review.text = text;
    if (rating !== undefined) review.rating = rating;
    await review.save();

    return res.json({ message: "Đã sửa review", data: review });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Xóa review (xóa mềm)
module.exports.deleteReviewBook = async (req, res) => {
  console.log("chạy vào hàm xóa review");
  try {
    const userId = res.locals.user._id;
    const { reviewId } = req.params;
    if (!reviewId) return res.status(400).json({ message: "Thiếu reviewId" });

    const review = await ReviewBook.findOne({ _id: reviewId, deleted: false });
    if (!review)
      return res.status(404).json({ message: "Không tìm thấy review" });
    if (String(review.user_id) !== String(userId))
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa review này" });

    review.deleted = true;
    await review.save();

    return res.json({ message: "Đã xóa review" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
const ReviewBookReply = require("./../../model/reviewbookReply");
module.exports.postreviewReply = async (req, res) => {
  console.log("đang chạy vào post reply");
  try {
    const { text } = req.body;
    const userId = res.locals.user.id;

    const reply = new ReviewBookReply({
      review_id: req.params.reviewId,
      user_id: userId,
      text,
    });

    await reply.save();
    res.status(201).json({ message: "Thêm phản hồi thành công", data: reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
// lấy tất cả reply
module.exports.getRepliesByReview = async (req, res) => {
  console.log("chạy vào tất cả phản hồi");
  try {
    const { reviewreplyId } = req.params;
    console.log("id là : ", reviewreplyId);
    const replies = await ReviewBookReply.find({
      review_id: reviewreplyId,
      deleted: false,
    })
      .populate("user_id", "fullname avatar")
      .sort({ createdAt: 1 });

    res.json({ data: replies });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
module.exports.deleteReply = async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await ReviewBookReply.findById(id);
    if (!reply)
      return res.status(404).json({ message: "Không tìm thấy phản hồi" });

    // Nếu muốn kiểm tra quyền xóa (chỉ chủ nhân được xóa)
    if (reply.user_id.toString() !== res.locals.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền xóa phản hồi này" });
    }

    reply.deleted = true;
    await reply.save();

    res.json({ message: "Xóa phản hồi thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
module.exports.getLogout = async (req, res) => {
  console.log("chạy vào logout");
  try {
    const users = await user.findById(res.locals.user.id);
    console.log("user là : ", users);
    if (!users) return res.status(404).json({ message: "User không tồn tại" });

    // 🔹 Xóa refresh_token trong DB
    users.refresh_token = null;
    await users.save();
    res.json({ message: "Đăng xuất thành công, token đã bị thu hồi" });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server" });
  }
};
module.exports.chatboxAI = async (req, res) => {
  try {
    const { message } = req.body;

    // ✅ Kiểm tra input
    if (!message || message.trim() === "") {
      return res.status(400).json({ error: "Message is required." });
    }

    // ✅ Gửi request sang Flask AI Service
    const flaskRes = await axios.post("http://127.0.0.1:6000/api/chat", {
      message,
    });

    const { intent, reply_type, reply } = flaskRes.data;

    // ✅ Trả kết quả lại cho frontend React
    return res.status(200).json({
      success: true,
      intent,
      reply_type, // 🟩 rất quan trọng cho frontend phân biệt "text" hay "books"
      reply,
    });
  } catch (error) {
    console.error("❌ Error connecting to Flask AI service:", error.message);

    // Nếu Flask có trả về phản hồi lỗi
    if (error.response && error.response.data) {
      return res.status(error.response.status || 500).json({
        success: false,
        error: error.response.data.error || "Flask returned an error.",
        details: error.response.data.details || null,
      });
    }

    // Nếu không có phản hồi từ Flask
    return res.status(500).json({
      success: false,
      error: "AI service unavailable. Please try again later.",
    });
  }
};
const forgot = require("./../../model/forgots");
const generater = require("./../../utils/generater");
const { object, string } = require("yup");
const sendMailHepler = require("./../../utils/sendEmail");
module.exports.forgot = async (req, res) => {
  //
  const { email } = req.body; // phá vỡ cấu trúc
  console.log("email trong body là : ", email);
  const response = {};
  // validate lại dữ liệu
  let usersschma = object({
    email: string()
      .required("Bắt buộc phải nhập email")
      .email("bắt buộc phải nhập đúng định dạng email"),
  });
  try {
    const body = await usersschma.validate(req.body, { abortEarly: false });
    const users = await user.findOne({
      email: email,
      status: "active",
      deleted: false,
    });
    console.log("user trong forgot là : ", users);
    if (!users) {
      throw new Error("user not exsit ");
    }
    const forgotSchema = {
      email: email,
      otp: generater.generateRandomString(8),
      expireAt: Date.now(),
    };
    const forgots = new forgot(forgotSchema);
    await forgots.save();
    const subject = "Mã OTP để xác nhận để lấy lại mật khẩu";
    const htmlcontent = `Mã otp xác minh để lấy lại mật khẩu là :${forgotSchema.otp} , lưu ý thời hạn trong vòng 3 phút`;
    sendMailHepler.sendmail(email, subject, htmlcontent);
    Object.assign(response, {
      state: 200,
      message: "success",
    });
  } catch (e) {
    let error = {};
    if (e.name === "ValidationError" && Array.isArray(e.inner)) {
      error = Object.fromEntries(
        e.inner.map((item) => [item.path, item.message])
      );
    } else {
      error = { general: e.message };
    }
    Object.assign(response, {
      state: 404,
      message: "Bad request",
      error,
    });
  }
  return res.status(response.state).json(response);
};
module.exports.getotp = async (req, res) => {
  const response = {};
  const forgots = await forgot.findOne({ email: req.body.email });
  console.log("req là: ", forgots);
  console.log("otp là : ", req.body.otp);
  if (forgots) {
    if (req.body.otp != forgots.otp) {
      console.log("không ok");
      Object.assign(response, {
        status: 500,
        message: "Serrver error",
      });
    } else {
      console.log("quá  ok");
      await user.updateOne({ email: req.body.email }, { resertpassword: true }); // update để có thể đổi mật khẩu
      // if (!users) {
      //   throw new Error("users not exsit");
      // }
      // await users.updateOne({ password: password, resertpassword: false });
      Object.assign(response, {
        status: 200,
        message: "success",
      });
    }
  } else {
    console.log("server bị lỗi");
    Object.assign(response, {
      status: 500,
      message: "Serrver error",
    });
  }
  return res.status(response.status).json(response);
};
module.exports.enterresertpassword = async (req, res) => {
  var { email, password } = req.body;
  console.log("email trong chương trình là : ", req.body);
  password = bcrypt.hashSync(password, 10);
  const response = {};
  try {
    console.log("chạy vào try");
    const users1 = await user.findOne({ email: email });
    console.log("dữ liệu thử là ", users1);
    const users = await user.findOne({ email: email, resertpassword: true });
    console.log("user trong chương trình trên là : ", users);
    if (!users) {
      Object.assign(response, {
        state: 404,
        message: "not found",
      });
      return res.status(response.state).json(response);
    }
    await users.updateOne({ password: password, resertpassword: false });
    Object.assign(response, {
      state: 200,
      message: "success",
    });
  } catch (e) {
    console.log("chạy vào catch");
    Object.assign(response, {
      state: 400,
      message: "Bad request",
    });
  }
  return res.status(response.state).json(response);
};
