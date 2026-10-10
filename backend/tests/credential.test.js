const request = require("supertest");
const { expect } = require("chai");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const { connectDB, disconnectDB } = require("../src/config/db");
const { User, ROLES } = require("../src/models/User");
const { IssuerProfile } = require("../src/models/IssuerProfile");
const { Credential, CREDENTIAL_STATUS } = require("../src/models/Credential");
const { AuditEvent } = require("../src/models/AuditEvent");
const { hashPassword } = require("../src/utils/passwordUtils");
const keyManagerService = require("../src/services/keyManagerService");
const cryptoService = require("../src/services/cryptoService");

describe("Credential Issuance, Verification & Lifecycle API", function () {
  this.timeout(25000);

  let mongoServer;
  let adminToken, issuerToken, holderToken, unauthorizedHolderToken;
  let adminUser, issuerUser, holderUser, unauthorizedHolderUser;
  let issuerKeypair;
  let issuedCredentialId;
  let issuedCredentialRaw;

  before(async function () {
    // 1. In-memory Mongo setup
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    // 2. Setup test keys
    issuerKeypair = cryptoService.generateKeyPair();
    keyManagerService.registerIssuerKey(issuerKeypair.address, issuerKeypair.privateKey);

    // 3. Create Admin user
    const adminPass = await hashPassword("AdminPass123!");
    adminUser = await User.create({
      name: "Platform Admin",
      email: "admin@platform.test",
      passwordHash: adminPass,
      role: ROLES.ADMIN,
      isActive: true,
      isVerified: true,
    });

    // 4. Create Issuer user & Profile
    const issuerPass = await hashPassword("IssuerPass123!");
    issuerUser = await User.create({
      name: "National Tech University",
      email: "registrar@ntech.edu",
      passwordHash: issuerPass,
      role: ROLES.ISSUER,
      ethereumAddress: issuerKeypair.address.toLowerCase(),
      did: issuerKeypair.did,
      isActive: true,
      isVerified: true,
    });

    await IssuerProfile.create({
      userId: issuerUser._id,
      institutionName: "National Tech University",
      did: issuerKeypair.did,
      issuerAddress: issuerKeypair.address.toLowerCase(),
      isApprovedOnChain: true,
    });

    // 5. Create Holder user (Alice)
    const holderPass = await hashPassword("HolderPass123!");
    holderUser = await User.create({
      name: "Alice Holder",
      email: "alice@student.test",
      passwordHash: holderPass,
      role: ROLES.HOLDER,
      isActive: true,
      isVerified: true,
    });

    // 6. Create Another Holder user (Eve)
    unauthorizedHolderUser = await User.create({
      name: "Eve Unauthorized",
      email: "eve@student.test",
      passwordHash: holderPass,
      role: ROLES.HOLDER,
      isActive: true,
      isVerified: true,
    });

    // 7. Obtain tokens via login
    const resAdmin = await request(app).post("/api/auth/login").send({ email: "admin@platform.test", password: "AdminPass123!" });
    adminToken = resAdmin.body.data.token;

    const resIssuer = await request(app).post("/api/auth/login").send({ email: "registrar@ntech.edu", password: "IssuerPass123!" });
    issuerToken = resIssuer.body.data.token;

    const resHolder = await request(app).post("/api/auth/login").send({ email: "alice@student.test", password: "HolderPass123!" });
    holderToken = resHolder.body.data.token;

    const resEve = await request(app).post("/api/auth/login").send({ email: "eve@student.test", password: "HolderPass123!" });
    unauthorizedHolderToken = resEve.body.data.token;
  });

  after(async function () {
    await disconnectDB();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // =========================================================================
  // 1. Credential Issuance Tests
  // =========================================================================
  describe("POST /api/credentials (Issuance)", function () {
    it("should allow approved ISSUER to issue and digitally sign a credential", async function () {
      const payload = {
        title: "Bachelor of Science in Computer Science",
        holderName: "Alice Holder",
        holderEmail: "alice@student.test",
        claims: {
          degree: "B.Sc. Computer Science",
          major: "Software Engineering",
          gpa: "3.92",
          graduationYear: 2026,
        },
      };

      const res = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send(payload);

      expect(res.status).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property("credential");
      expect(res.body.data).to.have.property("record");

      const cred = res.body.data.credential;
      expect(cred).to.have.property("proof");
      expect(cred.proof.type).to.equal("EcdsaSecp256k1Signature2019");
      expect(cred.credentialSubject.name).to.equal("Alice Holder");

      issuedCredentialId = res.body.data.record.credentialId;
      issuedCredentialRaw = cred;
    });

    it("should prevent unauthorized HOLDER from issuing credentials", async function () {
      const payload = {
        title: "Fraudulent Degree",
        holderName: "Eve",
      };

      const res = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${holderToken}`)
        .send(payload);

      expect(res.status).to.equal(403);
      expect(res.body.error.code).to.equal("FORBIDDEN");
    });

    it("should validate required fields during issuance", async function () {
      const res = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({}); // Missing title and holderName

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });
  });

  // =========================================================================
  // 2. Querying and Access Control Tests
  // =========================================================================
  describe("GET /api/credentials (Queries & Access Control)", function () {
    it("should allow recipient HOLDER to view their own credentials", async function () {
      const res = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${holderToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.credentials.length).to.equal(1);
      expect(res.body.data.credentials[0].credentialId).to.equal(issuedCredentialId);
    });

    it("should prevent unauthorized HOLDER (Eve) from accessing Alice's credential (IDOR protection)", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${unauthorizedHolderToken}`);

      expect(res.status).to.equal(403);
      expect(res.body.error.code).to.equal("FORBIDDEN");
    });

    it("should allow issuing ISSUER to view the credential by ID", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${issuerToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.credentialId).to.equal(issuedCredentialId);
    });

    it("should allow platform ADMIN to view any credential by ID", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.credentialId).to.equal(issuedCredentialId);
    });
  });

  // =========================================================================
  // 3. Multi-tier Verification Tests
  // =========================================================================
  describe("POST /api/credentials/verify (Verification Portal)", function () {
    it("should successfully verify authentic signed credential payload", async function () {
      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
    });

    it("should fail verification when credential claim has been tampered with", async function () {
      const tampered = JSON.parse(JSON.stringify(issuedCredentialRaw));
      tampered.credentialSubject.gpa = "4.0"; // Alter GPA claim

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(tampered);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("INVALID_SIGNATURE");
    });
  });

  // =========================================================================
  // 4. Revocation Workflow Tests
  // =========================================================================
  describe("POST /api/credentials/:id/revoke (Revocation)", function () {
    it("should prevent unauthorized HOLDER from revoking a credential", async function () {
      const res = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${holderToken}`)
        .send({ reason: "Unauthorized attempt" });

      expect(res.status).to.equal(403);
    });

    it("should allow the issuing ISSUER to revoke their credential", async function () {
      const reason = "Administrative update to student academic records";
      const res = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({ reason });

      expect(res.status).to.equal(200);
      expect(res.body.data.isRevoked).to.be.true;
      expect(res.body.data.status).to.equal(CREDENTIAL_STATUS.REVOKED);
      expect(res.body.data.revocationReason).to.equal(reason);
    });

    it("should reject repeated revocation of an already revoked credential", async function () {
      const res = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({ reason: "Repeated revocation attempt" });

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("ALREADY_REVOKED");
    });
  });
});
