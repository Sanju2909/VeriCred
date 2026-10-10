const authService = require("../services/authService");
const ApiResponse = require("../utils/apiResponse");

class AuthController {
  /**
   * POST /api/auth/register
   * Register a new user account.
   */
  async register(req, res, next) {
    try {
      const { name, email, password, role, ethereumAddress } = req.body;
      const result = await authService.register({
        name,
        email,
        password,
        role,
        ethereumAddress,
        ipAddress: req.ip,
      });

      return ApiResponse.success(
        res,
        201,
        "User registration successful",
        result
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   * Authenticate credentials and return JWT.
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = await authService.login({
        email,
        password,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      return ApiResponse.success(
        res,
        200,
        "Authentication successful",
        result
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Acknowledge logout and invalidate client session.
   */
  async logout(req, res, next) {
    try {
      return ApiResponse.success(res, 200, "Successfully logged out");
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Return currently authenticated user profile.
   */
  async getMe(req, res, next) {
    try {
      const userProfile = await authService.getProfile(req.user.id);
      return ApiResponse.success(res, 200, "User profile retrieved", userProfile);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
