const { verifyToken } = require("../utils/jwtUtils");
const ApiResponse = require("../utils/apiResponse");
const { User } = require("../models/User");
const { isDatabaseConnected } = require("../config/db");
const environment = require("../config/environment");

/**
 * Authentication Middleware
 * Extracts and verifies the JWT from Authorization header.
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return ApiResponse.error(
      res,
      401,
      "Authentication required. Bearer token missing.",
      "UNAUTHORIZED"
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token, environment.JWT_SECRET);

    // If database is connected, fetch full active user record
    if (isDatabaseConnected()) {
      const user = await User.findById(decoded.userId);
      if (!user) {
        return ApiResponse.error(
          res,
          401,
          "User account associated with this token no longer exists",
          "USER_NOT_FOUND"
        );
      }
      if (!user.isActive) {
        return ApiResponse.error(
          res,
          403,
          "User account is deactivated. Please contact support.",
          "ACCOUNT_DEACTIVATED"
        );
      }
      req.user = user.toSafeObject();
    } else {
      // Degraded fallback when running in standalone mode without DB
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        ethereumAddress: decoded.ethereumAddress || null,
      };
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return ApiResponse.error(
        res,
        401,
        "Authentication token has expired. Please log in again.",
        "TOKEN_EXPIRED"
      );
    }
    return ApiResponse.error(
      res,
      401,
      "Invalid authentication token",
      "INVALID_TOKEN"
    );
  }
}

/**
 * Role-Based Authorization Middleware
 * @param {...string} allowedRoles 
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(
        res,
        401,
        "User context missing. Authentication required.",
        "UNAUTHORIZED"
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return ApiResponse.error(
        res,
        403,
        `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
        "FORBIDDEN"
      );
    }

    next();
  };
}

/**
 * Middleware ensuring database connection is active for data persistence endpoints.
 */
function requireDatabase(req, res, next) {
  if (!isDatabaseConnected()) {
    return ApiResponse.error(
      res,
      503,
      "Database service is currently unavailable. Please verify MONGODB_URI configuration.",
      "DATABASE_UNAVAILABLE"
    );
  }
  next();
}

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireDatabase,
};
