const mongoose = require("mongoose");

const INSTITUTION_TYPES = [
  "UNIVERSITY",
  "COLLEGE",
  "ACADEMY",
  "CERTIFICATION_BODY",
  "GOVERNMENT",
  "OTHER",
];

const issuerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Associated user account is required"],
      unique: true,
      index: true,
    },
    institutionName: {
      type: String,
      required: [true, "Institution name is required"],
      trim: true,
      minlength: [2, "Institution name must be at least 2 characters"],
      maxlength: [150, "Institution name cannot exceed 150 characters"],
    },
    did: {
      type: String,
      required: [true, "Issuer Decentralized Identifier (DID) is required"],
      unique: true,
      trim: true,
      index: true,
    },
    issuerAddress: {
      type: String,
      required: [true, "Issuer Ethereum wallet address is required"],
      lowercase: true,
      trim: true,
      index: true,
      match: [/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"],
    },
    institutionType: {
      type: String,
      enum: INSTITUTION_TYPES,
      default: "UNIVERSITY",
    },
    website: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid contact email"],
    },
    isApprovedOnChain: {
      type: Boolean,
      default: false,
    },
    onChainRegistrationTx: {
      type: String,
      trim: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    suspendedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const IssuerProfile = mongoose.model("IssuerProfile", issuerProfileSchema);

module.exports = {
  IssuerProfile,
  INSTITUTION_TYPES,
};

