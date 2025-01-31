import morphoArtifact from '../../out/Morpho.sol/Morpho.json';

console.log('Bytecode type:', typeof morphoArtifact.bytecode.object);
console.log('Bytecode starts with 0x?', morphoArtifact.bytecode.object.startsWith('0x'));
console.log('Bytecode length:', morphoArtifact.bytecode.object.length);

// Export ABI and bytecode
export const MORPHO_ABI = morphoArtifact.abi;
export const MORPHO_BYTECODE = morphoArtifact.bytecode.object as `0x${string}`; 