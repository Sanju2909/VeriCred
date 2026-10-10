const { validationResult } = require("express-validator");
const ApiResponse = require("../utils/apiResponse");

/**
 * Middleware that checks express-validator results and halts on validation failures.
 */
function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return ApiResponse.error(
      res,
      400,
      "Input validation failed. Please check the provided fields.",
      "VALIDATION_ERROR",
      formattedErrors
    );
  }
  next();
}

module.exports = validateRequest;
