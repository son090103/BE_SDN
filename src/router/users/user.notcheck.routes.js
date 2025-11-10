const express = require("express");
const routerUserNotCheck = express.Router();
const Usercontroller = require("./../../controller/Users/user.controller");
const bookController = require("../../controller/Users/book.controller");
routerUserNotCheck.post("/loginUser", Usercontroller.login);

routerUserNotCheck.post("/register", Usercontroller.register);

routerUserNotCheck.get("/books/:slug", bookController.getBookBySlug);

routerUserNotCheck.get(
  "/filterPaginated",
  Usercontroller.findAndFilterProductPaginated
);
routerUserNotCheck.get("/newBook", Usercontroller.getNewBook);
routerUserNotCheck.get("/category", Usercontroller.getcategory);
routerUserNotCheck.get("/getauthor", Usercontroller.getauthor);
routerUserNotCheck.post("/refersh_token", Usercontroller.refersh_token);
routerUserNotCheck.get("/reviewBook", Usercontroller.getReviewBooks);
// forgot password
routerUserNotCheck.post("/forgot", Usercontroller.forgot);
routerUserNotCheck.post("/otp", Usercontroller.getotp);
// router.post("/resertpassword", controller.resertpassword);
routerUserNotCheck.post(
  "/enterresertpassword",
  Usercontroller.enterresertpassword
);
routerUserNotCheck.get(
  "/vnpay-borrowBook",
  Usercontroller.vnpayborrowBookFunction
);
routerUserNotCheck.get(
  "/vnpay-borrowTable",
  Usercontroller.vnpayUserTableCallback
);
module.exports = routerUserNotCheck;
