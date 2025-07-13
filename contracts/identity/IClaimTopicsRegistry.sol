// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IClaimTopicsRegistry
 * @notice Interface for the Claim Topics Registry in ERC-3643
 */
interface IClaimTopicsRegistry {
    event ClaimTopicAdded(uint256 indexed claimTopic);
    event ClaimTopicRemoved(uint256 indexed claimTopic);
    event TrustedIssuerAdded(address indexed issuer, uint256[] claimTopics);
    event TrustedIssuerRemoved(address indexed issuer);
    event TrustedIssuerUpdated(address indexed issuer, uint256[] claimTopics);
    
    function addClaimTopic(uint256 _claimTopic) external;
    function removeClaimTopic(uint256 _claimTopic) external;
    function addTrustedIssuer(address _issuer, uint256[] calldata _claimTopics) external;
    function removeTrustedIssuer(address _issuer) external;
    function updateTrustedIssuer(address _issuer, uint256[] calldata _claimTopics) external;
    function getTrustedIssuers() external view returns (address[] memory);
    function isTrustedIssuer(address _issuer, uint256 _claimTopic) external view returns (bool);
    function getTrustedIssuerClaimTopics(address _issuer) external view returns (uint256[] memory);
    function getClaimTopics() external view returns (uint256[] memory);
}