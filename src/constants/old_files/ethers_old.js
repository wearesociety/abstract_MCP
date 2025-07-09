import { ContractFactory, Provider, Wallet } from "zksync-ethers";
import { ACCOUNT_BYTECODE, ACCOUNT_FACTORY_ABI, ACCOUNT_FACTORY_BYTECODE, ensurePrivateKeyIsSet, MY_CONTRACT_BYTECODE, MY_CONTRACT_FACTORY_ABI, MY_CONTRACT_FACTORY_BYTECODE, PRIVATE_KEY, RPC_URL, } from "./constants.js";
import { hashBytecode } from "zksync-ethers/build/utils.js";
import { Interface } from "ethers";
const provider = new Provider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);
async function deployMyContractFactory() {
    const myContractFactoryDeployer = new ContractFactory(MY_CONTRACT_FACTORY_ABI, MY_CONTRACT_FACTORY_BYTECODE, wallet);
    const contract = await myContractFactoryDeployer.deploy({
        customData: {
            // Add the bytecode for the MyContract.sol contract in the factoryDeps
            factoryDeps: [MY_CONTRACT_BYTECODE],
        },
    });
    console.log("✅ MyContractFactory deployed at:", await contract.getAddress());
    return contract;
}
async function deployMyContractUsingFactory(factoryContract) {
    const tx = await factoryContract.createMyContract();
    const receipt = await tx.wait();
    // Parse logs for MyContractCreated event
    const iface = new Interface(MY_CONTRACT_FACTORY_ABI);
    let found = false;
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed.name === "MyContractCreated") {
                console.log(`✅ Deployed new contract via factory using create: ${parsed.args.myContractAddress}`);
                found = true;
            }
        }
        catch (e) { }
    }
    if (!found) {
        console.log("⚠️  No MyContractCreated event found in logs.");
    }
}
async function deployAccountFactory() {
    const accountFactoryDeployer = new ContractFactory(ACCOUNT_FACTORY_ABI, ACCOUNT_FACTORY_BYTECODE, wallet);
    const accountBytecodeHash = hashBytecode(ACCOUNT_BYTECODE);
    const contract = await accountFactoryDeployer.deploy(accountBytecodeHash, // constructor args
    {
        customData: {
            // Add the bytecode for the Account.sol contract in the factoryDeps
            factoryDeps: [ACCOUNT_BYTECODE],
        },
    });
    console.log("✅ AccountFactory deployed at:", await contract.getAddress());
    return contract;
}
async function deployAccountUsingFactory(factoryContract) {
    const tx = await factoryContract.createAccount(wallet.address);
    const receipt = await tx.wait();
    // Parse logs for AccountCreated event (if exists)
    const iface = new Interface(ACCOUNT_FACTORY_ABI);
    let found = false;
    for (const log of receipt.logs) {
        try {
            const parsed = iface.parseLog(log);
            if (parsed.name && parsed.args && parsed.args.accountAddress) {
                console.log(`✅ Deployed new account via factory using create: ${parsed.args.accountAddress}`);
                found = true;
            }
        }
        catch (e) { }
    }
    if (!found) {
        console.log("⚠️  No AccountCreated event found in logs.");
    }
}
(async () => {
    ensurePrivateKeyIsSet();
    // Regular smart contracts:
    const myContractFactory = await deployMyContractFactory();
    await deployMyContractUsingFactory(myContractFactory);
    // Smart contract accounts:
    const accountFactory = await deployAccountFactory();
    await deployAccountUsingFactory(accountFactory);
})();
//# sourceMappingURL=ethers.js.map