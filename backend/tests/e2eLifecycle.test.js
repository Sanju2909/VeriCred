process.env.NODE_ENV = "test";
const request = require("supertest");
const { expect } = require("chai");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const { connectDB, disconnectDB } = require("../src/config/db");
const { User, ROLES } = require("../src/models/User");
const { IssuerProfile } = require("../src/models/IssuerProfile");
const { Credential, CREDENTIAL_STATUS } = require("../src/models/Credential");
const { hashPassword } = require("../src/utils/passwordUtils");
const keyManagerService = require("../src/services/keyManagerService");
const cryptoService = require("../src/services/cryptoService");
const blockchainService = require("../src/services/blockchainService");

describe("Stage 7B.5: End-to-End Credential Lifecycle Integration Test Suite", function () {
  this.timeout(120000);

  let mongoServer;
  let issuerToken, studentToken, verifierToken, unauthorizedStudentToken, otherIssuerToken;
  let issuerUser, studentUser, verifierUser, unauthorizedStudentUser, otherIssuerUser;
  let issuerKeypair, otherIssuerKeypair;
  let originalVerifyCredential;
  let mockVerifyValid;
  let issuedCredentialId, issuedCredentialPayload;

  before(async function () {
    // 1. Isolated In-memory Mongo setup
    mongoServer = await MongoMemoryServer.create();
    await connectDB(mongoServer.getUri());

    // 2. Setup isolated cryptographic keys
    issuerKeypair = cryptoService.generateKeyPair();
    keyManagerService.registerIssuerKey(issuerKeypair.address, issuerKeypair.privateKey);

    otherIssuerKeypair = cryptoService.generateKeyPair();
    keyManagerService.registerIssuerKey(otherIssuerKeypair.address, otherIssuerKeypair.privateKey);

    // 3. Create Apex Institute Issuer & Profile
    const password = await hashPassword("SecurePass123!");
    issuerUser = await User.create({
      name: "Apex Institute of Technology",
      email: "registrar@apex.edu",
      passwordHash: password,
      role: ROLES.ISSUER,
      ethereumAddress: issuerKeypair.address.toLowerCase(),
      did: issuerKeypair.did,
      isActive: true,
      isVerified: true,
    });

    await IssuerProfile.create({
      userId: issuerUser._id,
      institutionName: "Apex Institute of Technology",
      did: issuerKeypair.did,
      issuerAddress: issuerKeypair.address.toLowerCase(),
      isApprovedOnChain: true,
    });

    // 4. Create Other Issuer (Metro Polytechnic) for cross-issuer authorization tests
    otherIssuerUser = await User.create({
      name: "Metro Polytechnic",
      email: "registrar@metropoly.edu",
      passwordHash: password,
      role: ROLES.ISSUER,
      ethereumAddress: otherIssuerKeypair.address.toLowerCase(),
      did: otherIssuerKeypair.did,
      isActive: true,
      isVerified: true,
    });

    await IssuerProfile.create({
      userId: otherIssuerUser._id,
      institutionName: "Metro Polytechnic",
      did: otherIssuerKeypair.did,
      issuerAddress: otherIssuerKeypair.address.toLowerCase(),
      isApprovedOnChain: true,
    });

    // 5. Create Recipient Student (David Zhang)
    studentUser = await User.create({
      name: "David Zhang",
      email: "david.zhang@student.test",
      passwordHash: password,
      role: ROLES.HOLDER,
      isActive: true,
      isVerified: true,
    });

    // 6. Create Third-Party Student (Zara)
    unauthorizedStudentUser = await User.create({
      name: "Zara Unauthorized",
      email: "zara@student.test",
      passwordHash: password,
      role: ROLES.HOLDER,
      isActive: true,
      isVerified: true,
    });

    // 7. Create Verifier User (Global Verifier Org)
    verifierUser = await User.create({
      name: "Global Verifier Org",
      email: "verifier@e2e.test",
      passwordHash: password,
      role: ROLES.VERIFIER,
      isActive: true,
      isVerified: true,
    });

    // 8. Log in all users to obtain authenticated JWT tokens
    const resIssuer = await request(app).post("/api/auth/login").send({ email: "registrar@apex.edu", password: "SecurePass123!" });
    issuerToken = resIssuer.body.data.token;

    const resOtherIssuer = await request(app).post("/api/auth/login").send({ email: "registrar@metropoly.edu", password: "SecurePass123!" });
    otherIssuerToken = resOtherIssuer.body.data.token;

    const resStudent = await request(app).post("/api/auth/login").send({ email: "david.zhang@student.test", password: "SecurePass123!" });
    studentToken = resStudent.body.data.token;

    const resZara = await request(app).post("/api/auth/login").send({ email: "zara@student.test", password: "SecurePass123!" });
    unauthorizedStudentToken = resZara.body.data.token;

    const resVerifier = await request(app).post("/api/auth/login").send({ email: "verifier@e2e.test", password: "SecurePass123!" });
    verifierToken = resVerifier.body.data.token;

    // 9. Setup default on-chain verification mock for isolated environment
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
  // 1. Authorization & Issuance Boundary Protection
  // =========================================================================
  describe("1. Authorization & Issuance Boundaries", function () {
    it("should prevent non-issuer roles (Student and Verifier) from issuing credentials", async function () {
      const payload = {
        title: "Unauthorized Master Degree",
        holderName: "Self Issued",
      };

      // Student attempt
      const resStudent = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${studentToken}`)
        .send(payload);
      expect(resStudent.status).to.equal(403);
      expect(resStudent.body.error.code).to.equal("FORBIDDEN");

      // Verifier attempt
      const resVerifier = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${verifierToken}`)
        .send(payload);
      expect(resVerifier.status).to.equal(403);
      expect(resVerifier.body.error.code).to.equal("FORBIDDEN");
    });

    it("should enforce validation requirements during issuance", async function () {
      const res = await request(app)
        .post("/api/credentials")
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({}); // Missing title and holderName

      expect(res.status).to.equal(400);
      expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });
  });

  // =========================================================================
  // 2. Credential Issuance, Signing & Database Persistence
  // =========================================================================
  describe("2. Credential Issuance & Persistence", function () {
    it("should successfully issue, digitally sign, anchor, and persist a credential for David Zhang", async function () {
      const payload = {
        title: "Master of Engineering in Distributed Systems",
        holderName: "David Zhang",
        holderEmail: "david.zhang@student.test",
        claims: {
          degree: "M.Eng. Distributed Systems",
          specialization: "Cloud Architecture & Consensus",
          gpa: "3.95",
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

      issuedCredentialId = res.body.data.record.credentialId;
      issuedCredentialPayload = res.body.data.credential;

      // Verify W3C VC structure
      expect(issuedCredentialPayload.type).to.include("VerifiableCredential");
      expect(issuedCredentialPayload.issuer.name).to.equal("Apex Institute of Technology");
      expect(issuedCredentialPayload.issuer.ethereumAddress).to.equal(issuerKeypair.address.toLowerCase());
      expect(issuedCredentialPayload.proof.type).to.equal("EcdsaSecp256k1Signature2019");

      // Verify MongoDB persistence directly
      const dbRecord = await Credential.findOne({ credentialId: issuedCredentialId });
      expect(dbRecord).to.not.be.null;
      expect(dbRecord.holderEmail).to.equal("david.zhang@student.test");
      expect(dbRecord.title).to.equal("Master of Engineering in Distributed Systems");
      expect(dbRecord.status).to.equal(CREDENTIAL_STATUS.ISSUED);
      expect(dbRecord.isRevoked).to.be.false;
    });
  });

  // =========================================================================
  // 3. Student Vault Access & IDOR Isolation
  // =========================================================================
  describe("3. Student Vault Access & IDOR Isolation", function () {
    it("should allow recipient student (David) to view their own credentials while completely isolating third parties", async function () {
      // 1. Recipient student lists credentials in vault
      const resVault = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(resVault.status).to.equal(200);
      expect(resVault.body.data.credentials.length).to.equal(1);
      expect(resVault.body.data.credentials[0].credentialId).to.equal(issuedCredentialId);
      expect(resVault.body.data.credentials[0].status).to.equal("ISSUED");

      // 2. Recipient student retrieves single credential detail
      const resDetail = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${studentToken}`);

      expect(resDetail.status).to.equal(200);
      expect(resDetail.body.data.credentialId).to.equal(issuedCredentialId);
      expect(resDetail.body.data.holderEmail).to.equal("david.zhang@student.test");

      // 3. Third-party student (Zara) queries her own vault -> 0 data bleeding
      const resZaraVault = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${unauthorizedStudentToken}`);

      expect(resZaraVault.status).to.equal(200);
      expect(resZaraVault.body.data.credentials.length).to.equal(0);

      // 4. Third-party student attempts IDOR access on David's credential -> 403 FORBIDDEN
      const resZaraDetail = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${unauthorizedStudentToken}`);

      expect(resZaraDetail.status).to.equal(403);
      expect(resZaraDetail.body.error.code).to.equal("FORBIDDEN");

      // 5. Verifier queries vault list -> empty array
      const resVerifierVault = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${verifierToken}`);

      expect(resVerifierVault.status).to.equal(200);
      expect(resVerifierVault.body.data.credentials).to.be.an("array").that.is.empty;

      // 6. Verifier attempts to access private detail endpoint -> 403 FORBIDDEN
      const resVerifierDetail = await request(app)
        .get(`/api/credentials/${issuedCredentialId}`)
        .set("Authorization", `Bearer ${verifierToken}`);

      expect(resVerifierDetail.status).to.equal(403);
      expect(resVerifierDetail.body.error.code).to.equal("FORBIDDEN");
    });
  });

  // =========================================================================
  // 4. Public Verification & Privacy Preservation
  // =========================================================================
  describe("4. Public Verification & Privacy Preservation", function () {
    it("should allow public verification by ID without authentication or student PII disclosure", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}/verify`);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.status).to.equal("VALID");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.issuerAuthorized).to.be.true;
      expect(res.body.data.checks.notRevoked).to.be.true;
      expect(res.body.data.checks.notExpired).to.be.true;
      expect(res.body.data.checks.onChainVerified).to.be.true;
      expect(res.body.data.issuer.name).to.equal("Apex Institute of Technology");

      // Privacy verification: PII and internal database fields MUST NOT be disclosed
      expect(res.body.data).to.not.have.property("_id");
      expect(res.body.data).to.not.have.property("holderId");
      expect(res.body.data).to.not.have.property("holderName");
      expect(res.body.data).to.not.have.property("holderEmail");
      expect(res.body.data).to.not.have.property("credentialSubject");
      expect(res.body.data).to.not.have.property("claims");
    });

    it("should allow public verification via raw JSON payload without authentication", async function () {
      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialPayload);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.true;
      expect(res.body.data.status).to.equal("VALID");
      expect(res.body.data.checks.signatureValid).to.be.true;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;
      expect(res.body.data.checks.notRevoked).to.be.true;
    });
  });

  // =========================================================================
  // 5. Verification Failure Paths & Integrity Enforcement
  // =========================================================================
  describe("5. Verification Failure Paths & Integrity Enforcement", function () {
    it("should reject verification when credential claims are tampered with (INVALID_SIGNATURE)", async function () {
      const tampered = JSON.parse(JSON.stringify(issuedCredentialPayload));
      tampered.credentialSubject.gpa = "4.00"; // Tamper with GPA claim

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(tampered);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("INVALID_SIGNATURE");
      expect(res.body.data.checks.signatureValid).to.be.false;
    });

    it("should fail-closed when blockchain node is unreachable (BLOCKCHAIN_QUERY_ERROR)", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "BLOCKCHAIN_QUERY_ERROR",
        statusMessage: "Unable to verify with blockchain node: connect ECONNREFUSED 127.0.0.1:8545",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialPayload);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("BLOCKCHAIN_QUERY_ERROR");
      expect(res.body.data.checks.onChainVerified).to.be.false;

      // Restore mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail-closed when credential is not anchored on-chain (CREDENTIAL_NOT_FOUND)", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "CREDENTIAL_NOT_FOUND",
        statusMessage: "Credential not found in registry",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialPayload);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_NOT_FOUND");
      expect(res.body.data.checks.onChainVerified).to.be.false;

      // Restore mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when on-chain hash mismatches (HASH_MISMATCH)", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "HASH_MISMATCH",
        statusMessage: "Credential content hash does not match on-chain fingerprint",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialPayload);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("HASH_MISMATCH");
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.false;

      // Restore mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should fail verification when issuer is suspended on-chain (ISSUER_SUSPENDED)", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "ISSUER_SUSPENDED",
        statusMessage: "Issuing institution is suspended or unauthorized",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialPayload);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("ISSUER_SUSPENDED");
      expect(res.body.data.checks.issuerAuthorized).to.be.false;
      expect(res.body.data.checks.hashMatchesFingerprint).to.be.true;

      // Restore mock
      blockchainService.verifyCredential = mockVerifyValid;
    });
  });

  // =========================================================================
  // 6. Credential Revocation Workflow & Permission Isolation
  // =========================================================================
  describe("6. Revocation Workflow & Permission Isolation", function () {
    it("should prevent unauthorized actors (student and other issuer) from revoking the credential", async function () {
      // 1. Student attempt -> 403
      const resStudent = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ reason: "Unauthorized student attempt" });

      expect(resStudent.status).to.equal(403);

      // 2. Different issuer attempt -> 403
      const resOther = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${otherIssuerToken}`)
        .send({ reason: "Unauthorized cross-issuer attempt" });

      expect(resOther.status).to.equal(403);
      expect(resOther.body.error.code).to.equal("UNAUTHORIZED_REVOCATION");
    });

    it("should allow the issuing institution to revoke the credential with documented reason", async function () {
      const revocationReason = "Academic program curriculum restructuring";

      const res = await request(app)
        .post(`/api/credentials/${issuedCredentialId}/revoke`)
        .set("Authorization", `Bearer ${issuerToken}`)
        .send({ reason: revocationReason });

      expect(res.status).to.equal(200);
      expect(res.body.data.isRevoked).to.be.true;
      expect(res.body.data.status).to.equal(CREDENTIAL_STATUS.REVOKED);
      expect(res.body.data.revocationReason).to.equal(revocationReason);
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

  // =========================================================================
  // 7. Post-Revocation Verification & Student Vault Status Update
  // =========================================================================
  describe("7. Post-Revocation Verification & Vault Updates", function () {
    it("should report CREDENTIAL_REVOKED during subsequent public ID verification", async function () {
      const res = await request(app)
        .get(`/api/credentials/${issuedCredentialId}/verify`);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_REVOKED");
      expect(res.body.data.checks.notRevoked).to.be.false;
      expect(res.body.data.checks.signatureValid).to.be.true;
    });

    it("should report CREDENTIAL_REVOKED when verified via raw JSON payload after on-chain revocation", async function () {
      blockchainService.verifyCredential = async () => ({
        isValid: false,
        statusCode: "CREDENTIAL_REVOKED",
        statusMessage: "Credential has been revoked",
      });

      const res = await request(app)
        .post("/api/credentials/verify")
        .send(issuedCredentialPayload);

      expect(res.status).to.equal(200);
      expect(res.body.data.isValid).to.be.false;
      expect(res.body.data.status).to.equal("CREDENTIAL_REVOKED");
      expect(res.body.data.checks.notRevoked).to.be.false;
      expect(res.body.data.checks.signatureValid).to.be.true;

      // Restore mock
      blockchainService.verifyCredential = mockVerifyValid;
    });

    it("should reflect updated REVOKED status in the recipient student's vault", async function () {
      const res = await request(app)
        .get("/api/credentials")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(res.status).to.equal(200);
      expect(res.body.data.credentials.length).to.equal(1);
      const cred = res.body.data.credentials[0];
      expect(cred.credentialId).to.equal(issuedCredentialId);
      expect(cred.isRevoked).to.be.true;
      expect(cred.status).to.equal("REVOKED");
      expect(cred.revocationReason).to.equal("Academic program curriculum restructuring");
    });
  });
});
