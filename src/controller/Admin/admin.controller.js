const User = require("../../model/User");
const UserBook = require("../../model/User_book");
const UserTable = require("../../model/User_table");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
module.exports.login = async (req, res) => {
  console.log("chạy vào  login admin");
  const { email, password } = req.body;
  console.log("password là : ", password);

  const response = {};
  if (!email || !password) {
    Object.assign(response, {
      state: 404,
      message: "Email hoặc mật khẩu không được bỏ trống",
    });
  } else {
    try {
      const users = await User.findOne({ email });
      // Không tìm thấy user
      if (!users) {
        Object.assign(response, {
          state: 404,
          message: "Email không tồn tại",
        });
      }
      // Check role_id nếu đây là login admin
      else if (users.role_id.toString() !== "68204adb9bd5898e0b648bd4") {
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
          await User.updateOne(
            { _id: users.id },
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
module.exports.getProfile = async (req, res) => {
  console.log("chạy vào profile của admin");
  const response = {
    status: 200,
    message: "Success",
    data: res.locals.user,
  };
  res.status(response.status).json(response);
};
// Hàm lấy tất cả users
const Role = require("./../../model/Role");
module.exports.GetAllUsers = async (req, res) => {
  try {
    // Tìm role 'admin'
    const role = await Role.findOne({ title: "admin" });
    console.log("role là : ", role._id.toString());
    if (!role) {
      return res.status(404).json({ message: "Admin role not found" });
    }
    // Lấy tất cả us1er không có role admin
    const users = await User.find({
      role_id: { $ne: role._id.toString() },
    });

    // Kiểm tra nếu không có user nào
    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    // Trả kết quả
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hàm lấy tổng số người dùng
module.exports.GetTotalUser = async (req, res) => {
  try {
    let total = 0;
    const user = await User.find();
    for (const item of user) {
      if (item) {
        total += 1;
      }
    }
    res.status(200).json(total);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hàm lấy tổng user mới trong tháng
module.exports.GetTotalNewUser = async (req, res) => {
  try {
    let total = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const user = await User.find().select("createdAt");
    const userThisMonth = user.filter((item) => {
      const itemThisMonth = new Date(item.createdAt).getMonth();
      const itemThisYear = new Date(item.createdAt).getFullYear();
      return itemThisMonth === currentMonth && itemThisYear === currentYear;
    });
    for (const itemUser of userThisMonth) {
      if (itemUser) {
        total += 1;
      }
    }
    res.status(200).json(total);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hàm lấy thống kê doanh thu các tháng trong năm
module.exports.GetAllRevenueByDashBoard = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const userBook = await UserBook.find().select(
      "book_detail.price createdAt"
    );
    const userTable = await UserTable.find()
      .select("time_date")
      .populate("table_id", "price");
    const monthlyRevenue = Array(12).fill(0);
    const userBookThisMonth = userBook.filter((item) => {
      const itemThisYear = new Date(item.createdAt).getFullYear();
      return itemThisYear === currentYear;
    });
    const userTableThisMonth = userTable.filter((item) => {
      const itemThisYear = new Date(item.time_date).getFullYear();
      return itemThisYear === currentYear;
    });
    for (const itemUserBook of userBookThisMonth) {
      const date = new Date(itemUserBook.createdAt);
      if (itemUserBook) {
        const month = date.getMonth();
        monthlyRevenue[month] += itemUserBook.book_detail.price;
      }
    }
    for (const itemUserBook of userTableThisMonth) {
      const date = new Date(itemUserBook.time_date);
      if (itemUserBook) {
        const month = date.getMonth();
        monthlyRevenue[month] += itemUserBook.table_id.price;
      }
    }
    console.log(monthlyRevenue);
    res.status(200).json(monthlyRevenue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// Hàm lấy tổng doanh thu sách theo năm hiện tại
module.exports.GetTotalRevenue = async (req, res) => {
  try {
    let total = 0;
    let totalUserTable = 0;
    let totalUserBook = 0;
    const currentYear = new Date().getFullYear();
    const userBook = await UserBook.find().select(
      "book_detail.price createdAt"
    );
    const userTable = await UserTable.find()
      .select("time_date")
      .populate("table_id", "price");
    const userBookThisYear = userBook.filter((item) => {
      const itemYear = new Date(item.createdAt).getFullYear();
      return itemYear === currentYear;
    });
    const userTableThisYear = userTable.filter((item) => {
      const itemYear = new Date(item.time_date).getFullYear();
      return itemYear === currentYear;
    });
    for (const itemUserBook of userBookThisYear) {
      totalUserBook += itemUserBook.book_detail.price;
    }
    for (const itemUserTable of userTableThisYear) {
      totalUserTable += itemUserTable.table_id.price;
    }
    total = totalUserBook + totalUserTable;
    return res.status(200).json(total);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports.BanUsers = async (req, res) => {
  console.log("chạy vào ban admin");
  try {
    const { userId } = req.params;
    const users = await User.findByIdAndUpdate(userId, { status: "inactive" });

    res.status(200).json({ message: "Ban người dùng thành công" }, users);
  } catch (error) {
    console.log("chạy vào catch ban ");
    res.status(500).json({ message: error.message });
  }
};
// Hàm ban Users
module.exports.UnBanUsers = async (req, res) => {
  try {
    const { userId } = req.params;
    const users = await User.findByIdAndUpdate(userId, { status: "active" });

    res.status(200).json({ message: "UnBan người dùng thành công" }, users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
