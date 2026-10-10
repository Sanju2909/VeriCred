const ApiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  // Bad JSON syntax in request body
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return ApiResponse.error(
      res,
      400,
      "Malformed JSON payload in request body",
      "INVALID_JSON_BODY"
    );
  }

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiResponse.error(
      res,
      400,
      "Validation error on input data",
      "VALIDATION_ERROR",
      details
    );
  }

  // Mongoose Duplicate Key Error (E11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return ApiResponse.error(
      res,
      409,
      `A record with this ${field} already exists`,
      "DUPLICATE_RESOURCE",
      { field, value: err.keyValue ? err.keyValue[field] : undefined }
    );
  }

  // Mongoose Invalid ObjectId Cast Error
  if (err.name === "CastError") {
    return ApiResponse.error(
      res,
      400,
      `Invalid format for resource identifier: ${err.value}`,
      "INVALID_IDENTIFIER"
    );
  }

  // Custom application error with statusCode
  if (err.statusCode && err.statusCode < 500) {
    return ApiResponse.error(
      res,
      err.statusCode,
      err.message,
      err.errorCode || "BAD_REQUEST",
      err.details || null
    );
  }

  // Server error (500)
  logger.error("Unhandled Application Server Error", err);
  return ApiResponse.error(
    res,
    500,
    process.env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred"
      : err.message,
    "INTERNAL_SERVER_ERROR"
  );
}

module.exports = errorHandler;

