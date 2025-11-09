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
//send message
routerUserCheck.post("/sendMessage", userController.sendMessage);
routerUserCheck.get("/messageHistory", userController.getMessageHistory);
// Fav book
routerUserCheck.get("/favourite", userController.getFavouriteBooks);
routerUserCheck.post("/favourite", userController.addFavouriteBook);
routerUserCheck.delete(
  "/favourite/:bookId",
  userController.deleteFavouriteBook
);
routerUserCheck.get("/orderbook", userController.getOrderBooks);
routerUserCheck.get("/ordertable", userController.getOrderTables);
routerUserCheck.post("/reviewBook", userController.addReviewBook);
routerUserCheck.put("/reviewBook", userController.editReviewBook);
routerUserCheck.delete(
  "/reviewBookdelete/:reviewId",
  userController.deleteReviewBook
);
//
routerUserCheck.post("/:reviewId/reply", userController.postreviewReply);
// Lấy danh sách phản hồi theo review
routerUserCheck.get("/:reviewreplyId", userController.getRepliesByReview);

// Xóa phản hồi
routerUserCheck.delete("/:id", userController.deleteReply);
routerUserCheck.post("/logout", userController.getLogout);

routerUserCheck.post("/chatboxAI", userController.chatboxAI);
module.exports = routerUserCheck;
