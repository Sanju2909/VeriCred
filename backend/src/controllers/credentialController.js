const credentialService = require("../services/credentialService");
const ApiResponse = require("../utils/apiResponse");

class CredentialController {
  /**
   * POST /api/credentials
   * Issue a new Verifiable Credential. Restricted to approved ISSUER or ADMIN.
   */
  async issueCredential(req, res, next) {
    try {
      const { title, holderName, holderEmail, credentialType, claims, expirationDate } = req.body;

      const result = await credentialService.issueCredential({
        issuerUser: req.user,
        title,
        holderName,
        holderEmail,
        credentialType,
        claims,
        expirationDate,
      });

      return ApiResponse.success(
        res,
        201,
        "Credential successfully issued and digitally signed",
        result
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/credentials
   * List credentials accessible to current authenticated user.
   */
  async listCredentials(req, res, next) {
    try {
      const { status, page, limit } = req.query;
      const result = await credentialService.getCredentialsForUser(req.user, {
        status,
        page,
        limit,
      });

      return ApiResponse.success(res, 200, "Credentials retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/credentials/:id
   * Get single credential by ID.
   */
  async getCredentialById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await credentialService.getCredentialById(id, req.user);
      return ApiResponse.success(res, 200, "Credential retrieved", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/credentials/verify or POST /api/credentials/:id/verify
   * Verify cryptographic signature, hash integrity, and on-chain status.
   */
  async verifyCredential(req, res, next) {
    try {
      let payloadToVerify = req.body;

      let storedRecord = null;
      // If verifying by ID path parameter and body is empty, load stored credential
      if (req.params.id && (!payloadToVerify || Object.keys(payloadToVerify).length === 0)) {
        storedRecord = await credentialService.getCredentialById(req.params.id, req.user || { role: "ANONYMOUS" });
        const institutionName = (storedRecord.issuerProfileId && storedRecord.issuerProfileId.institutionName)
          ? storedRecord.issuerProfileId.institutionName
          : "Academic Institution";

        payloadToVerify = {
          "@context": [
            "https://www.w3.org/2018/credentials/v1",
            "https://schema.org",
          ],
          id: storedRecord.credentialId,
          type: storedRecord.credentialType,
          issuer: {
            id: storedRecord.issuerDid,
            name: institutionName,
            ethereumAddress: storedRecord.issuerAddress,
          },
          issuanceDate: storedRecord.issuanceDate.toISOString(),
          expirationDate: storedRecord.expirationDate ? storedRecord.expirationDate.toISOString() : null,
          credentialSubject: storedRecord.claims,
          proof: storedRecord.proof,
        };
      }

      const result = await credentialService.verifyCredential(payloadToVerify, { storedRecord });
      return ApiResponse.success(res, 200, "Verification completed", result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/credentials/:id/revoke
   * Revoke an issued credential.
   */
  async revokeCredential(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const result = await credentialService.revokeCredential({
        credentialId: id,
        reason,
        revokerUser: req.user,
      });

      return ApiResponse.success(res, 200, "Credential successfully revoked", result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CredentialController();

