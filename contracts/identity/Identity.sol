// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./IIdentity.sol";

/**
 * @title Identity
 * @notice ERC-734/735 compliant identity contract for claim management
 */
contract Identity is IIdentity {
    struct KeyData {
        uint256[] purposes;
        uint256 keyType;
        bytes32 key;
    }
    
    mapping(bytes32 => KeyData) private keys;
    mapping(uint256 => bytes32[]) private keysByPurpose;
    mapping(bytes32 => Claim) private claims;
    mapping(uint256 => bytes32[]) private claimsByTopic;
    
    mapping(uint256 => uint256) private executionNonce;
    
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(address _owner, bool _isLibrary) {
        owner = _owner;
        
        if (!_isLibrary) {
            // Add owner's key for management
            bytes32 ownerKey = keccak256(abi.encodePacked(_owner));
            keys[ownerKey].key = ownerKey;
            keys[ownerKey].purposes = [1]; // MANAGEMENT purpose
            keys[ownerKey].keyType = 1; // ECDSA
            keysByPurpose[1].push(ownerKey);
        }
    }
    
    // ERC-734 Key Management
    
    function addKey(bytes32 _key, uint256 _purpose, uint256 _keyType) 
        external 
        onlyOwner 
        returns (bool success) 
    {
        require(_key != bytes32(0), "Invalid key");
        
        if (keys[_key].key == bytes32(0)) {
            keys[_key].key = _key;
            keys[_key].keyType = _keyType;
        }
        
        // Add purpose if not already present
        bool purposeExists = false;
        for (uint i = 0; i < keys[_key].purposes.length; i++) {
            if (keys[_key].purposes[i] == _purpose) {
                purposeExists = true;
                break;
            }
        }
        
        if (!purposeExists) {
            keys[_key].purposes.push(_purpose);
            keysByPurpose[_purpose].push(_key);
        }
        
        emit KeyAdded(_key, _purpose, _keyType);
        return true;
    }
    
    function removeKey(bytes32 _key, uint256 _purpose) 
        external 
        onlyOwner 
        returns (bool success) 
    {
        require(keys[_key].key != bytes32(0), "Key does not exist");
        
        // Remove purpose from key
        uint256[] storage purposes = keys[_key].purposes;
        for (uint i = 0; i < purposes.length; i++) {
            if (purposes[i] == _purpose) {
                purposes[i] = purposes[purposes.length - 1];
                purposes.pop();
                break;
            }
        }
        
        // Remove key from purpose mapping
        bytes32[] storage keysForPurpose = keysByPurpose[_purpose];
        for (uint i = 0; i < keysForPurpose.length; i++) {
            if (keysForPurpose[i] == _key) {
                keysForPurpose[i] = keysForPurpose[keysForPurpose.length - 1];
                keysForPurpose.pop();
                break;
            }
        }
        
        // If key has no purposes left, remove it
        if (purposes.length == 0) {
            delete keys[_key];
        }
        
        emit KeyRemoved(_key, _purpose, keys[_key].keyType);
        return true;
    }
    
    function getKey(bytes32 _key) 
        external 
        view 
        returns (uint256 purpose, uint256 keyType, bytes32 key) 
    {
        // Return the first purpose if exists, 0 otherwise
        uint256 firstPurpose = keys[_key].purposes.length > 0 ? keys[_key].purposes[0] : 0;
        return (firstPurpose, keys[_key].keyType, keys[_key].key);
    }
    
    function keyHasPurpose(bytes32 _key, uint256 _purpose) 
        external 
        view 
        returns (bool exists) 
    {
        if (keys[_key].key == bytes32(0)) return false;
        
        uint256[] memory purposes = keys[_key].purposes;
        for (uint i = 0; i < purposes.length; i++) {
            if (purposes[i] == _purpose) return true;
        }
        return false;
    }
    
    function getKeysByPurpose(uint256 _purpose) 
        external 
        view 
        returns (bytes32[] memory _keys) 
    {
        return keysByPurpose[_purpose];
    }
    
    // ERC-735 Claim Management
    
    function addClaim(
        uint256 _topic,
        uint256 _scheme,
        address _issuer,
        bytes memory _signature,
        bytes memory _data,
        string memory _uri
    ) external returns (bytes32 claimId) {
        // Only self or claim issuers can add claims
        require(
            msg.sender == address(this) || 
            msg.sender == owner ||
            msg.sender == _issuer,
            "Unauthorized"
        );
        
        claimId = keccak256(abi.encodePacked(_issuer, _topic));
        
        claims[claimId].topic = _topic;
        claims[claimId].scheme = _scheme;
        claims[claimId].issuer = _issuer;
        claims[claimId].signature = _signature;
        claims[claimId].data = _data;
        claims[claimId].uri = _uri;
        
        // Add to topic index
        claimsByTopic[_topic].push(claimId);
        
        emit ClaimAdded(claimId, _topic, _scheme, _issuer, _signature, _data, _uri);
        return claimId;
    }
    
    function removeClaim(bytes32 _claimId) external returns (bool success) {
        require(
            msg.sender == owner || 
            msg.sender == claims[_claimId].issuer,
            "Unauthorized"
        );
        
        uint256 topic = claims[_claimId].topic;
        
        // Remove from topic index
        bytes32[] storage topicClaims = claimsByTopic[topic];
        for (uint i = 0; i < topicClaims.length; i++) {
            if (topicClaims[i] == _claimId) {
                topicClaims[i] = topicClaims[topicClaims.length - 1];
                topicClaims.pop();
                break;
            }
        }
        
        emit ClaimRemoved(
            _claimId,
            topic,
            claims[_claimId].scheme,
            claims[_claimId].issuer,
            claims[_claimId].signature,
            claims[_claimId].data,
            claims[_claimId].uri
        );
        
        delete claims[_claimId];
        return true;
    }
    
    function execute(address _to, uint256 _value, bytes calldata _data) 
        external 
        payable 
        onlyOwner
        returns (uint256 executionId) 
    {
        executionId = executionNonce[1]++;
        emit ExecutionRequested(executionId, _to, _value, _data);
        
        (bool success, ) = _to.call{value: _value}(_data);
        require(success, "Execution failed");
        
        emit Executed(executionId, _to, _value, _data);
        return executionId;
    }
    
    function approve(uint256 _id, bool _approve) 
        external 
        onlyOwner
        returns (bool success) 
    {
        emit Approved(_id, _approve);
        return true;
    }
    
    function getClaim(bytes32 _claimId) 
        external 
        view 
        returns (
            uint256 topic,
            uint256 scheme,
            address issuer,
            bytes memory signature,
            bytes memory data,
            string memory uri
        ) 
    {
        Claim memory claim = claims[_claimId];
        return (
            claim.topic,
            claim.scheme,
            claim.issuer,
            claim.signature,
            claim.data,
            claim.uri
        );
    }
    
    function getClaimIdsByTopic(uint256 _topic) 
        external 
        view 
        returns (bytes32[] memory claimIds) 
    {
        return claimsByTopic[_topic];
    }
    
    // Additional helper functions
    
    function isClaimValid(
        IIdentity _identity,
        uint256 _topic,
        bytes memory _sig,
        bytes memory _data
    ) public pure returns (bool) {
        // In production, implement signature verification
        // For now, assume valid if data exists
        return _sig.length > 0 && _data.length > 0;
    }
}