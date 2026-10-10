const mongoose = require("mongoose");

const CREDENTIAL_STATUS = {
  ISSUED: "ISSUED",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED",
};

const credentialSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      required: [true, "Credential identifier is required"],
      unique: true,
      trim: true,
      index: true,
    },
    credentialHash: {
      type: String,
      required: [true, "Cryptographic integrity hash is required"],
      trim: true,
      index: true,
    },
    issuerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    issuerProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IssuerProfile",
      index: true,
    },
    issuerAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    issuerDid: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    holderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    holderDid: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    holderName: {
      type: String,
      trim: true,
      required: true,
    },
    holderEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    credentialType: {
      type: [String],
      default: ["VerifiableCredential", "AcademicDegreeCredential"],
    },
    title: {
      type: String,
      required: [true, "Credential title is required"],
      trim: true,
    },
    claims: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Credential subject claims payload is required"],
    },
    issuanceDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expirationDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(CREDENTIAL_STATUS),
      default: CREDENTIAL_STATUS.ISSUED,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revocationReason: {
      type: String,
      default: null,
    },
    revocationDate: {
      type: Date,
      default: null,
    },
    onChainTxHash: {
      type: String,
      trim: true,
      default: null,
    },
    blockNumber: {
      type: Number,
      default: null,
    },
    proof: {
      type: {
        type: String,
        default: "EcdsaSecp256k1Signature2019",
      },
      created: {
        type: Date,
        default: Date.now,
      },
      verificationMethod: {
        type: String,
      },
      proofPurpose: {
        type: String,
        default: "assertionMethod",
      },
      proofValue: {
        type: String, // ECDSA signature hex
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound index for querying a holder's active credentials
credentialSchema.index({ holderEmail: 1, status: 1 });
credentialSchema.index({ issuerId: 1, status: 1 });

const Credential = mongoose.model("Credential", credentialSchema);

module.exports = {
  Credential,
  CREDENTIAL_STATUS,
};

