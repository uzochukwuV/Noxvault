// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Nox, ebool, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";

contract RiskPolicyPack is Ownable2Step {
    mapping(address => mapping(bytes32 => uint256)) public issuerObligorCapPlain;
    mapping(address => mapping(bytes32 => uint256)) public issuerObligorOutstandingPlain;

    mapping(uint8 => uint256) public tierCapPlain;
    mapping(uint8 => uint256) public tierOutstandingPlain;

    mapping(address => mapping(bytes32 => euint256)) public issuerObligorCapEncrypted;
    mapping(address => mapping(bytes32 => euint256)) public issuerObligorOutstandingEncrypted;

    mapping(uint8 => euint256) public tierCapEncrypted;
    mapping(uint8 => euint256) public tierOutstandingEncrypted;

    address public riskManager;

    event RiskManagerUpdated(address indexed riskManager);

    event IssuerObligorCapPlainUpdated(address indexed issuer, bytes32 indexed obligorHash, uint256 cap);
    event TierCapPlainUpdated(uint8 indexed tier, uint256 cap);

    event IssuerObligorCapEncryptedUpdated(address indexed issuer, bytes32 indexed obligorHash, bytes32 capHandle);
    event TierCapEncryptedUpdated(uint8 indexed tier, bytes32 capHandle);

    event PlainFundingConsumed(address indexed issuer, bytes32 indexed obligorHash, uint8 indexed tier, uint256 amount);
    event PlainRepaymentRecorded(address indexed issuer, bytes32 indexed obligorHash, uint8 indexed tier, uint256 amount);

    event EncryptedFundingCommitted(address indexed issuer, bytes32 indexed obligorHash, uint8 indexed tier, bytes32 amountHandle);
    event EncryptedRepaymentCommitted(address indexed issuer, bytes32 indexed obligorHash, uint8 indexed tier, bytes32 amountHandle);

    error Unauthorized(address sender);
    error RiskLimitExceeded();

    constructor() Ownable(msg.sender) {}

    function setRiskManager(address newRiskManager) external onlyOwner {
        riskManager = newRiskManager;
        emit RiskManagerUpdated(newRiskManager);
    }

    function setIssuerObligorCapPlain(address issuer, bytes32 obligorHash, uint256 cap) external onlyOwner {
        issuerObligorCapPlain[issuer][obligorHash] = cap;
        emit IssuerObligorCapPlainUpdated(issuer, obligorHash, cap);
    }

    function setTierCapPlain(uint8 tier, uint256 cap) external onlyOwner {
        tierCapPlain[tier] = cap;
        emit TierCapPlainUpdated(tier, cap);
    }

    function setIssuerObligorCapEncryptedPublic(address issuer, bytes32 obligorHash, uint256 cap) external onlyOwner {
        issuerObligorCapEncrypted[issuer][obligorHash] = Nox.toEuint256(cap);
        Nox.allowThis(issuerObligorCapEncrypted[issuer][obligorHash]);
        Nox.allow(issuerObligorCapEncrypted[issuer][obligorHash], owner());
        emit IssuerObligorCapEncryptedUpdated(issuer, obligorHash, euint256.unwrap(issuerObligorCapEncrypted[issuer][obligorHash]));
    }

    function setTierCapEncryptedPublic(uint8 tier, uint256 cap) external onlyOwner {
        tierCapEncrypted[tier] = Nox.toEuint256(cap);
        Nox.allowThis(tierCapEncrypted[tier]);
        Nox.allow(tierCapEncrypted[tier], owner());
        emit TierCapEncryptedUpdated(tier, euint256.unwrap(tierCapEncrypted[tier]));
    }

    function setIssuerObligorCapEncrypted(
        address issuer,
        bytes32 obligorHash,
        externalEuint256 capHandle,
        bytes calldata proof
    ) external onlyOwner {
        issuerObligorCapEncrypted[issuer][obligorHash] = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(issuerObligorCapEncrypted[issuer][obligorHash]);
        Nox.allow(issuerObligorCapEncrypted[issuer][obligorHash], owner());
        emit IssuerObligorCapEncryptedUpdated(issuer, obligorHash, euint256.unwrap(issuerObligorCapEncrypted[issuer][obligorHash]));
    }

    function setTierCapEncrypted(uint8 tier, externalEuint256 capHandle, bytes calldata proof) external onlyOwner {
        tierCapEncrypted[tier] = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(tierCapEncrypted[tier]);
        Nox.allow(tierCapEncrypted[tier], owner());
        emit TierCapEncryptedUpdated(tier, euint256.unwrap(tierCapEncrypted[tier]));
    }

    function consumePlainFunding(address issuer, bytes32 obligorHash, uint8 tier, uint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);
        if (amount == 0) revert RiskLimitExceeded();

        uint256 pairCap = issuerObligorCapPlain[issuer][obligorHash];
        if (pairCap != 0 && issuerObligorOutstandingPlain[issuer][obligorHash] + amount > pairCap) revert RiskLimitExceeded();

        uint256 capTier = tierCapPlain[tier];
        if (capTier != 0 && tierOutstandingPlain[tier] + amount > capTier) revert RiskLimitExceeded();

        issuerObligorOutstandingPlain[issuer][obligorHash] += amount;
        tierOutstandingPlain[tier] += amount;
        emit PlainFundingConsumed(issuer, obligorHash, tier, amount);
    }

    function recordPlainRepayment(address issuer, bytes32 obligorHash, uint8 tier, uint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);
        if (amount == 0) revert RiskLimitExceeded();

        uint256 pairOut = issuerObligorOutstandingPlain[issuer][obligorHash];
        issuerObligorOutstandingPlain[issuer][obligorHash] = amount >= pairOut ? 0 : pairOut - amount;

        uint256 tierOut = tierOutstandingPlain[tier];
        tierOutstandingPlain[tier] = amount >= tierOut ? 0 : tierOut - amount;

        emit PlainRepaymentRecorded(issuer, obligorHash, tier, amount);
    }

    function enforceAndCommitConfidentialFunding(
        address issuer,
        bytes32 obligorHash,
        uint8 tier,
        euint256 amount,
        bytes calldata proofsBundle
    ) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);

        (bytes memory pairOkProof, bytes memory tierOkProof) = abi.decode(proofsBundle, (bytes, bytes));

        euint256 newPairOut = Nox.add(issuerObligorOutstandingEncrypted[issuer][obligorHash], amount);
        euint256 newTierOut = Nox.add(tierOutstandingEncrypted[tier], amount);

        ebool pairOk = Nox.le(newPairOut, issuerObligorCapEncrypted[issuer][obligorHash]);
        ebool tierOk = Nox.le(newTierOut, tierCapEncrypted[tier]);

        Nox.allowPublicDecryption(pairOk);
        Nox.allowPublicDecryption(tierOk);

        require(_publicDecryptBool(pairOk, pairOkProof));
        require(_publicDecryptBool(tierOk, tierOkProof));

        issuerObligorOutstandingEncrypted[issuer][obligorHash] = newPairOut;
        tierOutstandingEncrypted[tier] = newTierOut;

        Nox.allowThis(newPairOut);
        Nox.allowThis(newTierOut);
        Nox.allow(newPairOut, owner());
        Nox.allow(newTierOut, owner());
        Nox.allow(newPairOut, riskManager);
        Nox.allow(newTierOut, riskManager);

        emit EncryptedFundingCommitted(issuer, obligorHash, tier, euint256.unwrap(amount));
    }

    function commitConfidentialRepayment(address issuer, bytes32 obligorHash, uint8 tier, euint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);

        euint256 pairOut = issuerObligorOutstandingEncrypted[issuer][obligorHash];
        euint256 tierOut = tierOutstandingEncrypted[tier];

        euint256 newPairOut = Nox.sub(pairOut, amount);
        euint256 newTierOut = Nox.sub(tierOut, amount);

        issuerObligorOutstandingEncrypted[issuer][obligorHash] = newPairOut;
        tierOutstandingEncrypted[tier] = newTierOut;

        Nox.allowThis(newPairOut);
        Nox.allowThis(newTierOut);
        Nox.allow(newPairOut, owner());
        Nox.allow(newTierOut, owner());
        Nox.allow(newPairOut, riskManager);
        Nox.allow(newTierOut, riskManager);

        emit EncryptedRepaymentCommitted(issuer, obligorHash, tier, euint256.unwrap(amount));
    }

    function _publicDecryptBool(ebool handle, bytes memory decryptionProof) private view returns (bool) {
        bytes memory result = INoxCompute(Nox.noxComputeContract()).validateDecryptionProof(
            ebool.unwrap(handle),
            decryptionProof
        );
        require(result.length == 1);
        require(result[0] == 0x00 || result[0] == 0x01);
        return result[0] != 0x00;
    }
}
