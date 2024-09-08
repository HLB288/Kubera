import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@project-serum/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { IDL, PROGRAM_ID } from './kubera_idl';

const programId = new PublicKey(PROGRAM_ID);

export function useKuberaProgram() {
  const wallet = useAnchorWallet();
  // const connection = new Connection('http://localhost:3000', 'confirmed');
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  if (!wallet) return null;

  const provider = new AnchorProvider(connection, wallet, {});

  try {
    const program = new Program(IDL, programId, provider);
    return program;
  } catch (error) {
    console.error('Error creating Program:', error);
    return null;
  }
}