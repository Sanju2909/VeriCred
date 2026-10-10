const mongoose = require("mongoose");

const ROLES = {
  ADMIN: "ADMIN",
  ISSUER: "ISSUER",
  HOLDER: "HOLDER",
  VERIFIER: "VERIFIER",
};

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "User name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false, // Do not return passwordHash in standard queries
    },
    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: "Invalid role: {VALUE}. Must be ADMIN, ISSUER, HOLDER, or VERIFIER",
      },
      default: ROLES.HOLDER,
      required: true,
      index: true,
    },
    ethereumAddress: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      match: [/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum wallet address format"],
    },
    did: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Returns a sanitized user object without sensitive authentication fields.
 */
userSchema.methods.toSafeObject = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    ethereumAddress: this.ethereumAddress || null,
    did: this.did || null,
    isActive: this.isActive,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const User = mongoose.model("User", userSchema);

module.exports = {
  User,
  ROLES,
};

