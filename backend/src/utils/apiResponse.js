/**
 * Standardized API Response Formatting Utility
 */

class ApiResponse {
  /**
   * Send a standardized success JSON response.
   * @param {import('express').Response} res 
   * @param {number} statusCode 
   * @param {string} message 
   * @param {object|array|null} data 
   */
  static success(res, statusCode = 200, message = "Success", data = null) {
    const payload = {
      success: true,
      message,
    };
    if (data !== null && data !== undefined) {
      payload.data = data;
    }
    return res.status(statusCode).json(payload);
  }

  /**
   * Send a standardized error JSON response.
   * @param {import('express').Response} res 
   * @param {number} statusCode 
   * @param {string} message 
   * @param {string} errorCode 
   * @param {array|object|null} details 
   */
  static error(res, statusCode = 500, message = "Internal Server Error", errorCode = "INTERNAL_ERROR", details = null) {
    const payload = {
      success: false,
      error: {
        code: errorCode,
        message,
      },
    };
    if (details !== null && details !== undefined) {
      payload.error.details = details;
    }
    return res.status(statusCode).json(payload);
  }
}

module.exports = ApiResponse;
