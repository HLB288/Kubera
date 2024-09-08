"use client"

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWallet } from '@solana/wallet-adapter-react';
import { ClientWalletMultiButton } from './ClientWalletMultiButton';
import { BN } from '@project-serum/anchor';
import { useKuberaProgram } from '@/utils/anchor-config';
import { 
  PublicKey, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  Transaction 
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  getAccount, 
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

interface LoanOffer {
  id: string;
  amount: string;
  interestRate: string;
  term: string;
  requiredCollateral: string;
  lender: string;
}

const KUBERA_PROGRAM_ID = new PublicKey("8h4QZ3TgpZBBBVaybKsXaRSEDMCjGsgrVR7xYs4BdHoU");


const Dashboard: React.FC = () => {
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [term, setTerm] = useState("");
  const [collateral, setCollateral] = useState("");
  const [guaranteeAmount, setGuaranteeAmount] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [mint, setMint] = useState<PublicKey | null>(null);
  const [availableLoans, setAvailableLoans] = useState<LoanOffer[]>([]);

  const program = useKuberaProgram();
  const { publicKey } = useWallet();

  useEffect(() => {
    // Initialize mint address (replace with your actual mint address)
    const placeholderMint = new PublicKey('11111111111111111111111111111111');
    setMint(placeholderMint);
  }, []);

  useEffect(() => {
    if (program && publicKey) {
      fetchAvailableLoans();
    }
  }, [program, publicKey]);

  const log = (message: string, data?: any) => {
    console.log(`[Kubera]: ${message}`, data ? data : '');
  };

  const handleCreateLoanOffer = async () => {
    if (!program || !publicKey || !mint) {
      log("Error: Wallet not connected, program not loaded, or mint not set");
      return;
    }

    try {
      log("Creating a loan offer...");
      console.log("Program ID:", program.programId.toString());
      console.log("Wallet public key:", publicKey.toString());

      const [loanOfferCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan_offer_counter")],
        program.programId
      );
      

      const [loanOfferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan_offer"), publicKey.toBuffer()],
        program.programId
      );

      log("LoanOfferPDA:", loanOfferPda.toString());

      // Get the associated token account for the lender
      const lenderTokenAccount = await getAssociatedTokenAddress(mint, publicKey);

      // Check if the token account exists, if not, create it
      try {
        await getAccount(program.provider.connection, lenderTokenAccount);
        log("Lender token account already exists:", lenderTokenAccount.toString());
      } catch (error) {
        log("Lender token account does not exist. Creating it now...");

        const tokenProgramId = await program.provider.connection.getTokenAccountsByOwner(publicKey, { mint })
        .then(accounts => accounts.value[0]?.account.owner)
        .catch(() => TOKEN_PROGRAM_ID);

      console.log("Using Token Program ID:", tokenProgramId.toString());
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            lenderTokenAccount,
            publicKey,
            mint,
            tokenProgramId,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
        try {
          const tx = await program.provider.sendAndConfirm(transaction);
          log("Lender token account created. Transaction signature:", tx);
        } catch (sendError) {
          console.error("Error sending transaction:", sendError);
          if (sendError instanceof Error) {
            console.error("Error message:", sendError.message);
          }
          if ('logs' in sendError) {
            console.error("Transaction logs:", sendError.logs);
          }
          throw sendError; // Re-throw the error to be caught by the outer try-catch
        }
      }

      log("Lender Token Account:", lenderTokenAccount.toString());

      const amount = new BN(parseFloat(loanAmount) * LAMPORTS_PER_SOL);
      const interestRateBN = new BN(parseFloat(interestRate) * 100);
      const termInSeconds = new BN(parseInt(term) * 24 * 60 * 60);
      const requiredCollateral = new BN(parseFloat(collateral) * LAMPORTS_PER_SOL);

      log("Transaction params:", {
        amount: amount.toString(),
        interestRate: interestRateBN.toString(),
        term: termInSeconds.toString(),
        requiredCollateral: requiredCollateral.toString(),
      });

      const tx = await program.methods.createLoanOffer({
        amount: amount,
        interestRate: interestRateBN,
        term: termInSeconds,
        requiredCollateral: requiredCollateral,
      })
      .accounts({
        lender: publicKey,
        loanOfferAccount: loanOfferPda, 
        lenderTokenAccount: lenderTokenAccount,
        loanOfferCounter: loanOfferCounterPda,
        loanOfferPda: loanOfferPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

      await program.provider.connection.confirmTransaction(tx);
      log("Loan offer created successfully. Transaction signature:", tx);

      // Refresh available loans
      fetchAvailableLoans();
    } catch (error) {
      log("Error creating loan offer:", error);
      if (error instanceof Error) {
        log("Error message:", error.message);
      }
      if ('logs' in error) {
        log("Error logs:", error.logs);
      }
    }
  };

  const handleCreateGuarantorOffer = async () => {
    if (!program || !publicKey || !mint) {
      log("Error: Wallet not connected, program not loaded, or mint not set");
      return;
    }
  
    try {
      log("Creating a guarantor offer...");
      console.log("Program ID:", program.programId.toString());
      console.log("Wallet public key:", publicKey.toString());
  
      const [guarantorOfferCounterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("guarantor_offer_counter")],
        program.programId
      );
  
      const [guarantorOfferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("guarantor_offer"), publicKey.toBuffer()],
        program.programId
      );
  
      log("GuarantorOfferPDA:", guarantorOfferPda.toString());
  
      // Get the associated token account for the guarantor
      const guarantorTokenAccount = await getAssociatedTokenAddress(mint, publicKey);
  
      // Check if the token account exists, if not, create it
      try {
        await getAccount(program.provider.connection, guarantorTokenAccount);
        log("Guarantor token account already exists:", guarantorTokenAccount.toString());
      } catch (error) {
        log("Guarantor token account does not exist. Creating it now...");
        const transaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            guarantorTokenAccount,
            publicKey,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
        const tx = await program.provider.sendAndConfirm(transaction);
        log("Guarantor token account created. Transaction signature:", tx);
      }
  
      log("Guarantor Token Account:", guarantorTokenAccount.toString());
  
      const amount = new BN(parseFloat(guaranteeAmount) * LAMPORTS_PER_SOL);
      const interestRateBN = new BN(parseFloat(interestRate) * 100);
      const expiryTimestamp = new BN(Math.floor(new Date(expiryDate).getTime() / 1000));
  
      log("Transaction params:", {
        amount: amount.toString(),
        interestRate: interestRateBN.toString(),
        expiryDate: expiryTimestamp.toString(),
      });
  
      const tx = await program.methods.createGuarantorOffer(
        amount,
        interestRateBN,
        expiryTimestamp
      )
      .accounts({
        guarantor: publicKey,
        guarantorTokenAccount: guarantorTokenAccount,
        guarantorOfferCounter: guarantorOfferCounterPda,
        guarantorOffer: guarantorOfferPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  
      await program.provider.connection.confirmTransaction(tx);
      log("Guarantor offer created successfully. Transaction signature:", tx);
  
      // You might want to add a function to fetch and display guarantor offers if needed
      // fetchGuarantorOffers();
    } catch (error) {
      log("Error creating guarantor offer:", error);
      if (error instanceof Error) {
        log("Error message:", error.message);
      }
      if ('logs' in error) {
        log("Error logs:", error.logs);
      }
    }
  };

  const handleAcceptLoan = async (loanOfferId: string) => {
    if (!program || !publicKey || !mint) {
      log("Program, public key, or mint not available");
      return;
    }

    try {
      log("Accepting a loan...", { loanOfferId });

      const loanOfferIdBN = new BN(loanOfferId);

      const [loanOfferPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan_offer"), publicKey.toBuffer(), loanOfferIdBN.toArrayLike(Buffer, 'le', 8)],
        program.programId
      );

      log("Loan Offer PDA", loanOfferPda.toString());

      // Fetch the loan offer to ensure it exists
      const loanOffer = await program.account.loanOffer.fetch(loanOfferPda);
      log("Loan Offer details", loanOffer);

      const [loanPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("loan"), loanOfferPda.toBuffer(), publicKey.toBuffer()],
        program.programId
      );

      const [borrowerCollateralPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("user_collateral"), publicKey.toBuffer()],
        program.programId
      );

      const borrowerTokenAccount = await getAssociatedTokenAddress(mint, publicKey);
      const lenderTokenAccount = await getAssociatedTokenAddress(mint, loanOffer.lender);

      const [collateralTokenAccountPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("collateral_token_account"), publicKey.toBuffer()],
        program.programId
      );

      const tx = await program.methods.acceptLoan(loanOfferIdBN, false)
        .accounts({
          borrower: publicKey,
          lender: loanOffer.lender,
          loanOffer: loanOfferPda,
          loan: loanPda,
          borrowerCollateral: borrowerCollateralPda,
          borrowerTokenAccount: borrowerTokenAccount,
          lenderTokenAccount: lenderTokenAccount,
          collateralTokenAccount: collateralTokenAccountPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await program.provider.connection.confirmTransaction(tx);
      log("Loan accepted successfully. Transaction signature:", tx);

      // Refresh available loans
      fetchAvailableLoans();

    } catch (error) {
      log("Error accepting loan", error);
      if (error instanceof Error) {
        log("Error message", error.message);
      }
      if ('logs' in error) {
        log("Error logs", error.logs);
      }
    }
  };

  const fetchAvailableLoans = async () => {
    if (!program) {
      log("Error: Program not loaded");
      return;
    }

    try {
      log("Fetching available loans...");
      
      const loanOffers = await program.account.loanOffer.all(
        [
          {
            memcmp: {
              offset: 8 + 32, // Offset for the status field (8 bytes for discriminator + 32 bytes for lender pubkey)
              bytes: bs58.encode(Buffer.from([0])) // Assuming 0 represents the "Proposed" status
            }
          }
        ],
        { limit: 10 } // Limit to 10 loans
      );

      const formattedLoans = loanOffers.map(offer => ({
        id: offer.publicKey.toString(),
        amount: (offer.account.amount.toNumber() / LAMPORTS_PER_SOL).toString(),
        interestRate: (offer.account.interestRate.toNumber() / 100).toString(),
        term: (offer.account.term.toNumber() / (24 * 60 * 60)).toString(),
        requiredCollateral: (offer.account.requiredCollateral.toNumber() / LAMPORTS_PER_SOL).toString(),
        lender: offer.account.lender.toString()
      }));

      setAvailableLoans(formattedLoans);
      log("Available loans:", formattedLoans);
    } catch (error) {
      log("Error fetching available loans:", error);
      if (error instanceof Error) {
        log("Error message:", error.message);
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Kubera DeFi Platform</h1>
      <ClientWalletMultiButton className="mb-4" />
      
      <Tabs defaultValue="borrow" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="borrow">Borrow</TabsTrigger>
          <TabsTrigger value="lend">Lend</TabsTrigger>
          <TabsTrigger value="guarantor">Be a Guarantor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="borrow">
          <Card>
            <CardHeader>
              <CardTitle>Borrow Funds</CardTitle>
              <CardDescription>Find a loan that suits your needs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input 
                  type="number" 
                  placeholder="Loan Amount" 
                  value={loanAmount} 
                  onChange={(e) => setLoanAmount(e.target.value)} 
                />
                <Input 
                  type="number" 
                  placeholder="Collateral Amount" 
                  value={collateral} 
                  onChange={(e) => setCollateral(e.target.value)} 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={fetchAvailableLoans}>Find Loans</Button>
            </CardFooter>
          </Card>
          {availableLoans.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Available Loans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {availableLoans.map(loan => (
                    <div key={loan.id} className="border p-4 rounded">
                      <p>Amount: {loan.amount} SOL</p>
                      <p>Interest Rate: {loan.interestRate}%</p>
                      <p>Term: {loan.term} days</p>
                      <p>Required Collateral: {loan.requiredCollateral} SOL</p>
                      <Button onClick={() => handleAcceptLoan(loan.id)}>Accept Loan</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="lend">
          <Card>
            <CardHeader>
              <CardTitle>Create Loan Offer</CardTitle>
              <CardDescription>Offer your funds for lending</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input 
                  type="number" 
                  placeholder="Loan Amount" 
                  value={loanAmount} 
                  onChange={(e) => setLoanAmount(e.target.value)} 
                />
                <Input 
                  type="number" 
                  placeholder="Interest Rate (%)" 
                  value={interestRate} 
                  onChange={(e) => setInterestRate(e.target.value)} 
                />
                <Input 
                  type="number" 
                  placeholder="Loan Term (days)" 
                  value={term} 
                  onChange={(e) => setTerm(e.target.value)} 
                />
                <Input 
                  type="number" 
                  placeholder="Required Collateral" 
                  value={collateral} 
                  onChange={(e) => setCollateral(e.target.value)} 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleCreateLoanOffer}>Create Loan Offer</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="guarantor">
          <Card>
            <CardHeader>
              <CardTitle>Become a Guarantor</CardTitle>
              <CardDescription>Support borrowers and earn interest</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input 
                  type="number" 
                  placeholder="Guarantee Amount" 
                  value={guaranteeAmount} 
                  onChange={(e) => setGuaranteeAmount(e.target.value)} 
                />
                <Input 
                  type="number" 
                  placeholder="Interest Rate (%)" 
                  value={interestRate} 
                  onChange={(e) => setInterestRate(e.target.value)} 
                />
                <Input 
                  type="date" 
                  placeholder="Expiry Date" 
                  value={expiryDate} 
                  onChange={(e) => setExpiryDate(e.target.value)} 
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleCreateGuarantorOffer}>Create Guarantor Offer</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;