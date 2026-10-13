process.env.NODE_ENV = "test";
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
const blockchainService = require("../src/services/blockchainService");

describe("Credential Issuance, Verification & Lifecycle API", function () {
  this.timeout(120000);

  let mongoServer;
  let adminToken, issuerToken, holderToken, unauthorizedHolderToken, verifierToken;
  let adminUser, issuerUser, holderUser, unauthorizedHolderUser, verifierUser;
  let issuerKeypair;
  let issuedCredentialId;
  let issuedCredentialRaw;
  let originalVerifyCredential;
  let mockVerifyValid;

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

    // 7. Create Verifier user
    const verifierPass = await hashPassword("VerifierPass123!");
    verifierUser = await User.create({
      name: "Corporate Verifier",
      email: "verifier@company.test",
      passwordHash: verifierPass,
      role: ROLES.VERIFIER,
      isActive: true,
      isVerified: true,
    });

    // 8. Obtain tokens via login
    const resAdmin = await request(app).post("/api/auth/login").send({ email: "admin@platform.test", password: "AdminPass123!" });
    adminToken = resAdmin.body.data.token;

    const resIssuer = await request(app).post("/api/auth/login").send({ email: "registrar@ntech.edu", password: "IssuerPass123!" });
    issuerToken = resIssuer.body.data.token;

    const resHolder = await request(app).post("/api/auth/login").send({ email: "alice@student.test", password: "HolderPass123!" });
    holderToken = resHolder.body.data.token;

    const resEve = await request(app).post("/api/auth/login").send({ email: "eve@student.test", password: "HolderPass123!" });
    unauthorizedHolderToken = resEve.body.data.token;

    const resVerifier = await request(app).post("/api/auth/login").send({ email: "verifier@company.test", password: "VerifierPass123!" });
    verifierToken = resVerifier.body.data.token;

    // 8. Setup default on-chain verification mock for isolated integration tests
    originalVerifyCredential = blockchainService.verifyCredential.bind(blockchainService);
    mockVerifyValid = async () => ({
      isValid: true,
      statusCode: "VALID",
      statusMessage: "Credential is valid, authentic, and active",
    });
    blockchainService.verifyCredential = mockVerifyValid;
  });

  after(async function () {
    if (originalVerifyCredential) {
      blockchainService.verifyCredential = originalVerifyCredential;
    }
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
  // 2. Querying and Access Control Tests (Student Vault & IDOR Isolation)
  // =========================================================================
  describe("GET /api/credentials (Queries & Access Control)", function () {
    let studentBCredentialId;

    before(async function () {
      // Issue a dedicated credential for Student B (Eve) to test multi-student vault isolation
      const res = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({
          title: "Bachelor of Arts in Digital Media",
          holderName: "Eve Unauthorized",
          holderEmail: "eve@student.test",
          claims: { major: "Digital Media", graduationYear: 2026 },
        });

      expect(res.status).to.equal(201);
      studentBCredentialId = res.body.data.record.credentialId;
    });

    it("should reject unauthenticated request to GET /api/credentials with 401 UNAUTHORIZED", async function () {
      const res = await request(app).get("/api/credentials");
      expect(res.status).to.equal(401);
      expect(res.body.error.code).to.equal("UNAUTHORIZED");
    });

    it("should reject unauthenticated request to GET /api/credentials/:id with 401 UNAUTHORIZED", async function () {
      const res = await request(app).get(`/api/credentials/${issuedCredentialId}`);
      expect(res.status).to.equal(401);
      expect(res.body.error.code).to.equal("UNAUTHORIZED");
    });

    it("should allow recipient HOLDER (Alice) to view their own credentials list and detail", async function () {
      // 1. List query
      const resList = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${holderToken}`);

      expect(resList.status).to.equal(200);
      expect(resList.body.data.credentials.length).to.equal(1);
      expect(resList.body.data.credentials[0].credentialId).to.equal(issuedCredentialId);

      // 2. Detail query
      const resDetail = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${holderToken}`);

      expect(resDetail.status).to.equal(200);
      expect(resDetail.body.data.credentialId).to.equal(issuedCredentialId);
      expect(resDetail.body.data.holderEmail).to.equal("alice@student.test");
    });

    it("should strictly isolate Student A and Student B credential vaults with zero data bleeding", async function () {
      // Student A (Alice) queries vault
      const aliceRes = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${holderToken}`);

      expect(aliceRes.status).to.equal(200);
      expect(aliceRes.body.data.credentials.length).to.equal(1);
      expect(aliceRes.body.data.credentials[0].credentialId).to.equal(issuedCredentialId);
      expect(aliceRes.body.data.credentials.some(c => c.credentialId === studentBCredentialId)).to.be.false;
      expect(aliceRes.body.data.credentials.every(c => c.holderEmail === "alice@student.test")).to.be.true;

      // Student B (Eve) queries vault
      const eveRes = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${unauthorizedHolderToken}`);

      expect(eveRes.status).to.equal(200);
      expect(eveRes.body.data.credentials.length).to.equal(1);
      expect(eveRes.body.data.credentials[0].credentialId).to.equal(studentBCredentialId);
      expect(eveRes.body.data.credentials.some(c => c.credentialId === issuedCredentialId)).to.be.false;
      expect(eveRes.body.data.credentials.every(c => c.holderEmail === "eve@student.test")).to.be.true;
    });

    it("should prevent unauthorized HOLDER (Eve) from accessing Alice's credential (IDOR protection)", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${unauthorizedHolderToken}`);

      expect(res.status).to.equal(403);
      expect(res.body.error.code).to.equal("FORBIDDEN");
    });

    it("should enforce bi-directional IDOR protection on GET /api/credentials/:id between Student A and Student B", async function () {
      // 1. Student B attempts to access Student A's credential by ID -> 403 FORBIDDEN
      const eveAttemptsAlice = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${unauthorizedHolderToken}`);

      expect(eveAttemptsAlice.status).to.equal(403);
      expect(eveAttemptsAlice.body.error.code).to.equal("FORBIDDEN");

      // 2. Student A attempts to access Student B's credential by ID -> 403 FORBIDDEN
      const aliceAttemptsEve = await request(app)
        .get(`/api/credentials/${studentBCredentialId}`)
        .set("Authorization", `Bearer ${holderToken}`);

      expect(aliceAttemptsEve.status).to.equal(403);
      expect(aliceAttemptsEve.body.error.code).to.equal("FORBIDDEN");

      // 3. Student A can access Student A's credential -> 200
      const aliceViewsAlice = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${holderToken}`);

      expect(aliceViewsAlice.status).to.equal(200);
      expect(aliceViewsAlice.body.data.credentialId).to.equal(issuedCredentialId);

      // 4. Student B can access Student B's credential -> 200
      const eveViewsEve = await request(app)
        .get(`/api/credentials/${studentBCredentialId}`)
        .set("Authorization", `Bearer ${unauthorizedHolderToken}`);

      expect(eveViewsEve.status).to.equal(200);
      expect(eveViewsEve.body.data.credentialId).to.equal(studentBCredentialId);
    });

    it("should allow a recipient whose credential was issued prior to account creation to log in and access their credential in the vault", async function () {
      const recipientEmail = "test.student.demo@example.com";
      const recipientPassword = "StudentPassword123!";

      // 1. Prior to account registration, login attempt for this recipient fails with 401 INVALID_CREDENTIALS
      const preLoginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: recipientEmail, password: recipientPassword });
      expect(preLoginRes.status).to.equal(401);
      expect(preLoginRes.body.error.code).to.equal("INVALID_CREDENTIALS");

      // 2. Issuer issues a credential to this unregistered student recipient email
      const issueRes = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({
          title: "Bachelor of Technology in Information Technology",
          holderName: "Test Student Demo",
          holderEmail: recipientEmail,
          claims: {
            department: "Information Technology",
            degree: "B.Tech IT",
            graduationYear: 2026,
          },
        });
      expect(issueRes.status).to.equal(201);
      const preIssuedCredId = issueRes.body.data.record.credentialId;

      // 3. Credential is immediately verifiable publicly even before student registers
      const verifyRes = await request(app)
        .get(`/api/credentials/${preIssuedCredId}/verify`);
      expect(verifyRes.status).to.equal(200);
      expect(verifyRes.body.data.isValid).to.be.true;

      // 4. Student subsequently registers / provisions their account
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test Student Demo",
          email: recipientEmail,
          password: recipientPassword,
          role: "HOLDER",
        });
      expect(registerRes.status).to.equal(201);
      const testStudentToken = registerRes.body.data.token;

      // 5. Student logs in and accesses their Student Vault
      const vaultRes = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${testStudentToken}`);
      expect(vaultRes.status).to.equal(200);
      expect(vaultRes.body.data.credentials.length).to.be.greaterThan(0);
      const matched = vaultRes.body.data.credentials.find(c => c.credentialId === preIssuedCredId);
      expect(matched).to.exist;
      expect(matched.holderEmail).to.equal(recipientEmail);
      expect(matched.title).to.equal("Bachelor of Technology in Information Technology");

      // 6. Student can access single credential detail
      const detailRes = await request(app)
        .get(`/api/credentials/${preIssuedCredId}`)
        .set("Authorization", `Bearer ${testStudentToken}`);
      expect(detailRes.status).to.equal(200);
      expect(detailRes.body.data.credentialId).to.equal(preIssuedCredId);
      expect(detailRes.body.data.holderEmail).to.equal(recipientEmail);

      // 7. Other students (e.g., Alice) cannot access this credential (IDOR protection)
      const unauthorizedRes = await request(app)
        .get(`/api/credentials/${preIssuedCredId}`)
        .set("Authorization", `Bearer ${holderToken}`);
      expect(unauthorizedRes.status).to.equal(403);
      expect(unauthorizedRes.body.error.code).to.equal("FORBIDDEN");
    });

    it("should return empty credentials array for VERIFIER role on GET /api/credentials", async function () {
      const res = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${verifierToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.credentials).to.be.an("array").that.is.empty;
      expect(res.body.data.pagination.total).to.equal(0);
    });

    it("should prevent VERIFIER role from accessing private credential detail on GET /api/credentials/:id", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${verifierToken}`);

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

    it("should allow public unauthenticated verification by ID without leaking student PII or database IDs", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}/verify`);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.status).to.equal("VALID");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.issuer.name).to.equal("National Tech University");
      expect(res.body.data.credentialId).to.equal(issuedCredentialId);

      // Verify absence of sensitive PII & internal DB fields
      expect(res.body.data).to.not.have.property("_id");
      expect(res.body.data).to.not.have.property("holderId");
      expect(res.body.data).to.not.have.property("holderEmail");
      expect(res.body.data).to.not.have.property("holderName");
      expect(res.body.data).to.not.have.property("credentialSubject");
      expect(res.body.data).to.not.have.property("claims");
      expect(res.body.data).to.not.have.property("createdAt");
      expect(res.body.data).to.not.have.property("updatedAt");
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
      expect(res.body.data.checks.notRevoked).to.be.true;
      expect(res.body.data.checks.notExpired).to.be.true;
      expect(res.body.data.verifiedAt).to.be.a("string");
      expect(new Date(res.body.data.verifiedAt).getTime()).to.not.be.NaN;
    });

    it("should successfully verify credential by ID retaining issuer.name during reconstruction", async function () {
      const res = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/verify`)
        .send({});

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.status).to.equal("VALID");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.notRevoked).to.be.true;
      expect(res.body.data.issuer.name).to.equal("National Tech University");
      expect(res.body.data.verifiedAt).to.be.a("string");
    });

    it("should support GET /api/credentials/:id/verify for public verification by ID", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}/verify`);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.checks.signatureValid).to.be.true;
    });

    it("should fail verification when credential claim has been tampered with and return consistent checks schema", async function () {
      const tampered = JSON.parse(JSON.stringify(issuedCredentialRaw));
      tampered.credentialSubject.gpa = "4.0"; // Alter GPA claim

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(tampered);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("INVALID_SIGNATURE");
      expect(res.body.data.checks).to.have.property("signatureValid", false);
      expect(res.body.data.checks).to.have.property("hashMatchesFingerprint", false);
      expect(res.body.data.checks).to.have.property("issuerAuthorized", false);
      expect(res.body.data.checks).to.have.property("notRevoked", false);
      expect(res.body.data.checks).to.have.property("notExpired", false);
      expect(res.body.data.checks).to.have.property("onChainVerified", false);
      expect(res.body.data.verifiedAt).to.be.a("string");
      expect(new Date(res.body.data.verifiedAt).getTime()).to.not.be.NaN;
    });

    it("should reject verification of a credential payload with a past expiration date", async function () {
      const expiredPayload = {
        "@context": [
          "https://www.w3.org/2018/credentials/v1",
          "https://schema.org",
        ],
        id: "urn:uuid:expired-cred-test-001",
        type: ["VerifiableCredential", "AcademicDegreeCredential"],
        issuer: {
          id: issuerKeypair.did,
          name: "National Tech University",
          ethereumAddress: issuerKeypair.address.toLowerCase(),
        },
        issuanceDate: new Date(Date.now() - 30 * 86400000).toISOString(),
        expirationDate: new Date(Date.now() - 86400000).toISOString(), // Expired 1 day ago
        credentialSubject: {
          name: "Alice Holder",
          degree: "B.Sc. Computer Science",
        },
      };

      const signedExpired = await cryptoService.signCredential(
        expiredPayload,
        issuerKeypair.privateKey,
        issuerKeypair.did
      );

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(signedExpired);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_EXPIRED");
      expect(res.body.data.message).to.equal("Credential has passed its expiration date");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.notExpired).to.be.false;
      expect(res.body.data.checks.notRevoked).to.be.false;
      expect(res.body.data.verifiedAt).to.be.a("string");
      expect(new Date(res.body.data.verifiedAt).getTime()).to.not.be.NaN;
    });

    it("should reject verification by ID when stored credential has expired", async function () {
      const issueRes = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({
          title: "Expired Certificate",
          holderName: "Alice Holder",
          holderEmail: "alice@student.test",
          expirationDate: new Date(Date.now() - 3600000).toISOString(), // 1 hour in the past
          claims: { certificate: "Short Course Completion" },
        });

      expect(issueRes.status).to.equal(201);
      const expiredCredId = issueRes.body.data.record.credentialId;

      const verifyRes = await request(app)
        .get(`/api/credentials/${expiredCredId}/verify`);

      expect(verifyRes.status).to.equal(200);
      expect(verifyRes.body.data.isValid).to.be.false;
      expect(verifyRes.body.data.status).to.equal("CREDENTIAL_EXPIRED");
      expect(verifyRes.body.data.checks.notExpired).to.be.false;
      expect(verifyRes.body.data.checks.signatureValid).to.be.true;
    });

    it("should successfully verify credential with a valid future expiration date", async function () {
      const futureExpiry = new Date(Date.now() + 365 * 86400000).toISOString(); // 1 year in future
      const issueRes = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({
          title: "Master of Science in Cybersecurity",
          holderName: "Alice Holder",
          holderEmail: "alice@student.test",
          expirationDate: futureExpiry,
          claims: { degree: "M.Sc. Cybersecurity", gpa: "3.98" },
        });

      expect(issueRes.status).to.equal(201);
      const futureCredId = issueRes.body.data.record.credentialId;
      const futureCredRaw = issueRes.body.data.credential;

      // 1. Verify via raw JSON payload
      const verifyJsonRes = await request(app)
        .post("/api/credentials/verify")
        .send(futureCredRaw);

      expect(verifyJsonRes.status).to.equal(200);
      expect(verifyJsonRes.body.data.isValid).to.be.true;
      expect(verifyJsonRes.body.data.status).to.equal("VALID");
      expect(verifyJsonRes.body.data.checks.signatureValid).to.be.true;
      expect(verifyJsonRes.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(verifyJsonRes.body.data.checks.notExpired).to.be.true;
      expect(verifyJsonRes.body.data.checks.notRevoked).to.be.true;

      // 2. Verify via ID lookup
      const verifyIdRes = await request(app)
        .get(`/api/credentials/${futureCredId}/verify`);

      expect(verifyIdRes.status).to.equal(200);
      expect(verifyIdRes.body.data.isValid).to.be.true;
      expect(verifyIdRes.body.data.status).to.equal("VALID");
      expect(verifyIdRes.body.data.checks.notExpired).to.be.true;
    });

    it("should fail verification when on-chain query returns BLOCKCHAIN_QUERY_ERROR and not silently pass", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "BLOCKCHAIN_QUERY_ERROR",
        statusMessage: "Unable to verify with blockchain node: connect ECONNREFUSED 127.0.0.1:8545",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("BLOCKCHAIN_QUERY_ERROR");
      expect(res.body.data.checks.onChainVerified).to.be.false;
      expect(res.body.data.checks.signatureValid).to.be.true;

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when credential is not anchored on-chain (CREDENTIAL_NOT_FOUND) and not silently pass", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "CREDENTIAL_NOT_FOUND",
        statusMessage: "Credential not found in registry",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_NOT_FOUND");
      expect(res.body.data.checks.onChainVerified).to.be.false;
      expect(res.body.data.checks.signatureValid).to.be.true;

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when on-chain fingerprint does not match payload (HASH_MISMATCH) and report checks accurately", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "HASH_MISMATCH",
        statusMessage: "Credential content hash does not match on-chain fingerprint",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("HASH_MISMATCH");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.false;
      expect(res.body.data.checks.issuerAuthorized).to.be.false;
      expect(res.body.data.checks.notRevoked).to.be.false;
      expect(res.body.data.checks.notExpired).to.be.false;
      expect(res.body.data.checks.onChainVerified).to.be.false;

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when issuing institution is suspended on-chain (ISSUER_SUSPENDED) without falsifying other checks", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "ISSUER_SUSPENDED",
        statusMessage: "Issuing institution is suspended or unauthorized",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("ISSUER_SUSPENDED");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.issuerAuthorized).to.be.false;
      expect(res.body.data.checks.notRevoked).to.be.true;
      expect(res.body.data.checks.notExpired).to.be.true;
      expect(res.body.data.checks.onChainVerified).to.be.false;

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when credential is confirmed revoked on-chain (CREDENTIAL_REVOKED) and mark notRevoked false", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "CREDENTIAL_REVOKED",
        statusMessage: "Credential has been revoked",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_REVOKED");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.issuerAuthorized).to.be.false;
      expect(res.body.data.checks.notRevoked).to.be.false;
      expect(res.body.data.checks.notExpired).to.be.true;
      expect(res.body.data.checks.onChainVerified).to.be.false;

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when credential is confirmed expired on-chain (CREDENTIAL_EXPIRED) and mark notExpired false", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "CREDENTIAL_EXPIRED",
        statusMessage: "Credential has expired",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_EXPIRED");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.issuerAuthorized).to.be.false;
      expect(res.body.data.checks.notRevoked).to.be.true;
      expect(res.body.data.checks.notExpired).to.be.false;
      expect(res.body.data.checks.onChainVerified).to.be.false;

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should ensure strict consistency between all individual check flags, isValid, and status", async function () {
      // 1. Fully valid credential
      const validRes = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(validRes.status).to.equal(200);
      const { checks, isValid, status } = validRes.body.data;
      const allChecksPassed = (
        checks.signatureValid &&
        checks.hashMatchesFingerprint &&
        checks.issuerAuthorized &&
        checks.notRevoked &&
        checks.notExpired &&
        checks.onChainVerified
      );
      expect(isValid).to.equal(allChecksPassed);
      expect(isValid).to.be.true;
      expect(status).to.equal("VALID");

      // 2. Any failing check forces isValid to false and status != VALID
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "CREDENTIAL_NOT_FOUND",
        statusMessage: "Credential not found in registry",
      });

      const invalidRes = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialRaw);

      expect(invalidRes.status).to.equal(200);
      const invData = invalidRes.body.data;
      const invChecksPassed = (
        invData.checks.signatureValid &&
        invData.checks.hashMatchesFingerprint &&
        invData.checks.issuerAuthorized &&
        invData.checks.notRevoked &&
        invData.checks.notExpired &&
        invData.checks.onChainVerified
      );
      expect(invData.isValid).to.equal(invChecksPassed);
      expect(invData.isValid).to.be.false;
      expect(invData.status).to.not.equal("VALID");

      // Restore default valid mock
      blockchainService.verifyCredential = mockVerifyValid;
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

    it("should prevent a different ISSUER from revoking the credential", async function () {
      const otherIssuerKeypair = cryptoService.generateKeyPair();
      keyManagerService.registerIssuerKey(otherIssuerKeypair.address, otherIssuerKeypair.privateKey);

      const otherIssuerPass = await hashPassword("OtherIssuerPass123!");
      const otherIssuer = await User.create({
        name: "State Tech College",
        email: "registrar@statetech.edu",
        passwordHash: otherIssuerPass,
        role: ROLES.ISSUER,
        ethereumAddress: otherIssuerKeypair.address.toLowerCase(),
        did: otherIssuerKeypair.did,
        isActive: true,
        isVerified: true,
      });

      await IssuerProfile.create({
        userId: otherIssuer._id,
        institutionName: "State Tech College",
        did: otherIssuerKeypair.did,
        issuerAddress: otherIssuerKeypair.address.toLowerCase(),
        isApprovedOnChain: true,
      });

      const resLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "registrar@statetech.edu", password: "OtherIssuerPass123!" });
      const otherIssuerToken = resLogin.body.data.token;

      const res = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${otherIssuerToken}`)
        .send({ reason: "Unauthorized cross-issuer revocation attempt" });

      expect(res.status).to.equal(403);
      expect(res.body.error.code).to.equal("UNAUTHORIZED_REVOCATION");
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

    it("should revoke a dedicated credential and report CREDENTIAL_REVOKED upon subsequent ID verification", async function () {
      // 1. Issue a dedicated test credential
      const issueRes = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({
          title: "Certificate of Completion for Revocation Test",
          holderName: "Alice Holder",
          holderEmail: "alice@student.test",
          claims: { course: "Decentralized Systems", completionDate: "2026-05-01" },
        });

      expect(issueRes.status).to.equal(201);
      const dedicatedCredId = issueRes.body.data.record.credentialId;

      // 2. Revoke the dedicated credential
      const reason = "Administrative revocation for student transfer";
      const revokeRes = await request(app)
        .post(`/api/credentials/${dedicatedCredId}/revoke`)
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({ reason });

      expect(revokeRes.status).to.equal(200);
      expect(revokeRes.body.data.isRevoked).to.be.true;
      expect(revokeRes.body.data.status).to.equal(CREDENTIAL_STATUS.REVOKED);
      expect(revokeRes.body.data.revocationReason).to.equal(reason);

      // 3. Verify the revoked credential by ID
      const verifyRes = await request(app)
        .get(`/api/credentials/${dedicatedCredId}/verify`);

      expect(verifyRes.status).to.equal(200);
      expect(verifyRes.body.data.isValid).to.be.false;
      expect(verifyRes.body.data.status).to.equal("CREDENTIAL_REVOKED");
      expect(verifyRes.body.data.checks.notRevoked).to.be.false;
    });
  });
});
