const Book = require("../../model/Book");
const userBook = require("../../model/User_book");
const cloudinary = require("../../config/cloudinaryConfig");
const Table = require("../../model/Table");
const user = require("./../../model/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Author = require("./../../model/Author");
const Category = require("./../../model/Category");
const UserTable = require("../../model/User_table");
const mongoose = require("mongoose");
const userao = require("./../../model/User_Ao");
const UserBook = require("./../../model/User_book");
const Message = require("./../../model/Messages");
const Conversation = require("./../../model/Conversation");
const { sendToUser } = require("../../config/websocket");
//login thủ thư
module.exports.login = async (req, res) => {
  console.log("đang chạy vào login");
  const { email, password } = req.body;
  console.log("email và password là : ", email, password);
  const response = {};
  if (!email || !password) {
    Object.assign(response, {
      state: 404,
      message: "Email hoặc mật khẩu không được bỏ trống",
    });
  } else {
    try {
      const users = await user.findOne({ email });
      console.log("user là : ", users);
      // Không tìm thấy user
      if (!users) {
        Object.assign(response, {
          state: 404,
          message: "Email không tồn tại",
        });
      }

      // Check role_id nếu đây là login admin
      else if (users.role_id.toString() !== "68204b309bd5898e0b648bd6") {
        Object.assign(response, {
          state: 403,
          message: "Bạn không có quyền truy cập trang Admin",
        });
      }
      // Check mật khẩu
      else {
        const result = bcrypt.compareSync(password, users.password);
        if (!result) {
          Object.assign(response, {
            state: 400,
            message: "Sai mật khẩu",
          });
        } else {
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
            { _id: users },
            {
              refresh_token: refresh_token,
            }
          );
          Object.assign(response, {
            state: 200,
            message: "Success",
            access_Token: accesstoken,
            refresh_token: refresh_token,
          });
        }
      }
    } catch (e) {
      console.log("Lỗi server:", e.message);
      Object.assign(response, {
        state: 500,
        message: "Lỗi server",
      });
    }
  }
  res.status(response.state).json({ response });
};

// profile
module.exports.getProfile = async (req, res) => {
  console.log("chạy vào profile của libarian");
  const response = {
    status: 200,
    message: "Success",
    data: res.locals.user,
  };
  res.status(response.status).json(response);
};
//Hàm trả sách
module.exports.returnBorrowBook = async (req, res) => {
  try {
    const { user_id, book_id, borrow_Date } = req.body;
    console.log("user id là: ", user_id);
    const userBooking = await userBook.findOne({
      user_id,
      book_id,
      borrow_date: new Date(borrow_Date),
    });
    if (!userBooking) {
      return res.status(404).json({ messsage: "Không tìm thấy lịch đặt" });
    }
    if (userBooking.status === "returned") {
      return res
        .status(400)
        .json({ messsage: "Lịch đặt này đã được hủy trước đó" });
    }
    const returnQuantity = userBooking.quantity;
    userBooking.quantity = 0;
    userBooking.status = "returned";
    userBooking.return_date = new Date();
    const book = await Book.findById(book_id);
    book.quantity += Number(returnQuantity);
    await book.save();
    await userBooking.save();
    res.status(200).json({ message: "Xác nhận trả sách thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports.laysach = async (req, res) => {
  console.log("chạy vào lấy sách ");
  try {
    const { user_id, book_id, borrow_Date } = req.body;
    console.log("user id là : ", user_id);
    const userBooking = await userBook.findOne({
      book_id,
      borrow_date: new Date(borrow_Date),
      $or: [
        { user_id: user_id },
        { user_id_ao: user_id }, // trường hợp là user_ao
      ],
    });

    if (!userBooking) {
      return res.status(404).json({ messsage: "Không tìm thấy lịch đặt" });
    }
    if (userBooking.status === "returned") {
      return res
        .status(400)
        .json({ messsage: "Lịch đặt này đã được hủy trước đó" });
    }
    userBooking.status = "cancelled";
    await userBooking.save();
    res.status(200).json({ message: "Xác nhận trả sách thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
//Hàm thêm sách
module.exports.AddNewBooks = async (req, res) => {
  try {
    const {
      tittleInput,
      quantityInput,
      published_yearInput,
      categoryInput,
      authorsInput,
      shelfInput,
      rowInput,
      columnInput,
      priceInput,
      descriptionInput,
    } = req.body;
    if (
      !tittleInput ||
      !quantityInput ||
      !published_yearInput ||
      !categoryInput ||
      !authorsInput ||
      !shelfInput ||
      !rowInput ||
      !columnInput ||
      !priceInput ||
      !descriptionInput
    ) {
      return res.status(400).json({ message: "Không được để trống các ô." });
    }
    console.log("1");
    console.log("req file là : ", req.files);
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ message: "Phải upload ít nhất 5 ảnh." });
    }
    console.log("2");
    if (quantityInput <= 0) {
      return res.status(400).json({ message: "Số lượng sách phải lớn hơn 0." });
    }
    console.log("3");
    if (priceInput <= 0) {
      return res
        .status(400)
        .json({ message: "Giá tiền của sách phải lơn hơn 0." });
    }
    console.log("5");
    const imgUrls = [];
    for (const file of req.files) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "SDN302-PROJECT-IMAGES" },
          (error, result) => {
            if (error) reject(error); // nếu upload thất bại -> reject promise
            else resolve(result); // nếu thành công -> resolve với result (thông tin ảnh)
          }
        );
        stream.end(file.buffer); // đưa dữ liệu ảnh từ RAM (buffer) vào stream
      });
      imgUrls.push(uploadResult.secure_url); // lấy URL trả về từ Cloudinary, thêm vào mảng
    }
    const newBook = new Book({
      title: tittleInput,
      quantity: quantityInput,
      published_year: published_yearInput,
      categori_id: categoryInput,
      authors: authorsInput,
      shelf: shelfInput,
      row: rowInput,
      column: columnInput,
      price: priceInput,
      decription: descriptionInput,
      image: imgUrls,
    });
    await newBook.save();
    res.status(200).json({ message: "Thêm sách thành công", data: newBook });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// Hàm cập nhật sách
module.exports.UpdateBooks = async (req, res) => {
  try {
    const { bookIdInput } = req.params;
    const {
      tittleInput,
      quantityInput,
      published_yearInput,
      categoryInput,
      authorsInput,
      shelfInput,
      rowInput,
      columnInput,
      priceInput,
      descriptionInput,
    } = req.body;

    if (quantityInput <= 0) {
      return res.status(400).json({ message: "Số lượng sách phải lớn hơn 0." });
    }
    if (priceInput <= 0) {
      return res
        .status(400)
        .json({ message: "Giá tiền của sách phải lơn hơn 0." });
    }
    const updateBooked = await Book.findByIdAndUpdate(
      bookIdInput,
      {
        title: tittleInput,
        quantity: quantityInput,
        published_year: published_yearInput,
        categori_id: categoryInput,
        authors: authorsInput,
        shelf: shelfInput,
        row: rowInput,
        column: columnInput,
        price: priceInput,
        decription: descriptionInput,
      },
      { new: true }
    );

    if (!updateBooked) {
      return res.status(500).json({ message: "Không tìm thấy sách." });
    }
    return res
      .status(200)
      .json({ message: "Update sách thành công.", data: updateBooked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Hàm xóa sách
module.exports.DeleteBook = async (req, res) => {
  try {
    const { bookIdInput } = req.params;
    const deleteBook = await Book.findByIdAndDelete(bookIdInput);
    if (!deleteBook) {
      return res.status(404).json({ message: "Không tìm thấy sách." });
    }
    return res.status(200).json({ message: "Xóa sách thành công" });
  } catch (error) {
    res.status(500).json({ message: err.message });
  }
};
module.exports.GetAllBook = async (req, res) => {
  console.log("chạy vào getallboook");
  try {
    const allBook = await Book.find()
      .populate("categori_id", "title")
      .populate("authors", "name");
    if (!allBook) {
      return res.status(404).json({ message: "Không tìm thấy sách." });
    }
    return res.status(200).json(allBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// change hoat dộng
module.exports.changeBook = async (req, res) => {
  console.log("chạy vào changeboook");
  try {
    const { id } = req.params;
    const Books = await Book.findById(id);

    if (!Books) {
      return res.status(404).json({ message: "Not Found" });
    }

    const newStatus = Books.status === "active" ? "inactive" : "active";

    await Book.updateOne({ _id: id }, { status: newStatus });

    return res.status(200).json({
      message: "success",
      status: newStatus,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server Error" });
  }
};
// Tạo bàn
module.exports.createTable = async (req, res) => {
  console.log("chạy vào add table ");
  try {
    let { title, price = 0, status = "active" } = req.body;
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Tiêu đề không hợp lệ" });
    }
    const p = Number(price);
    if (Number.isNaN(p) || p < 0) {
      return res.status(400).json({ message: "Giá phải lớn hơn hoặc bằng 0" });
    }
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ message: "Trạng thái không hợp lệ" });
    }
    const table = await Table.create({ title: title.trim(), price: p, status });
    console.log("lưu thành côgn");
    return res.status(201).json({ message: "Tạo bàn thành công", data: table });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Danh sách
module.exports.listTables = async (req, res) => {
  console.log("chạy vào list table ");
  try {
    const { page = 1, limit = 10, includeDeleted = "false" } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const query = includeDeleted === "true" ? {} : { deleted: false };

    const [data, total] = await Promise.all([
      Table.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Table.countDocuments(query),
    ]);

    return res.status(200).json({
      message: "Lấy danh sách bàn thành công",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Chi tiết
module.exports.getTableById = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Không tìm thấy bàn" });
    return res
      .status(200)
      .json({ message: "Lấy chi tiết bàn thành công", data: table });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Cập nhật
module.exports.updateTable = async (req, res) => {
  try {
    const update = {};
    if (req.body.title !== undefined) {
      if (typeof req.body.title !== "string" || !req.body.title.trim()) {
        return res.status(400).json({ message: "Tiêu đề không hợp lệ" });
      }
      update.title = req.body.title.trim();
    }
    if (req.body.price !== undefined) {
      const p = Number(req.body.price);
      if (Number.isNaN(p) || p < 0) {
        return res
          .status(400)
          .json({ message: "Giá phải lớn hơn hoặc bằng 0" });
      }
      update.price = p;
    }
    if (req.body.status !== undefined) {
      if (!["active", "inactive"].includes(req.body.status)) {
        return res.status(400).json({ message: "Trạng thái không hợp lệ" });
      }
      update.status = req.body.status;
    }
    // không cho update trực tiếp 'deleted'
    const table = await Table.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!table) return res.status(404).json({ message: "Không tìm thấy bàn" });
    return res.json({ message: "Cập nhật bàn thành công", data: table });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Khôi phục
module.exports.restoreTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Không tìm thấy bàn" });
    if (!table.deleted) {
      return res.status(400).json({ message: "Bàn chưa bị xóa" });
    }
    table.deleted = false;
    await table.save();
    return res
      .status(200)
      .json({ message: "Khôi phục bàn thành công", data: table });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Xóa cứng
module.exports.hardDeleteTable = async (req, res) => {
  try {
    const deleted = await Table.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Không tìm thấy bàn" });
    return res.status(200).json({ message: "Xóa vĩnh viễn bàn thành công" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Xóa mềm
module.exports.deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ message: "Không tìm thấy bàn" });
    if (table.deleted) {
      return res.status(400).json({ message: "Bàn đã bị xóa mềm" });
    }
    table.deleted = true;
    await table.save();
    return res
      .status(200)
      .json({ message: "Xóa mềm bàn thành công", data: table });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
module.exports.changetable = async (req, res) => {
  try {
    const { id } = req.params;
    const Tables = await Table.findById(id);

    if (!Tables) {
      return res.status(404).json({ message: "Not Found" });
    }

    const newStatus = Tables.status === "active" ? "inactive" : "active";

    await Table.updateOne({ _id: id }, { status: newStatus });

    return res.status(200).json({
      message: "success",
      status: newStatus,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server Error" });
  }
};
// lấy ra tác giả
module.exports.getauthor = async (req, res) => {
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
module.exports.getcategory = async (req, res) => {
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

// Danh sách đặt sách
module.exports.listBookOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      bookId,
      fromDate,
      toDate,
      includeDeleted = "false",
      includeTotal = "false", // 'true' => trả kèm totalPrice
    } = req.query;

    const includeTotalBool = String(includeTotal) === "true";
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    // Validate ObjectId
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "userId không hợp lệ" });
    }
    if (bookId && !mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "bookId không hợp lệ" });
    }

    // Build filter
    const filter = {};
    if (includeDeleted !== "true") filter.deleted = false;
    if (status) filter.status = status;
    if (userId) filter.user_id = userId;
    if (bookId) filter.book_id = bookId;

    // Date range on borrow_date
    if (fromDate || toDate) {
      filter.borrow_date = {};
      if (fromDate) {
        const from = new Date(fromDate);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ message: "fromDate không hợp lệ" });
        }
        filter.borrow_date.$gte = from;
      }
      if (toDate) {
        const to = new Date(toDate);
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({ message: "toDate không hợp lệ" });
        }
        if (toDate.length <= 10) to.setHours(23, 59, 59, 999);
        filter.borrow_date.$lte = to;
      }
    }

    const [data, total] = await Promise.all([
      userBook
        .find(filter)
        .select(
          "user_id book_id quantity borrow_date return_date status book_detail deleted createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("user_id", "fullname email")
        .populate("user_id_ao", "fullname email")
        .populate("book_id", "title price")
        .lean(),
      userBook.countDocuments(filter),
    ]);
    console.log("data là : ", data);
    // borrowBookFunction đã lưu book_detail.price = tổng tiền => dùng trực tiếp
    const mapped = data.map((o) => {
      const totalPrice =
        typeof o?.book_detail?.price === "number"
          ? o.book_detail.price
          : (Number.isFinite(o.quantity) ? o.quantity : 0) *
            (typeof o?.book_id?.price === "number" ? o.book_id.price : 0);
      return { ...o, totalPrice };
    });

    return res.status(200).json({
      message: "Lấy danh sách đặt sách thành công",
      data: includeTotalBool ? mapped : data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Danh sách đặt bàn
module.exports.listTableOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      tableId,
      fromDate,
      toDate,
      includeDeleted = "false",
      includeTotal = "false", // 'true' => trả kèm totalPrice
    } = req.query;

    const includeTotalBool = String(includeTotal) === "true";
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);

    // Validate ObjectId
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "userId không hợp lệ" });
    }
    if (tableId && !mongoose.Types.ObjectId.isValid(tableId)) {
      return res.status(400).json({ message: "tableId không hợp lệ" });
    }

    // Build filter
    const filter = {};
    if (includeDeleted !== "true") filter.deleted = false;
    if (status) filter.status = status;
    if (userId) filter.user_id = userId;
    if (tableId) filter.table_id = tableId;

    // Date range on time_date
    if (fromDate || toDate) {
      filter.time_date = {};
      if (fromDate) {
        const from = new Date(fromDate);
        if (Number.isNaN(from.getTime())) {
          return res.status(400).json({ message: "fromDate không hợp lệ" });
        }
        filter.time_date.$gte = from;
      }
      if (toDate) {
        const to = new Date(toDate);
        if (Number.isNaN(to.getTime())) {
          return res.status(400).json({ message: "toDate không hợp lệ" });
        }
        if (toDate.length <= 10) to.setHours(23, 59, 59, 999);
        filter.time_date.$lte = to;
      }
    }

    const [data, total] = await Promise.all([
      UserTable.find(filter)
        .select("user_id table_id time_slot time_date status deleted createdAt")
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("user_id", "fullname email")
        .populate("table_id", "title price status")
        .populate("time_slot")
        .lean(),
      UserTable.countDocuments(filter),
    ]);

    // Tổng tiền = giá bàn * số slot
    const mapped = data.map((o) => {
      const slotCount = Array.isArray(o.time_slot) ? o.time_slot.length : 0;
      const unit =
        typeof o?.table_id?.price === "number" ? o.table_id.price : 0;
      return { ...o, time_slot_count: slotCount, totalPrice: unit * slotCount };
    });

    return res.status(200).json({
      message: "Lấy danh sách đặt bàn thành công",
      data: includeTotalBool ? mapped : data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(Math.ceil(total / limitNum), 1),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
module.exports.bookforusser = async (req, res) => {
  const { fullname, email, phone, book_id, quantity, note } = req.body;
  console.log(
    "fullname email phone book_id quantity ",
    fullname,
    email,
    phone,
    book_id,
    quantity
  );
  // ✅ 1. Kiểm tra dữ liệu bắt buộc
  if (!fullname || !email || !phone || !book_id || !quantity) {
    return res.status(400).json({
      message: "Thiếu thông tin bắt buộc!",
    });
  }
  const users = await user.findOne({ email: email });
  if (users) {
    return res.status(400).json({
      message: "Email đã tồn tại!",
    });
  }
  const useraosexit = await userao.findOne({ email: email });
  console.log("userao là : ", useraosexit);
  if (useraosexit) {
    return res.status(400).json({
      message: "Email đã tồn tại!",
    });
  }
  const useraos = new userao({
    fullname: fullname,
    email: email,
    phone: phone,
  });
  await useraos.save();

  const useraoo = await userao.findOne({ email: email });
  const book = await Book.findById(book_id);
  if (!book) {
    return res.status(404).json({ message: "Không tìm thấy sách " });
  }
  if (book.quantity <= 0) {
    return res
      .status(400)
      .json({ message: "Sách này đã hết. Vui lòng chọn sách khác" });
  }
  if (book.quantity < quantity) {
    return res.status(400).json({
      message: `Chỉ còn ${book.quantity} cuốn trong kho, không thể mượn ${quantityInput} cuốn`,
    });
  }
  const userBook = new UserBook({
    user_id_ao: useraoo.id,
    book_id: book_id,
    quantity: quantity,
    borrow_date: new Date(),
    book_detail: {
      price: book.price * quantity,
      date: book.date,
      transaction_type: "Booking_book",
    },
  });
  await userBook.save();
  book.quantity -= Number(quantity);
  await book.save();
  res.status(201).json({ message: "Tạo người mượn thành công!" });
};

// nhắn tin
module.exports.getAllConversations = async (req, res) => {
  console.log("chạy vào getAllConversation");
  try {
    const conversation = await Conversation.find()
      .populate("user_id", "fullname avatar")
      .populate()
      .sort({ lastMessagesTime: -1 });
    if (!conversation) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy cuộc hội thoại." });
    }
    console.log("cuộc trog chuyện là : ", conversation);
    res.status(200).json({
      message: "Lấy danh sách cuộc hội thoại thành công.",
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Gửi tin nhắn

// Lấy tất cả cuộc hội thoại
module.exports.sendMessage = async (req, res) => {
  console.log("chạy vào gửi tin nhắn");
  try {
    const senderIdInput = res.locals.user.id;
    const { userIdInput } = req.params;
    const { contentInput } = req.body;
    const message = new Message({
      sender_id: senderIdInput,
      receiver_id: userIdInput,
      content: contentInput,
      read: false,
    });
    await message.save();
    sendToUser(userIdInput, {
      type: "new_message",
      data: message,
    });
    res.status(200).json({ message: "Gửi tin nhắn thành công", data: message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tin nhắn
module.exports.getMessageHistory = async (req, res) => {
  try {
    const senderIdInput = res.locals.user.id;
    //const {senderIdInput} = req.body; // Dùng body để test trước
    const { userIdInput } = req.params;
    const messages = await Message.find({
      $or: [
        { sender_id: senderIdInput, receiver_id: userIdInput },
        { sender_id: userIdInput, receiver_id: senderIdInput },
      ],
    }).sort({ createdAt: 1 });
    res.status(200).json({ message: "Lịch sử tin nhắn", data: messages });
  } catch (error) {}
};
