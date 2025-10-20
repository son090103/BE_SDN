const express = require("express");
const routerUserCheck = express.Router();
const userController = require("../../controller/Users/user.controller");
const upload = require("../../utils/upload");
routerUserCheck.post("/borrowBook", userController.borrowBookFunction);
routerUserCheck.get("/getuser", userController.getUser);
routerUserCheck.get("/slottime", userController.getslotTime);
routerUserCheck.get("/getTable", userController.getTables);
routerUserCheck.post("/getUerTable", userController.getUserTable);
routerUserCheck.post("/postTableUser", userController.postUserTable);
routerUserCheck.put(
  "/profile",
  upload.single("avatar"),
  userController.updateProfile
);
routerUserCheck.put("/profile/password", userController.changePassword);
// Fav book
routerUserCheck.get("/favourite", userController.getFavouriteBooks);
routerUserCheck.post("/favourite", userController.addFavouriteBook);
routerUserCheck.delete(
  "/favourite/:bookId",
  userController.deleteFavouriteBook
);

module.exports = routerUserCheck;
