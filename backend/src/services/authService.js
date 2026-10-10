const { User, ROLES } = require("../models/User");
const { AuditEvent } = require("../models/AuditEvent");
const { hashPassword, comparePassword } = require("../utils/passwordUtils");
const { generateToken } = require("../utils/jwtUtils");
const environment = require("../config/environment");

class AuthService {
  /**
   * Registers a new user with secure password hashing.
   */
  async register({ name, email, password, role = ROLES.HOLDER, ethereumAddress, ipAddress }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check for existing user with duplicate email
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      const error = new Error("An account with this email address already exists");
      error.statusCode = 409;
      error.errorCode = "DUPLICATE_EMAIL";
      throw error;
    }

    // 2. Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // 3. Construct user document
    const userRole = role || ROLES.HOLDER;
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
      ethereumAddress: ethereumAddress ? ethereumAddress.toLowerCase().trim() : null,
      isActive: true,
      isVerified: false,
    });

    // Assign standard Decentralized Identifier (DID) format
    if (user.ethereumAddress) {
      user.did = `did:ethr:${user.ethereumAddress}`;
    } else {
      user.did = `did:credential:${user._id.toString()}`;
    }

    await user.save();

    // 4. Log audit event
    await AuditEvent.create({
      eventType: "AUTH_REGISTER",
      actorId: user._id,
      actorRole: user.role,
      targetId: user._id.toString(),
      targetType: "USER",
      ipAddress: ipAddress || null,
      status: "SUCCESS",
      metadata: { email: user.email, role: user.role },
    }).catch(() => {}); // Non-blocking audit log

    // 5. Generate JWT token
    const token = generateToken(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        ethereumAddress: user.ethereumAddress,
      },
      environment.JWT_SECRET,
      environment.JWT_EXPIRES_IN
    );

    return {
      user: user.toSafeObject(),
      token,
    };
  }

  /**
   * Authenticates user credentials and generates access token.
   */
  async login({ email, password, ipAddress, userAgent }) {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Find user by email (explicitly selecting passwordHash)
    const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

    if (!user) {
      await AuditEvent.create({
        eventType: "AUTH_LOGIN_FAILURE",
        actorRole: "ANONYMOUS",
        ipAddress: ipAddress || null,
        status: "FAILURE",
        metadata: { attemptedEmail: normalizedEmail, reason: "USER_NOT_FOUND" },
      }).catch(() => {});

      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      error.errorCode = "INVALID_CREDENTIALS";
      throw error;
    }

    // 2. Check if account is active
    if (!user.isActive) {
      const error = new Error("Your account has been deactivated. Please contact administrator.");
      error.statusCode = 403;
      error.errorCode = "ACCOUNT_DEACTIVATED";
      throw error;
    }

    // 3. Verify password hash
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      await AuditEvent.create({
        eventType: "AUTH_LOGIN_FAILURE",
        actorId: user._id,
        actorRole: user.role,
        ipAddress: ipAddress || null,
        status: "FAILURE",
        metadata: { email: user.email, reason: "INVALID_PASSWORD" },
      }).catch(() => {});

      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      error.errorCode = "INVALID_CREDENTIALS";
      throw error;
    }

    // 4. Record successful login audit
    await AuditEvent.create({
      eventType: "AUTH_LOGIN_SUCCESS",
      actorId: user._id,
      actorRole: user.role,
      targetId: user._id.toString(),
      targetType: "USER",
      ipAddress: ipAddress || null,
      status: "SUCCESS",
      metadata: { email: user.email, role: user.role, userAgent },
    }).catch(() => {});

    // 5. Generate JWT token
    const token = generateToken(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        ethereumAddress: user.ethereumAddress,
      },
      environment.JWT_SECRET,
      environment.JWT_EXPIRES_IN
    );

    return {
      user: user.toSafeObject(),
      token,
    };
  }

  /**
   * Retrieves profile of current user.
   */
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error("User profile not found");
      error.statusCode = 404;
      error.errorCode = "USER_NOT_FOUND";
      throw error;
    }
    return user.toSafeObject();
  }
}

module.exports = new AuthService();
