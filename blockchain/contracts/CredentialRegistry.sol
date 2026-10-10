// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IIssuerRegistry.sol";

/**
 * @title CredentialRegistry
 * @dev Manages on-chain integrity anchoring, revocation, and validity verification for Verifiable Credentials.
 * 
 * PRIVACY & SECURITY ARCHITECTURE:
 * - Only cryptographic fingerprints (SHA-256 / Keccak-256 hashes), timestamps, and revocation flags
 *   are stored on-chain.
 * - No Personally Identifiable Information (PII) such as student names, grades, birthdates, or contact
 *   details are stored on-chain.
 * - Hashing alone does not guarantee anonymity for low-entropy or easily guessable data; therefore,
 *   credentials must be signed off-chain and presented by the holder with appropriate cryptographic proofs.
 */
contract CredentialRegistry {
    // Custom error definitions
    error CredentialRegistry__ZeroRegistryAddress();
    error CredentialRegistry__NotAuthorizedIssuer();
    error CredentialRegistry__InvalidCredentialId();
    error CredentialRegistry__EmptyCredentialHash();
    error CredentialRegistry__InvalidExpiration();
    error CredentialRegistry__CredentialAlreadyExists();
    error CredentialRegistry__CredentialNotFound();
    error CredentialRegistry__AlreadyRevoked();
    error CredentialRegistry__UnauthorizedRevocation();
    error CredentialRegistry__EmptyRevocationReason();

    /// @notice Status codes for machine-readable verification responses.
    enum VerificationStatus {
        VALID,                     // 0: Credential is valid, active, and issuer is authorized
        CREDENTIAL_NOT_FOUND,      // 1: Credential ID does not exist on-chain
        HASH_MISMATCH,             // 2: Provided hash does not match anchored on-chain integrity hash
        CREDENTIAL_REVOKED,        // 3: Credential has been revoked
        CREDENTIAL_EXPIRED,        // 4: Credential has passed its expiration timestamp
        ISSUER_SUSPENDED           // 5: Issuing institution is currently suspended/unauthorized
    }

    /// @notice Struct holding on-chain credential metadata.
    struct CredentialRecord {
        bytes32 credentialHash;    // Integrity hash (fingerprint) of canonical credential payload
        address issuer;            // Address of the authorized issuing institution
        uint256 issuedAt;          // Unix timestamp when the credential was anchored
        uint256 expiresAt;         // Unix timestamp when the credential expires (0 = no expiration)
        bool isRevoked;            // Revocation state flag
        uint256 revokedAt;         // Unix timestamp when revoked (0 if not revoked)
        string revocationReason;   // Documented reason for revocation
    }

    /// @notice Address of the trusted IssuerRegistry contract.
    IIssuerRegistry public immutable issuerRegistry;

    /// @dev Mapping from unique Credential ID to CredentialRecord.
    mapping(bytes32 => CredentialRecord) private _credentials;

    /// @notice Emitted when a new credential fingerprint is anchored on-chain.
    event CredentialIssued(
        bytes32 indexed credentialId,
        bytes32 indexed credentialHash,
        address indexed issuer,
        uint256 issuedAt,
        uint256 expiresAt
    );

    /**
     * @notice Emitted when a credential is explicitly revoked.
     * @param credentialId The unique ID of the revoked credential.
     * @param revokedBy Address of the entity executing revocation (original issuer or platform admin).
     * @param reason Documented reason for revocation.
     * @param revokedAt Unix timestamp when revocation occurred.
     */
    event CredentialRevoked(
        bytes32 indexed credentialId,
        address indexed revokedBy,
        string reason,
        uint256 revokedAt
    );

    /**
     * @notice Initializes the CredentialRegistry contract linked to an IssuerRegistry.
     * @param _issuerRegistry Address of the deployed IssuerRegistry contract.
     */
    constructor(address _issuerRegistry) {
        if (_issuerRegistry == address(0)) {
            revert CredentialRegistry__ZeroRegistryAddress();
        }
        issuerRegistry = IIssuerRegistry(_issuerRegistry);
    }

    /**
     * @notice Issues (anchors) a new verifiable credential fingerprint on-chain.
     * @dev Caller MUST be an authorized active issuer registered in IssuerRegistry.
     * @param credentialId Unique identifier (UUID hash or bytes32 ID) of the credential.
     * @param credentialHash Cryptographic integrity hash of the canonical credential payload.
     * @param expiresAt Unix timestamp when credential expires (use 0 for credentials that do not expire).
     */
    function issueCredential(
        bytes32 credentialId,
        bytes32 credentialHash,
        uint256 expiresAt
    ) external {
        if (!issuerRegistry.isIssuerApproved(msg.sender)) {
            revert CredentialRegistry__NotAuthorizedIssuer();
        }
        if (credentialId == bytes32(0)) {
            revert CredentialRegistry__InvalidCredentialId();
        }
        if (credentialHash == bytes32(0)) {
            revert CredentialRegistry__EmptyCredentialHash();
        }
        if (_credentials[credentialId].issuedAt != 0) {
            revert CredentialRegistry__CredentialAlreadyExists();
        }
        if (expiresAt > 0 && expiresAt <= block.timestamp) {
            revert CredentialRegistry__InvalidExpiration();
        }

        _credentials[credentialId] = CredentialRecord({
            credentialHash: credentialHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            isRevoked: false,
            revokedAt: 0,
            revocationReason: ""
        });

        emit CredentialIssued(
            credentialId,
            credentialHash,
            msg.sender,
            block.timestamp,
            expiresAt
        );
    }

    /**
     * @notice Revokes an existing credential.
     * @dev May only be called by the original issuing institution or the platform administrator.
     * @param credentialId Unique identifier of the credential to revoke.
     * @param reason Documented explanation for the revocation.
     */
    function revokeCredential(bytes32 credentialId, string calldata reason) external {
        CredentialRecord storage record = _credentials[credentialId];

        if (record.issuedAt == 0) {
            revert CredentialRegistry__CredentialNotFound();
        }
        if (record.isRevoked) {
            revert CredentialRegistry__AlreadyRevoked();
        }
        if (bytes(reason).length == 0) {
            revert CredentialRegistry__EmptyRevocationReason();
        }

        // Authorization policy: Only original issuer OR the platform admin can revoke
        bool isOriginalIssuer = (msg.sender == record.issuer);
        bool isAdmin = (msg.sender == issuerRegistry.admin());

        if (!isOriginalIssuer && !isAdmin) {
            revert CredentialRegistry__UnauthorizedRevocation();
        }

        record.isRevoked = true;
        record.revokedAt = block.timestamp;
        record.revocationReason = reason;

        emit CredentialRevoked(credentialId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Retrieves the on-chain metadata for a credential.
     * @param credentialId Unique identifier of the credential.
     */
    function getCredential(
        bytes32 credentialId
    )
        external
        view
        returns (
            bytes32 credentialHash,
            address issuer,
            uint256 issuedAt,
            uint256 expiresAt,
            bool isRevoked,
            uint256 revokedAt,
            string memory revocationReason
        )
    {
        CredentialRecord storage record = _credentials[credentialId];
        if (record.issuedAt == 0) {
            revert CredentialRegistry__CredentialNotFound();
        }

        return (
            record.credentialHash,
            record.issuer,
            record.issuedAt,
            record.expiresAt,
            record.isRevoked,
            record.revokedAt,
            record.revocationReason
        );
    }

    /**
     * @notice Verifies the complete validity of a credential against on-chain state.
     * @dev Checks existence, hash integrity, revocation, expiration, and issuer authorization.
     * @param credentialId Unique identifier of the credential.
     * @param expectedHash Hash computed from the credential presented by the holder.
     * @return isValid Boolean indicating if credential meets all validity criteria.
     * @return statusCode Machine-readable enum status code.
     * @return statusMessage Human-readable status description.
     */
    function verifyCredential(
        bytes32 credentialId,
        bytes32 expectedHash
    )
        external
        view
        returns (
            bool isValid,
            VerificationStatus statusCode,
            string memory statusMessage
        )
    {
        CredentialRecord storage record = _credentials[credentialId];

        // 1. Existence check
        if (record.issuedAt == 0) {
            return (false, VerificationStatus.CREDENTIAL_NOT_FOUND, "Credential not found in registry");
        }

        // 2. Integrity hash check
        if (record.credentialHash != expectedHash) {
            return (false, VerificationStatus.HASH_MISMATCH, "Credential content hash does not match on-chain fingerprint");
        }

        // 3. Revocation check
        if (record.isRevoked) {
            return (false, VerificationStatus.CREDENTIAL_REVOKED, "Credential has been revoked");
        }

        // 4. Expiration check
        if (record.expiresAt > 0 && block.timestamp >= record.expiresAt) {
            return (false, VerificationStatus.CREDENTIAL_EXPIRED, "Credential has expired");
        }

        // 5. Issuer authorization check
        if (!issuerRegistry.isIssuerApproved(record.issuer)) {
            return (false, VerificationStatus.ISSUER_SUSPENDED, "Issuing institution is suspended or unauthorized");
        }

        return (true, VerificationStatus.VALID, "Credential is valid, authentic, and active");
    }

    /**
     * @notice Quick boolean check for whether a credential is currently valid.
     * @param credentialId Unique identifier of the credential.
     */
    function isCredentialValid(bytes32 credentialId) external view returns (bool) {
        CredentialRecord storage record = _credentials[credentialId];
        if (record.issuedAt == 0) return false;
        if (record.isRevoked) return false;
        if (record.expiresAt > 0 && block.timestamp >= record.expiresAt) return false;
        if (!issuerRegistry.isIssuerApproved(record.issuer)) return false;
        return true;
    }
}

