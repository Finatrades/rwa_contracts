const axios = require('axios');
require('dotenv').config();

const contracts = [
  { name: "ClaimTopicsRegistry", address: "0x315a3f5d4a482204eA7EaE89D05e64b6B90a919E" },
  { name: "IdentityRegistry", address: "0x1D6f1Ca3Df3d601A079E02dCaBd809D5Bd95fe80" },
  { name: "ClaimIssuer", address: "0x55106CFA1217A15A6bcedc7dFf9Ca0897f4E378a" },
  { name: "CountryRestrictModule", address: "0x952E87D7f2f5FDe3f387bE9bd6CE59Ad98BbD3A7" },
  { name: "TransferLimitModule", address: "0xAC4d1d37b307DE646A82A65F9a19a5a54F4D8f00" },
  { name: "MaxBalanceModule", address: "0x60540b959652Ef4E955385C6E28529520a25dcd2" },
  { name: "ModularCompliance", address: "0x9Db249617E876c18248Bf5Cd1289fA33A725170d" },
  { name: "FinatradesRWA_ERC3643", address: "0x10375fdf730D39774eF1fD20424CD0504ef35afb" },
  { name: "Timelock", address: "0xc929923D0d52Df0b72C8cf00C7c6156DB24232dE" }
];

async function checkVerificationStatus() {
  console.log("Checking verification status of all contracts on Polygonscan...\n");
  
  const apiKey = process.env.POLYGONSCAN_API_KEY;
  if (!apiKey) {
    console.error("Error: POLYGONSCAN_API_KEY not found in .env file");
    return;
  }

  for (const contract of contracts) {
    try {
      // Wait 250ms between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const url = `https://api.polygonscan.com/api?module=contract&action=getsourcecode&address=${contract.address}&apikey=${apiKey}`;
      const response = await axios.get(url);
      
      if (response.data.status === "1" && response.data.result[0].SourceCode) {
        const result = response.data.result[0];
        const isVerified = result.SourceCode !== "";
        const isProxy = result.Proxy !== "0" && result.Implementation !== "";
        
        console.log(`${contract.name} (${contract.address}):`);
        console.log(`  Status: ${isVerified ? '✅ VERIFIED' : '❌ NOT VERIFIED'}`);
        
        if (isVerified) {
          console.log(`  Contract Name: ${result.ContractName}`);
          console.log(`  Compiler: ${result.CompilerVersion}`);
          console.log(`  Optimization: ${result.OptimizationUsed === "1" ? 'Yes' : 'No'}`);
          
          if (isProxy) {
            console.log(`  Type: Proxy Contract`);
            console.log(`  Implementation: ${result.Implementation}`);
          }
        }
        console.log(`  Polygonscan: https://polygonscan.com/address/${contract.address}#code`);
        console.log();
      } else {
        console.log(`${contract.name} (${contract.address}):`);
        console.log(`  Status: ❌ NOT VERIFIED`);
        console.log(`  Polygonscan: https://polygonscan.com/address/${contract.address}#code`);
        console.log();
      }
    } catch (error) {
      console.error(`Error checking ${contract.name}: ${error.message}`);
    }
  }
  
  console.log("\nVerification check complete!");
}

checkVerificationStatus();