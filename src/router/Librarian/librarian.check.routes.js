const express = require("express");
const routerLibCheck = express.Router();
const LibrarianController = require("../../controller/Librarian/librarian.controller");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

routerLibCheck.get("/profile", LibrarianController.getProfile);
routerLibCheck.patch("/returnBook", LibrarianController.returnBorrowBook);
routerLibCheck.post(
  "/addNewBooks",
  upload.array("images"),
  LibrarianController.AddNewBooks
);
routerLibCheck.patch(
  "/updateBooks/:bookIdInput",
  LibrarianController.UpdateBooks
);
routerLibCheck.delete(
  "/deleteBooks/:bookIdInput",
  LibrarianController.DeleteBook
);
routerLibCheck.get("/getAllBooks", LibrarianController.GetAllBook);

routerLibCheck.post("/changebook/:id", LibrarianController.changeBook);
routerLibCheck.put("/returnBook", LibrarianController.returnBorrowBook);
routerLibCheck.put("/laysach", LibrarianController.laysach);
// CRUD Table
routerLibCheck.post("/tables", LibrarianController.createTable);
routerLibCheck.get("/tables", LibrarianController.listTables);
routerLibCheck.get("/tables/:id", LibrarianController.getTableById);
routerLibCheck.put("/tables/:id", LibrarianController.updateTable);
routerLibCheck.delete("/tables/:id", LibrarianController.deleteTable);
routerLibCheck.put("/tableschange/:id", LibrarianController.changetable);
routerLibCheck.post("/bookforusser", LibrarianController.bookforusser);
//khôi phục (restore) + xóa hẳn (hard delete)
routerLibCheck.patch("/tables/:id/restore", LibrarianController.restoreTable);
routerLibCheck.delete("/tables/:id/hard", LibrarianController.hardDeleteTable);
routerLibCheck.get("/category", LibrarianController.getauthor);
routerLibCheck.get("/getauthor", LibrarianController.getcategory);
routerLibCheck.get("/orders/books", LibrarianController.listBookOrders);
routerLibCheck.get("/orders/tables", LibrarianController.listTableOrders);

// nhắn tin
routerLibCheck.get(
  "/getAllConversations",
  LibrarianController.getAllConversations
);
routerLibCheck.post(
  "/sendMessages/:userIdInput",
  LibrarianController.sendMessage
);
routerLibCheck.get(
  "/messageHistories/:userIdInput",
  LibrarianController.getMessageHistory
);
module.exports = routerLibCheck;
