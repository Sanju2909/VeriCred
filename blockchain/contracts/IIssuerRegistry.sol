// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IIssuerRegistry
 * @dev Interface defining standard operations for managing authorized issuing institutions.
 */
interface IIssuerRegistry {
    /**
     * @notice Emitted when a new issuing authority is registered and approved.
     * @param issuerAddress The Ethereum address associated with the issuer.
     * @param name The official legal/institutional name of the issuer.
     * @param did The Decentralized Identifier (DID) URI of the issuer.
     * @param registeredAt Unix timestamp of registration.
     */
    event IssuerRegistered(
        address indexed issuerAddress,
        string name,
        string did,
        uint256 registeredAt
    );

    /**
     * @notice Emitted when an issuer's authorization is suspended or revoked.
     * @param issuerAddress The Ethereum address of the suspended issuer.
     * @param suspendedAt Unix timestamp of suspension.
     */
    event IssuerSuspended(address indexed issuerAddress, uint256 suspendedAt);

    /**
     * @notice Emitted when a suspended issuer is reactivated.
     * @param issuerAddress The Ethereum address of the reactivated issuer.
     * @param reactivatedAt Unix timestamp of reactivation.
     */
    event IssuerReactivated(address indexed issuerAddress, uint256 reactivatedAt);

    /**
     * @notice Emitted when platform administrator privileges are transferred.
     * @param previousAdmin The previous administrator address.
     * @param newAdmin The new administrator address.
     */
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    /**
     * @notice Checks whether an address represents an active, authorized issuer.
     * @param issuerAddress The address to verify.
     * @return bool True if authorized and active, false otherwise.
     */
    function isIssuerApproved(address issuerAddress) external view returns (bool);

    /**
     * @notice Returns the platform administrator address.
     * @return address The current administrator.
     */
    function admin() external view returns (address);
}

