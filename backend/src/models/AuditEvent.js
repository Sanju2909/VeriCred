const mongoose = require("mongoose");

const AUDIT_EVENT_TYPES = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAILURE",
  "AUTH_REGISTER",
  "AUTH_LOGOUT",
  "ISSUER_REGISTERED",
  "ISSUER_SUSPENDED",
  "ISSUER_REACTIVATED",
  "CREDENTIAL_ISSUED",
  "CREDENTIAL_REVOKED",
  "VERIFICATION_ATTEMPT",
];

const auditEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: AUDIT_EVENT_TYPES,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: "ANONYMOUS",
    },
    targetId: {
      type: String,
      default: null,
    },
    targetType: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      default: "SUCCESS",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// TTL index to automatically prune audit events after 1 year if desired
auditEventSchema.index({ timestamp: -1 });

const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);

module.exports = {
  AuditEvent,
  AUDIT_EVENT_TYPES,
};

