const { User, ROLES } = require("../models/User");
const ApiResponse = require("../utils/apiResponse");

class UserController {
  /**
   * GET /api/users
   * Admin-only: list all users with optional role filtering and pagination.
   */
  async listUsers(req, res, next) {
    try {
      const { role, page = 1, limit = 20 } = req.query;
      const query = {};
      if (role && Object.values(ROLES).includes(role.toUpperCase())) {
        query.role = role.toUpperCase();
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        User.find(query).skip(skip).limit(limitNum).sort({ createdAt: -1 }),
        User.countDocuments(query),
      ]);

      return ApiResponse.success(res, 200, "Users retrieved successfully", {
        users: users.map((u) => u.toSafeObject()),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:id
   * Retrieve single user details (Admin or self).
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      // Access control: Only admin or the user themselves can view their full profile
      if (req.user.role !== ROLES.ADMIN && req.user.id !== id) {
        return ApiResponse.error(
          res,
          403,
          "Access denied. You can only view your own user profile.",
          "FORBIDDEN"
        );
      }

      const user = await User.findById(id);
      if (!user) {
        return ApiResponse.error(res, 404, "User not found", "USER_NOT_FOUND");
      }

      return ApiResponse.success(res, 200, "User found", user.toSafeObject());
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/:id/role
   * Admin-only: update user role.
   */
  async updateUserRole(req, res, next) {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!role || !Object.values(ROLES).includes(role.toUpperCase())) {
        return ApiResponse.error(
          res,
          400,
          `Invalid role: ${role}. Must be ADMIN, ISSUER, HOLDER, or VERIFIER.`,
          "INVALID_ROLE"
        );
      }

      const user = await User.findById(id);
      if (!user) {
        return ApiResponse.error(res, 404, "User not found", "USER_NOT_FOUND");
      }

      user.role = role.toUpperCase();
      await user.save();

      return ApiResponse.success(res, 200, "User role updated successfully", user.toSafeObject());
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();
