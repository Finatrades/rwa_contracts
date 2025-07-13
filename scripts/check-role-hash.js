const { ethers } = require("ethers");

// Calculate role hashes
console.log("Role Hashes:");
console.log("OWNER_ROLE:", ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE")));
console.log("DEFAULT_ADMIN_ROLE:", ethers.zeroPadValue("0x00", 32));
console.log("AGENT_ROLE:", ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE")));
console.log("CLAIM_ISSUER_ROLE:", ethers.keccak256(ethers.toUtf8Bytes("CLAIM_ISSUER_ROLE")));

// The hash you're asking about
const mysteryHash = "0xb19546dff01e856fb3f010c267a7b1c60363cf8a4664e21cc89c26224620214e";
console.log("\nProvided hash:", mysteryHash);
console.log("Matches OWNER_ROLE:", mysteryHash === ethers.keccak256(ethers.toUtf8Bytes("OWNER_ROLE")));