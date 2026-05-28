const { successResponse } = require("../utils/apiResponse");

const healthController = (req, res) => {
  return res.json(
    successResponse({
      service: "express-server",
      status: "healthy",
    }),
  );
};

module.exports = {
  healthController,
};
