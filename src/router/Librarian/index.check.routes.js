const router = require("./librarian.check.routes");
const middleware = require("./../../middleware/Librarian/authLibrarian");
module.exports = (app) => {
  app.use("/api/librarian/check", middleware.checkaccountLibrarian, router);
};
