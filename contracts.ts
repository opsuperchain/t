import { abi, bytecode } from "../../out/Morpho.sol/Morpho.json";

// Convert hex string to Uint8Array
function hexStringToUint8Array(hexString: string): Uint8Array {
    console.log("Input hexString:", hexString);
    console.log("Type of hexString:", typeof hexString);
    if (!hexString) {
        console.error("hexString is empty or undefined");
        throw new Error("Invalid hex string");
    }
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    console.log("Cleaned hex:", cleanHex);
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes;
}

console.log("Imported abi:", abi);
console.log("Imported bytecode:", bytecode);

export const MORPHO_ABI = abi;
export const MORPHO_BYTECODE = hexStringToUint8Array(bytecode); 