// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IIssuerRegistry.sol";

/**
 * @title IssuerRegistry
 * @dev Manages the authorization lifecycle of trusted credential issuers (e.g., universities, academies).
 *      Acts as the root of trust on-chain for the Decentralized Credential Platform.
 */
contract IssuerRegistry is IIssuerRegistry {
    // Custom error definitions for descriptive and gas-efficient reverts
    error IssuerRegistry__NotAdmin();
    error IssuerRegistry__ZeroAddress();
    error IssuerRegistry__EmptyName();
    error IssuerRegistry__EmptyDID();
    error IssuerRegistry__AlreadyRegistered();
    error IssuerRegistry__NotRegistered();
    error IssuerRegistry__AlreadyApproved();
    error IssuerRegistry__AlreadySuspended();

    /// @notice Struct representing an issuing institution.
    struct Issuer {
        string name;            // Legal or academic institutional name
        string did;             // Decentralized Identifier URI (e.g. did:ethr:0x...)
        bool isApproved;        // Current authorization status
        uint256 registeredAt;   // Registration timestamp
        uint256 revokedAt;      // Suspension/Revocation timestamp (0 if active)
    }

    /// @notice Platform governance administrator.
    address public override admin;

    /// @dev Mapping of issuer Ethereum address to Issuer profile.
    mapping(address => Issuer) private _issuers;

    /// @dev Tracking array of all registered issuer addresses for enumeration.
    address[] private _issuerAddresses;

    /// @dev Mapping to track if an address has ever been added to _issuerAddresses.
    mapping(address => bool) private _isKnown;

    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert IssuerRegistry__NotAdmin();
        }
        _;
    }

    /**
     * @notice Initializes the IssuerRegistry contract setting the deployer as the initial administrator.
     */
    constructor() {
        admin = msg.sender;
        emit AdminTransferred(address(0), msg.sender);
    }

    /**
     * @notice Transfers administrator privileges to a new address.
     * @param newAdmin The address of the new administrator.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) {
            revert IssuerRegistry__ZeroAddress();
        }
        address previousAdmin = admin;
        admin = newAdmin;
        emit AdminTransferred(previousAdmin, newAdmin);
    }

    /**
     * @notice Registers and approves a new institutional credential issuer.
     * @dev Only callable by the platform administrator.
     * @param issuerAddress Ethereum address controlled by the issuing institution.
     * @param name Official name of the institution.
     * @param did Decentralized Identifier (DID) URI of the institution.
     */
    function registerIssuer(
        address issuerAddress,
        string calldata name,
        string calldata did
    ) external onlyAdmin {
        if (issuerAddress == address(0)) {
            revert IssuerRegistry__ZeroAddress();
        }
        if (bytes(name).length == 0) {
            revert IssuerRegistry__EmptyName();
        }
        if (bytes(did).length == 0) {
            revert IssuerRegistry__EmptyDID();
        }
        if (_isKnown[issuerAddress]) {
            revert IssuerRegistry__AlreadyRegistered();
        }

        _issuers[issuerAddress] = Issuer({
            name: name,
            did: did,
            isApproved: true,
            registeredAt: block.timestamp,
            revokedAt: 0
        });

        _issuerAddresses.push(issuerAddress);
        _isKnown[issuerAddress] = true;

        emit IssuerRegistered(issuerAddress, name, did, block.timestamp);
    }

    /**
     * @notice Suspends an issuer's authorization to issue or validate active credentials.
     * @dev Only callable by the platform administrator.
     * @param issuerAddress The address of the issuer to suspend.
     */
    function suspendIssuer(address issuerAddress) external onlyAdmin {
        if (!_isKnown[issuerAddress]) {
            revert IssuerRegistry__NotRegistered();
        }
        if (!_issuers[issuerAddress].isApproved) {
            revert IssuerRegistry__AlreadySuspended();
        }

        _issuers[issuerAddress].isApproved = false;
        _issuers[issuerAddress].revokedAt = block.timestamp;

        emit IssuerSuspended(issuerAddress, block.timestamp);
    }

    /**
     * @notice Reactivates a previously suspended issuer.
     * @dev Only callable by the platform administrator.
     * @param issuerAddress The address of the issuer to reactivate.
     */
    function reactivateIssuer(address issuerAddress) external onlyAdmin {
        if (!_isKnown[issuerAddress]) {
            revert IssuerRegistry__NotRegistered();
        }
        if (_issuers[issuerAddress].isApproved) {
            revert IssuerRegistry__AlreadyApproved();
        }

        _issuers[issuerAddress].isApproved = true;
        _issuers[issuerAddress].revokedAt = 0;

        emit IssuerReactivated(issuerAddress, block.timestamp);
    }

    /**
     * @notice Checks whether an address is currently an authorized issuer.
     * @param issuerAddress The address to query.
     * @return bool True if registered and currently active/approved.
     */
    function isIssuerApproved(address issuerAddress) external view override returns (bool) {
        return _issuers[issuerAddress].isApproved;
    }

    /**
     * @notice Retrieves full institutional profile for an issuer address.
     * @param issuerAddress The address to query.
     * @return name Legal/institutional name.
     * @return did Decentralized Identifier (DID) URI.
     * @return isApproved Current approval status.
     * @return registeredAt Unix timestamp of initial registration.
     * @return revokedAt Unix timestamp of suspension (0 if active).
     */
    function getIssuer(
        address issuerAddress
    )
        external
        view
        returns (
            string memory name,
            string memory did,
            bool isApproved,
            uint256 registeredAt,
            uint256 revokedAt
        )
    {
        if (!_isKnown[issuerAddress]) {
            revert IssuerRegistry__NotRegistered();
        }
        Issuer storage item = _issuers[issuerAddress];
        return (item.name, item.did, item.isApproved, item.registeredAt, item.revokedAt);
    }

    /**
     * @notice Returns total number of registered issuers (both active and suspended).
     */
    function getIssuerCount() external view returns (uint256) {
        return _issuerAddresses.length;
    }

    /**
     * @notice Returns list of all registered issuer addresses.
     */
    function getAllIssuers() external view returns (address[] memory) {
        return _issuerAddresses;
    }
}
