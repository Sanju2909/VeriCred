const rateLimit = require("express-rate-limit");
const ApiResponse = require("../utils/apiResponse");

/**
 * General API Rate Limiter
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 1000 : 100, // Limit each IP to 100 requests per window
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res,
      429,
      "Too many requests from this IP, please try again after 15 minutes",
      "RATE_LIMIT_EXCEEDED"
    );
  },
});

/**
 * Strict Rate Limiter for Authentication Endpoints (Brute-force protection)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 1000 : 10, // Limit to 10 attempts per 15 minutes
  skip: () => process.env.NODE_ENV === "test",
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(
      res,
      429,
      "Too many authentication attempts. Please try again after 15 minutes.",
      "AUTH_RATE_LIMIT_EXCEEDED"
    );
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
};

