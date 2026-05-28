const { errorResponse } = require("../utils/apiResponse");

const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const payload = errorResponse(err.message || "Internal Server Error");

  res.status(status).json(payload);
};

module.exports = {
  errorHandler,
};
