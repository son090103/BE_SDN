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
  try {
    var { fullname, email, password, phone, role_id } = req.body;
    const existingUser = await user.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }
    password = bcrypt.hashSync(password, 10);
    const newUser = new user({
      fullname,
      email,
      password,
      phone,
      role_id: role_id || null,
    });
    if (!req.body.avatar) {
      req.body.avatar =
        "https://res.cloudinary.com/dmdogr8na/image/upload/v1746949468/hnrnjeaoymnbudrzs7v9.jpg";
    }
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
    console.log("locale: ", locale);
    console.log("process.env.VNP_HASH_SECRET: ", process.env.VNP_HASH_SECRET);
    const txnRef = uuidv4();
    const returnUrl = `${process.env.VNP_RETURNURL}/${req.body.slug || ""}`;
    let currCode = "VND";
    let vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = process.env.VNP_TMNCODE;
    vnp_Params["vnp_Locale"] = "vn";
    vnp_Params["vnp_CurrCode"] = currCode;
    vnp_Params["vnp_TxnRef"] = txnRef;
    vnp_Params["vnp_OrderInfo"] = `${userId}`;
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
    console.log("signData:", signData);
    console.log("vnp_SecureHash:", vnp_Params["vnp_SecureHash"]);
    console.log("vnp_Params:", vnp_Params);
    console.log("vnpUrl:", vnpUrl);
    // 🧩 9. Lưu thông tin mượn sách
    const userBook = new UserBook({
      user_id: res.locals.user._id,
      book_id: bookId,
      quantity: quantityInput,
      borrow_date: new Date(),
      book_detail: {
        price: amount,
        date: new Date(),
        transaction_type: "Booking_book",
      },
    });
    await userBook.save();

    // Giảm số lượng trong kho
    book.quantity -= Number(quantityInput);
    await book.save();

    // 🧩 10. Trả về URL thanh toán cho FE
    res.status(200).json({
      success: true,
      message: "Tạo yêu cầu mượn sách và thanh toán thành công!",
      url: vnpUrl,
    });
  } catch (err) {
    console.error("🚨 Lỗi trong borrowBookFunction:", err);
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
module.exports.postUserTable = async (req, res) => {
  const { table_id, time_date, slot_time } = req.body;
  console.log("req.body là : ", table_id, time_date, slot_time);

  const [year, month, day] = time_date.split("-").map(Number);

  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

  let userTable = await User_table.findOne({
    user_id: res.locals.user.id,
    table_id: table_id,
    time_date: { $gte: start, $lt: end },
  });
  console.log("user là : ", res.locals._id);
  if (!userTable) {
    userTable = new User_table({
      user_id: res.locals.user._id,
      table_id,
      time_slot: Array.isArray(slot_time) ? slot_time : [slot_time],
      time_date: start, // lưu ngày chuẩn
      status: "active",
    });
    await userTable.save();
    console.log("✅ Tạo mới lịch:", userTable);
  } else {
    // Nếu đã có -> push thêm slot_time (tránh trùng lặp)
    const newSlots = Array.isArray(slot_time) ? slot_time : [slot_time];
    userTable.time_slot = Array.from(
      new Set([...userTable.time_slot, ...newSlots])
    );
    await userTable.save();
    console.log("✅ Cập nhật slot_time:", userTable);
  }
  const query = {
    status: "active",
    table_id: table_id,
    time_date: { $gte: start, $lt: end },
  };

  console.log("query là:", query);

  const newuserTable = await User_table.find(query).populate({
    path: "user_id",
    select: "-password",
  });
  return res.status(200).json({
    status: 200,
    message: "success",
    data: newuserTable,
  });
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
      if (!user) {
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
