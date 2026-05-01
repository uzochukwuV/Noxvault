// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Nox, ebool, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {INoxCompute} from "@iexec-nox/nox-protocol-contracts/contracts/interfaces/INoxCompute.sol";

contract RiskPolicyPack is Ownable2Step {
    mapping(address => mapping(bytes32 => uint256)) public issuerObligorCapPlain;
    mapping(address => mapping(bytes32 => uint256)) public issuerObligorOutstandingPlain;
    mapping(address => mapping(bytes32 => uint256)) public issuerGroupCapPlain;
    mapping(address => mapping(bytes32 => uint256)) public issuerGroupOutstandingPlain;

    mapping(uint8 => uint256) public tierCapPlain;
    mapping(uint8 => uint256) public tierOutstandingPlain;

    mapping(address => mapping(bytes32 => euint256)) public issuerObligorCapEncrypted;
    mapping(address => mapping(bytes32 => euint256)) public issuerObligorOutstandingEncrypted;
    mapping(address => mapping(bytes32 => euint256)) public issuerGroupCapEncrypted;
    mapping(address => mapping(bytes32 => euint256)) public issuerGroupOutstandingEncrypted;

    mapping(uint8 => euint256) public tierCapEncrypted;
    mapping(uint8 => euint256) public tierOutstandingEncrypted;

    address public riskManager;

    event RiskManagerUpdated(address indexed riskManager);

    event IssuerObligorCapPlainUpdated(address indexed issuer, bytes32 indexed obligorHash, uint256 cap);
    event IssuerGroupCapPlainUpdated(address indexed issuer, bytes32 indexed groupHash, uint256 cap);
    event TierCapPlainUpdated(uint8 indexed tier, uint256 cap);

    event IssuerObligorCapEncryptedUpdated(address indexed issuer, bytes32 indexed obligorHash, bytes32 capHandle);
    event IssuerGroupCapEncryptedUpdated(address indexed issuer, bytes32 indexed groupHash, bytes32 capHandle);
    event TierCapEncryptedUpdated(uint8 indexed tier, bytes32 capHandle);

    event PlainFundingConsumed(
        address indexed issuer,
        bytes32 indexed obligorHash,
        bytes32 indexed groupHash,
        uint8 tier,
        uint256 amount
    );
    event PlainRepaymentRecorded(
        address indexed issuer,
        bytes32 indexed obligorHash,
        bytes32 indexed groupHash,
        uint8 tier,
        uint256 amount
    );

    event EncryptedFundingCommitted(
        address indexed issuer,
        bytes32 indexed obligorHash,
        bytes32 indexed groupHash,
        uint8 tier,
        bytes32 amountHandle
    );
    event EncryptedRepaymentCommitted(
        address indexed issuer,
        bytes32 indexed obligorHash,
        bytes32 indexed groupHash,
        uint8 tier,
        bytes32 amountHandle
    );
    event PlainTierMigrated(uint8 indexed fromTier, uint8 indexed toTier, uint256 amount);
    event EncryptedTierMigrated(uint8 indexed fromTier, uint8 indexed toTier, bytes32 amountHandle);

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

    function setIssuerGroupCapPlain(address issuer, bytes32 groupHash, uint256 cap) external onlyOwner {
        issuerGroupCapPlain[issuer][groupHash] = cap;
        emit IssuerGroupCapPlainUpdated(issuer, groupHash, cap);
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

    function setIssuerGroupCapEncryptedPublic(address issuer, bytes32 groupHash, uint256 cap) external onlyOwner {
        issuerGroupCapEncrypted[issuer][groupHash] = Nox.toEuint256(cap);
        Nox.allowThis(issuerGroupCapEncrypted[issuer][groupHash]);
        Nox.allow(issuerGroupCapEncrypted[issuer][groupHash], owner());
        emit IssuerGroupCapEncryptedUpdated(issuer, groupHash, euint256.unwrap(issuerGroupCapEncrypted[issuer][groupHash]));
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

    function setIssuerGroupCapEncrypted(
        address issuer,
        bytes32 groupHash,
        externalEuint256 capHandle,
        bytes calldata proof
    ) external onlyOwner {
        issuerGroupCapEncrypted[issuer][groupHash] = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(issuerGroupCapEncrypted[issuer][groupHash]);
        Nox.allow(issuerGroupCapEncrypted[issuer][groupHash], owner());
        emit IssuerGroupCapEncryptedUpdated(issuer, groupHash, euint256.unwrap(issuerGroupCapEncrypted[issuer][groupHash]));
    }

    function setTierCapEncrypted(uint8 tier, externalEuint256 capHandle, bytes calldata proof) external onlyOwner {
        tierCapEncrypted[tier] = Nox.fromExternal(capHandle, proof);
        Nox.allowThis(tierCapEncrypted[tier]);
        Nox.allow(tierCapEncrypted[tier], owner());
        emit TierCapEncryptedUpdated(tier, euint256.unwrap(tierCapEncrypted[tier]));
    }

    function consumePlainFunding(address issuer, bytes32 obligorHash, bytes32 groupHash, uint8 tier, uint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);
        if (amount == 0) revert RiskLimitExceeded();

        uint256 pairCap = issuerObligorCapPlain[issuer][obligorHash];
        if (pairCap != 0 && issuerObligorOutstandingPlain[issuer][obligorHash] + amount > pairCap) revert RiskLimitExceeded();

        uint256 groupCap = issuerGroupCapPlain[issuer][groupHash];
        if (groupCap != 0 && issuerGroupOutstandingPlain[issuer][groupHash] + amount > groupCap) revert RiskLimitExceeded();

        uint256 capTier = tierCapPlain[tier];
        if (capTier != 0 && tierOutstandingPlain[tier] + amount > capTier) revert RiskLimitExceeded();

        issuerObligorOutstandingPlain[issuer][obligorHash] += amount;
        issuerGroupOutstandingPlain[issuer][groupHash] += amount;
        tierOutstandingPlain[tier] += amount;
        emit PlainFundingConsumed(issuer, obligorHash, groupHash, tier, amount);
    }

    function recordPlainRepayment(address issuer, bytes32 obligorHash, bytes32 groupHash, uint8 tier, uint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);
        if (amount == 0) revert RiskLimitExceeded();

        uint256 pairOut = issuerObligorOutstandingPlain[issuer][obligorHash];
        issuerObligorOutstandingPlain[issuer][obligorHash] = amount >= pairOut ? 0 : pairOut - amount;

        uint256 groupOut = issuerGroupOutstandingPlain[issuer][groupHash];
        issuerGroupOutstandingPlain[issuer][groupHash] = amount >= groupOut ? 0 : groupOut - amount;

        uint256 tierOut = tierOutstandingPlain[tier];
        tierOutstandingPlain[tier] = amount >= tierOut ? 0 : tierOut - amount;

        emit PlainRepaymentRecorded(issuer, obligorHash, groupHash, tier, amount);
    }

    function enforceAndCommitConfidentialFunding(
        address issuer,
        bytes32 obligorHash,
        bytes32 groupHash,
        uint8 tier,
        euint256 amount,
        bytes calldata proofsBundle
    ) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);

        bytes[] memory proofs = abi.decode(proofsBundle, (bytes[]));
        require(proofs.length == 6);

        euint256 newPairOut = Nox.add(issuerObligorOutstandingEncrypted[issuer][obligorHash], amount);
        euint256 newGroupOut = Nox.add(issuerGroupOutstandingEncrypted[issuer][groupHash], amount);
        euint256 newTierOut = Nox.add(tierOutstandingEncrypted[tier], amount);

        ebool ok = Nox.le(newPairOut, issuerObligorCapEncrypted[issuer][obligorHash]);
        Nox.allowPublicDecryption(ok);
        require(_publicDecryptBool(ok, proofs[3]));

        ok = Nox.le(newGroupOut, issuerGroupCapEncrypted[issuer][groupHash]);
        Nox.allowPublicDecryption(ok);
        require(_publicDecryptBool(ok, proofs[4]));

        ok = Nox.le(newTierOut, tierCapEncrypted[tier]);
        Nox.allowPublicDecryption(ok);
        require(_publicDecryptBool(ok, proofs[5]));

        issuerObligorOutstandingEncrypted[issuer][obligorHash] = newPairOut;
        issuerGroupOutstandingEncrypted[issuer][groupHash] = newGroupOut;
        tierOutstandingEncrypted[tier] = newTierOut;

        Nox.allowThis(newPairOut);
        Nox.allowThis(newGroupOut);
        Nox.allowThis(newTierOut);
        Nox.allow(newPairOut, owner());
        Nox.allow(newGroupOut, owner());
        Nox.allow(newTierOut, owner());
        Nox.allow(newPairOut, riskManager);
        Nox.allow(newGroupOut, riskManager);
        Nox.allow(newTierOut, riskManager);

        emit EncryptedFundingCommitted(issuer, obligorHash, groupHash, tier, euint256.unwrap(amount));
    }

    function commitConfidentialRepayment(
        address issuer,
        bytes32 obligorHash,
        bytes32 groupHash,
        uint8 tier,
        euint256 amount
    ) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);

        euint256 pairOut = issuerObligorOutstandingEncrypted[issuer][obligorHash];
        euint256 groupOut = issuerGroupOutstandingEncrypted[issuer][groupHash];
        euint256 tierOut = tierOutstandingEncrypted[tier];

        euint256 newPairOut = Nox.sub(pairOut, amount);
        euint256 newGroupOut = Nox.sub(groupOut, amount);
        euint256 newTierOut = Nox.sub(tierOut, amount);

        issuerObligorOutstandingEncrypted[issuer][obligorHash] = newPairOut;
        issuerGroupOutstandingEncrypted[issuer][groupHash] = newGroupOut;
        tierOutstandingEncrypted[tier] = newTierOut;

        Nox.allowThis(newPairOut);
        Nox.allowThis(newGroupOut);
        Nox.allowThis(newTierOut);
        Nox.allow(newPairOut, owner());
        Nox.allow(newGroupOut, owner());
        Nox.allow(newTierOut, owner());
        Nox.allow(newPairOut, riskManager);
        Nox.allow(newGroupOut, riskManager);
        Nox.allow(newTierOut, riskManager);

        emit EncryptedRepaymentCommitted(issuer, obligorHash, groupHash, tier, euint256.unwrap(amount));
    }

    function migratePlainTier(uint8 fromTier, uint8 toTier, uint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);
        if (amount == 0) return;
        uint256 fromOut = tierOutstandingPlain[fromTier];
        require(fromOut >= amount);
        tierOutstandingPlain[fromTier] = fromOut - amount;
        tierOutstandingPlain[toTier] += amount;
        emit PlainTierMigrated(fromTier, toTier, amount);
    }

    function migrateConfidentialTier(uint8 fromTier, uint8 toTier, euint256 amount) external {
        if (msg.sender != riskManager) revert Unauthorized(msg.sender);
        euint256 newFrom = Nox.sub(tierOutstandingEncrypted[fromTier], amount);
        euint256 newTo = Nox.add(tierOutstandingEncrypted[toTier], amount);
        tierOutstandingEncrypted[fromTier] = newFrom;
        tierOutstandingEncrypted[toTier] = newTo;
        Nox.allowThis(newFrom);
        Nox.allowThis(newTo);
        Nox.allow(newFrom, owner());
        Nox.allow(newTo, owner());
        Nox.allow(newFrom, riskManager);
        Nox.allow(newTo, riskManager);
        emit EncryptedTierMigrated(fromTier, toTier, euint256.unwrap(amount));
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
