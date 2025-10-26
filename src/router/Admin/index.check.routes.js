const router = require("./admin.check.routes");
const middlewareADmin = require("./../../middleware/admin/authAdmin");
module.exports = (app) => {
  app.use("/admincheck", middlewareADmin.checkaccountAdmin, router);
};
