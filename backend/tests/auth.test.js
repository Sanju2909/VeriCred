const request = require("supertest");
const { expect } = require("chai");
const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDB, disconnectDB } = require("../src/config/db");
const { User, ROLES } = require("../src/models/User");
const { hashPassword } = require("../src/utils/passwordUtils");

describe("Authentication & Authorization API", function () {
  this.timeout(25000);

  let mongoServer;
  let adminToken;
  let holderToken;
  let adminUser;

  const sampleHolder = {
    name: "Alice Student",
    email: "alice.student@example.com",
    password: "Password123!",
    role: "HOLDER",
    ethereumAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  };

  const sampleVerifier = {
    name: "Tech Corp HR",
    email: "hr@techcorp.com",
    password: "Password123!",
    role: "VERIFIER",
  };

  before(async function () {
    // Start isolated in-memory MongoDB instance for testing
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await connectDB(mongoUri);

    // Create an initial ADMIN user for RBAC testing
    const adminPasswordHash = await hashPassword("AdminPassword123!");
    adminUser = await User.create({
      name: "Master Admin",
      email: "master.admin@credentialplatform.local",
      passwordHash: adminPasswordHash,
      role: ROLES.ADMIN,
      isActive: true,
      isVerified: true,
    });
  });

  after(async function () {
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // =========================================================================
  // 1. User Registration & Input Validation Tests
  // =========================================================================
  describe("POST /api/auth/register", function () {
    it("should register a new HOLDER user with hashed password and DID", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send(sampleHolder);

      expect(res.status).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property("token");
      expect(res.body.data).to.have.property("user");
      expect(res.body.data.user.email).to.equal(sampleHolder.email.toLowerCase());
      expect(res.body.data.user.role).to.equal(ROLES.HOLDER);
      expect(res.body.data.user).to.have.property("did");
      expect(res.body.data.user).to.not.have.property("passwordHash");

      // Verify in DB that password is truly hashed with bcrypt
      const dbUser = await User.findOne({ email: sampleHolder.email.toLowerCase() }).select("+passwordHash");
      expect(dbUser.passwordHash).to.not.equal(sampleHolder.password);
      expect(dbUser.passwordHash).to.match(/^\$2[aby]\$\d+\$/); // bcrypt hash format

      holderToken = res.body.data.token;
    });

    it("should register a new VERIFIER user successfully", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send(sampleVerifier);

      expect(res.status).to.equal(201);
      expect(res.body.data.user.role).to.equal(ROLES.VERIFIER);
    });

    it("should reject duplicate email registration with 409 Conflict", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send(sampleHolder);

      expect(res.status).to.equal(409);
      expect(res.body.success).to.be.false;
      expect(res.body.error.code).to.equal("DUPLICATE_EMAIL");
    });

    it("should reject registration with invalid email format", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Invalid Email User",
          email: "not-an-email",
          password: "Password123!",
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should reject registration with short/weak password", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Weak Password User",
          email: "weak@example.com",
          password: "123", // Too short and missing letters
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should prevent privilege escalation: rejecting public registration with ADMIN role", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Attacker",
          email: "attacker@example.com",
          password: "Password123!",
          role: "ADMIN",
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
      expect(res.body.error.details[0].message).to.include("Privilege escalation forbidden");
    });

    it("should prevent privilege escalation: rejecting public registration with ISSUER role", async function () {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Fake Issuer",
          email: "fakeissuer@example.com",
          password: "Password123!",
          role: "ISSUER",
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
      expect(res.body.error.details[0].message).to.include("Privilege escalation forbidden");
    });
  });

  // =========================================================================
  // 2. User Login & Token Issuance Tests
  // =========================================================================
  describe("POST /api/auth/login", function () {
    it("should authenticate valid user credentials and return JWT token", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: sampleHolder.email,
          password: sampleHolder.password,
        });

      expect(res.status).to.equal(200);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property("token");
      expect(res.body.data.user.email).to.equal(sampleHolder.email.toLowerCase());
    });

    it("should log in ADMIN user and store admin token for RBAC tests", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "master.admin@credentialplatform.local",
          password: "AdminPassword123!",
        });

      expect(res.status).to.equal(200);
      expect(res.body.data.user.role).to.equal(ROLES.ADMIN);
      adminToken = res.body.data.token;
    });

    it("should reject login with wrong password", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: sampleHolder.email,
          password: "IncorrectPassword123!",
        });

      expect(res.status).to.equal(401);
      expect(res.body.error.code).to.equal("INVALID_CREDENTIALS");
    });

    it("should reject login for nonexistent email", async function () {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "ghost@example.com",
          password: "Password123!",
        });

      expect(res.status).to.equal(401);
      expect(res.body.error.code).to.equal("INVALID_CREDENTIALS");
    });
  });

  // =========================================================================
  // 3. Protected Routes & Authentication Middleware Tests
  // =========================================================================
  describe("GET /api/auth/me", function () {
    it("should retrieve profile when valid token is provided", async function () {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${holderToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.email).to.equal(sampleHolder.email.toLowerCase());
      expect(res.body.data.role).to.equal(ROLES.HOLDER);
    });

    it("should reject request when Authorization header is missing", async function () {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).to.equal(401);
      expect(res.body.error.code).to.equal("UNAUTHORIZED");
    });

    it("should reject request when token is malformed", async function () {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid.token.payload");

      expect(res.status).to.equal(401);
      expect(res.body.error.code).to.equal("INVALID_TOKEN");
    });
  });

  // =========================================================================
  // 4. Role-Based Access Control (RBAC) Tests
  // =========================================================================
  describe("Role-Based Authorization (RBAC)", function () {
    it("should allow ADMIN to list users on GET /api/users", async function () {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.property("users");
      expect(res.body.data.users.length).to.be.greaterThan(0);
    });

    it("should FORBID HOLDER from accessing ADMIN-only GET /api/users", async function () {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${holderToken}`);

      expect(res.status).to.equal(403);
      expect(res.body.error.code).to.equal("FORBIDDEN");
      expect(res.body.error.message).to.include("Access denied");
    });
  });

  // =========================================================================
  // 5. Logout Test
  // =========================================================================
  describe("POST /api/auth/logout", function () {
    it("should successfully acknowledge logout", async function () {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${holderToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.message).to.include("logged out");
    });
  });
});
