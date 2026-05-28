const successResponse = (data) => ({
  success: true,
  data,
});

const errorResponse = (error) => ({
  success: false,
  error,
});

module.exports = {
  successResponse,
  errorResponse,
};
