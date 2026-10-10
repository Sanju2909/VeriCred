# Smart Contract Architecture & Testing (Hardhat)

This subproject contains the Solidity smart contracts, automated unit tests, and local deployment pipelines for the **Decentralized Digital Identity and Verifiable Credentials Platform**.

---

## 🏛️ Smart Contracts Overview

### 1. [`IssuerRegistry.sol`](./contracts/IssuerRegistry.sol)
- **Purpose**: Acts as the on-chain root of trust, registering authorized academic institutions, universities, and issuing bodies.
- **Access Control**: Platform Governance Administrator (`admin`).
- **Core Operations**:
  - `registerIssuer(address issuerAddress, string name, string did)`: Admin-only registration of an issuing authority.
  - `suspendIssuer(address issuerAddress)`: Admin-only suspension of an issuer's issuing and active status.
  - `reactivateIssuer(address issuerAddress)`: Admin-only reactivation of an issuer.
  - `transferAdmin(address newAdmin)`: Transfer governance to a new administrator address.
  - `isIssuerApproved(address issuerAddress)`: Public view function queried by `CredentialRegistry` and verifiers.

### 2. [`CredentialRegistry.sol`](./contracts/CredentialRegistry.sol)
- **Purpose**: Anchors cryptographic integrity fingerprints (hashes) of issued credentials, tracks expiration, and manages revocation state on-chain.
- **Privacy Design**:
  - **No PII (Personally Identifiable Information)** such as student names, grades, birthdates, or contact details is ever stored on-chain.
  - Only cryptographic hash fingerprints (`bytes32`), issuer addresses, and status timestamps are recorded.
- **Access Control**:
  - **Issuance**: Restricted to currently approved issuers (`issuerRegistry.isIssuerApproved(msg.sender)`).
  - **Revocation**: Restricted to the **original issuer** who anchored the credential OR the **platform admin** for governance emergencies.
- **Core Operations**:
  - `issueCredential(bytes32 credentialId, bytes32 credentialHash, uint256 expiresAt)`: Anchors a credential hash with optional expiration.
  - `revokeCredential(bytes32 credentialId, string reason)`: Marks a credential revoked with a documented reason.
  - `verifyCredential(bytes32 credentialId, bytes32 expectedHash)`: Comprehensive view function returning validity boolean, machine-readable status code (`VerificationStatus`), and human-readable message.

---

## ⚙️ Prerequisites & Setup

### 1. Install Dependencies
From the project root:
```powershell
cd blockchain
npm.cmd install
```

### 2. Compile Smart Contracts
```powershell
npm.cmd run compile
```
*(Or `npx.cmd hardhat compile`)*

### 3. Run Automated Tests
Execute the 29-test comprehensive test suite covering permissions, lifecycle, edge cases, and custom errors:
```powershell
npm.cmd run test
```

### 4. Run Coverage Analysis (Optional)
```powershell
npm.cmd run coverage
```

---

## 🚀 Local Deployment

### 1. Standalone Local Node (Optional)
To run a persistent local Hardhat node in a separate terminal:
```powershell
npx.cmd hardhat node
```

### 2. Deploy Contracts
To deploy `IssuerRegistry` and `CredentialRegistry` onto the local node:
```powershell
npm.cmd run deploy:local
```
Output example:
```text
✔ IssuerRegistry successfully deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✔ CredentialRegistry successfully deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

---

## 🔒 Security Assumptions & Limitations

1. **Hash Pre-image & Low-Entropy Data**:
   - Anchoring hashes on-chain prevents tampering, but hashing low-entropy data (e.g., just a student ID) can be vulnerable to brute-force pre-image attacks. The off-chain credential must be structured, canonicalized (e.g., JSON-LD / canonical JSON), and include high-entropy nonces or complete verifiable credential claims.
2. **Key Management**:
   - The security of an issuer depends entirely on keeping their private key secure off-chain. If an issuer key is compromised, the platform admin can invoke `suspendIssuer()` to immediately invalidate future and existing verifications from that compromised address.
3. **Private Data Privacy**:
   - All blockchain transactions are public. Never anchor raw student transcripts or plaintext metadata to the smart contracts.
