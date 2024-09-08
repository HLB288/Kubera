import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Kubera } from "../target/types/kubera";
import { expect } from "chai";
import { 
  Keypair, 
  SystemProgram, 
  LAMPORTS_PER_SOL, 
  PublicKey,
  Connection,
  Transaction,
} from "@solana/web3.js";
import { 
  TOKEN_PROGRAM_ID, 
  createMint, 
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  AccountLayout,
  createMintToInstruction,
} from "@solana/spl-token";

describe("Kubera", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const connection = new Connection("http://localhost:3000", "confirmed");
  const wallet = new anchor.Wallet(Keypair.generate());
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Our program's generated IDL and the `programId` it was deployed to.
  const program = anchor.workspace.Kubera as Program<Kubera>;

  console.log("Wallet public key:", wallet.publicKey.toString());

  let lender: Keypair;
  let borrower: Keypair;
  let guarantor: Keypair;
  let mint: PublicKey;
  let mintAuthority: Keypair;
  let lenderTokenAccount: PublicKey;
  let borrowerTokenAccount: PublicKey;
  let guarantorTokenAccount: PublicKey;
  let loanOfferPda: PublicKey;
  let loanPda: PublicKey;
  let borrowerCollateralPda: PublicKey;
  let guarantorCollateralPda: PublicKey;
  let loanOfferCounterPda: PublicKey;
  let guarantorOfferCounterPda: PublicKey;
  let collateralTokenAccountPda: PublicKey;
  let guarantorCollateralTokenAccountPda: PublicKey;
  let guarantorOfferPda: PublicKey;

  const loanAmount = new anchor.BN(5 * LAMPORTS_PER_SOL);
  const interestRate = new anchor.BN(500); // 5%
  const term = new anchor.BN(30 * 24 * 60 * 60); // 30 days in seconds
  const requiredCollateral = new anchor.BN(7 * LAMPORTS_PER_SOL);
  const insufficientCollateral = new anchor.BN(1 * LAMPORTS_PER_SOL);

  let loanOfferId: anchor.BN;
  let guarantorOfferId: anchor.BN;

  function verifySigner(signer: Keypair, name: string) {
    if (!signer || !signer.publicKey) {
      throw new Error(`${name} keypair is not properly initialized`);
    }
    console.log(`${name} public key:`, signer.publicKey.toString());
  }

  async function checkTokenAccountOwnership(connection: Connection, tokenAccount: PublicKey, expectedOwner: PublicKey) {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo) {
      throw new Error(`Token account ${tokenAccount.toString()} does not exist`);
    }
    const data = AccountLayout.decode(accountInfo.data);
    if (!data.owner.equals(expectedOwner)) {
      throw new Error(`Token account ${tokenAccount.toString()} is not owned by ${expectedOwner.toString()}`);
    }
    console.log(`Token account ${tokenAccount.toString()} is correctly owned by ${expectedOwner.toString()}`);
  }

  async function verifyAccountExists(connection: Connection, publicKey: PublicKey, accountName: string): Promise<void> {
    const accountInfo = await connection.getAccountInfo(publicKey);
    if (!accountInfo) {
      throw new Error(`${accountName} account does not exist: ${publicKey.toString()}`);
    }
    console.log(`${accountName} account exists: ${publicKey.toString()}`);
  }

  async function mintTokens(lender: Keypair, mintAuthority: Keypair, destination: PublicKey, amount: number): Promise<string> {
    console.log(`Minting ${amount} tokens to ${destination.toString()}`);
    try {
      // Ensure amount is a positive integer
      const safeAmount = Math.floor(Math.max(0, amount));
      
      const mintTx = new Transaction().add(
        createMintToInstruction(
          mint,
          destination,
          mintAuthority.publicKey,
          safeAmount,
          [mintAuthority]
        )
      );
  
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      mintTx.recentBlockhash = latestBlockhash.blockhash;
      mintTx.feePayer = lender.publicKey;
      
      // Sign the transaction with both the lender and the mint authority
      mintTx.sign(lender, mintAuthority);
      
      const rawTx = mintTx.serialize();
      const signature = await provider.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      await provider.connection.confirmTransaction(signature);
      console.log(`Minting transaction signature: ${signature}`);
      return signature;
    } catch (error) {
      console.error("Error minting tokens:", error);
      throw error;
    }
  }

  

  async function initializeBorrowerCollateral() {
    console.log("Initializing borrower collateral account");
    try {
      const [borrowerCollateralTokenAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from("collateral_token_account"), borrower.publicKey.toBuffer()],
        program.programId
      );
  
      const tx = await program.methods.depositCollateral(new anchor.BN(LAMPORTS_PER_SOL / 100)) // Deposit 0.01 token to initialize
        .accounts({
          user: borrower.publicKey,
          userCollateral: borrowerCollateralPda,
          userTokenAccount: borrowerTokenAccount,
          collateralTokenAccount: borrowerCollateralTokenAccountPda,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();
  
      await provider.connection.confirmTransaction(tx);
      console.log("Borrower collateral account initialized. Transaction signature:", tx);
  
      // Verify the collateral account state
      const collateralAccount = await program.account.userCollateral.fetch(borrowerCollateralPda);
      console.log("Borrower collateral account state:", collateralAccount);
  
    } catch (error) {
      console.error("Error initializing borrower collateral:", error);
      throw error;
    }
  }

  async function checkBalance(publicKey: PublicKey, name: string) {
    const balance = await provider.connection.getBalance(publicKey);
    console.log(`${name} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    return balance;
  }

  async function verifyLoanExists() {
    console.log("Verifying loan account exists");
    try {
      const loanAccount = await program.account.loan.fetch(loanPda);
      console.log("Loan account:", loanAccount);
      return loanAccount;
    } catch (error) {
      console.error("Error fetching loan account:", error);
      throw new Error("Loan account does not exist or couldn't be fetched");
    }
  }

  async function initializeCollateralAccount(user: Keypair, userTokenAccount: PublicKey) {
    console.log(`Initializing collateral account for ${user.publicKey.toString()}`);
    try {
      // Check token balance before initializing
      const balanceBefore = await provider.connection.getTokenAccountBalance(userTokenAccount);
      console.log(`Token balance before initialization: ${balanceBefore.value.uiAmount}`);
  
      const [userCollateralPda] = await PublicKey.findProgramAddress(
        [Buffer.from("user_collateral"), user.publicKey.toBuffer()],
        program.programId
      );
  
      const [collateralTokenAccountPda] = await PublicKey.findProgramAddress(
        [Buffer.from("collateral_token_account"), user.publicKey.toBuffer()],
        program.programId
      );
  
      const tx = await program.methods.depositCollateral(new anchor.BN(LAMPORTS_PER_SOL / 100)) // Deposit 0.01 token to initialize
        .accounts({
          user: user.publicKey,
          userCollateral: userCollateralPda,
          userTokenAccount: userTokenAccount,
          collateralTokenAccount: collateralTokenAccountPda,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user])
        .rpc();
  
      console.log(`Collateral account initialized. Transaction signature: ${tx}`);
  
      // Check token balance after initializing
      const balanceAfter = await provider.connection.getTokenAccountBalance(userTokenAccount);
      console.log(`Token balance after initialization: ${balanceAfter.value.uiAmount}`);
  
      return collateralTokenAccountPda;
    } catch (error) {
      console.error("Error initializing collateral account:", error);
      throw error;
    }
  }

  before(async () => {
    console.log("Initializing accounts...");
    
    // Initialize keypairs
    lender = Keypair.generate();
    borrower = Keypair.generate();
    guarantor = Keypair.generate();
    mintAuthority = Keypair.generate();

    console.log("Keypairs generated:");
    console.log("Lender public key:", lender.publicKey.toString());
    console.log("Borrower public key:", borrower.publicKey.toString());
    console.log("Guarantor public key:", guarantor.publicKey.toString());
    console.log("Mint authority public key:", mintAuthority.publicKey.toString());

    // Function to confirm airdrop
    const confirmAirdrop = async (address: PublicKey, amount: number) => {
      try {
        const signature = await provider.connection.requestAirdrop(address, amount);
        const latestBlockhash = await provider.connection.getLatestBlockhash();
        await provider.connection.confirmTransaction({
          signature,
          ...latestBlockhash
        });
        console.log(`Airdrop of ${amount / LAMPORTS_PER_SOL} SOL to ${address.toString()} confirmed`);
      } catch (error) {
        console.error(`Error during airdrop to ${address.toString()}:`, error);
        throw error;
      }
    };

    console.log("Airdropping SOL to lender, borrower, guarantor, and mint authority...");
    await confirmAirdrop(lender.publicKey, 20 * LAMPORTS_PER_SOL);
    await confirmAirdrop(borrower.publicKey, 20 * LAMPORTS_PER_SOL);
    await confirmAirdrop(guarantor.publicKey, 20 * LAMPORTS_PER_SOL);
    await confirmAirdrop(mintAuthority.publicKey, 20 * LAMPORTS_PER_SOL);

    console.log("Creating mint...");
    try {
      mint = await createMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        9
      );
      console.log("Mint created:", mint.toString());
    } catch (error) {
      console.error("Error creating mint:", error);
      throw error;
    }

    console.log("Creating token accounts...");
    try {
      const lenderTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        lender,
        mint,
        lender.publicKey
      );
      lenderTokenAccount = lenderTokenAccountInfo.address;
      console.log("Lender token account created:", lenderTokenAccount.toString());

      const borrowerTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        borrower,
        mint,
        borrower.publicKey
      );
      borrowerTokenAccount = borrowerTokenAccountInfo.address;
      console.log("Borrower token account created:", borrowerTokenAccount.toString());

      const guarantorTokenAccountInfo = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        guarantor,
        mint,
        guarantor.publicKey
      );
      guarantorTokenAccount = guarantorTokenAccountInfo.address;
      console.log("Guarantor token account created:", guarantorTokenAccount.toString());
    } catch (error) {
      console.error("Error creating token accounts:", error);
      throw error;
    }

    console.log("Minting tokens to lender, borrower and guarantor...");
    try {
      // Check balances before minting
      await checkBalance(mintAuthority.publicKey, "Mint authority");
      await checkBalance(lender.publicKey, "Lender");
      await checkBalance(borrower.publicKey, "Borrower");
      await checkBalance(guarantor.publicKey, "Guarantor");
  
      await mintTokens(lender, mintAuthority, lenderTokenAccount, 10 * LAMPORTS_PER_SOL);
      await mintTokens(borrower, mintAuthority, borrowerTokenAccount, 30 * LAMPORTS_PER_SOL);
      await mintTokens(guarantor, mintAuthority, guarantorTokenAccount, 30 * LAMPORTS_PER_SOL);
      console.log("Tokens minted successfully to lender, borrower and guarantor");
  
      // Check token balances after minting
      const lenderBalance = await provider.connection.getTokenAccountBalance(lenderTokenAccount);
      console.log("Lender token balance:", lenderBalance.value.uiAmount);
      const guarantorBalance = await provider.connection.getTokenAccountBalance(guarantorTokenAccount);
      console.log("Guarantor token balance:", guarantorBalance.value.uiAmount);
    } catch (error) {
      console.error("Error minting tokens:", error);
      throw error;
    }

    // Derive PDAs
    [loanOfferCounterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("loan_offer_counter")],
      program.programId
    );

    [guarantorOfferCounterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("guarantor_offer_counter")],
      program.programId
    );

    const providerBalance = await provider.connection.getBalance(provider.wallet.publicKey);
    console.log("Provider wallet balance:", providerBalance / LAMPORTS_PER_SOL, "SOL");

    if (providerBalance < LAMPORTS_PER_SOL) {
      console.log("Provider wallet balance is low. Airdropping 1 SOL...");
      await confirmAirdrop(provider.wallet.publicKey, LAMPORTS_PER_SOL);
    }

    // Initialize counters
    try {
      await program.account.loanOfferCounter.fetch(loanOfferCounterPda);
    } catch (e) {
      console.log("Initializing LoanOfferCounter account...");
      const tx = await program.methods.initializeLoanOfferCounter()
        .accounts({
          loanOfferCounter: loanOfferCounterPda,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

        await provider.connection.confirmTransaction(tx);
        console.log("LoanOfferCounter initialized. Transaction signature:", tx);
        const loanOfferCounter = await program.account.loanOfferCounter.fetch(loanOfferCounterPda);
        console.log("LoanOfferCounter account:", loanOfferCounter);
    }

    try {
      await program.account.guarantorOfferCounter.fetch(guarantorOfferCounterPda);
    } catch (e) {
      console.log("Initializing GuarantorOfferCounter account...");
      await program.methods.initializeGuarantorOfferCounter()
        .accounts({
          guarantorOfferCounter: guarantorOfferCounterPda,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    console.log("Loan Offer Counter PDA:", loanOfferCounterPda.toString());
    console.log("Guarantor Offer Counter PDA:", guarantorOfferCounterPda.toString());

    [borrowerCollateralPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_collateral"), borrower.publicKey.toBuffer()],
      program.programId
    );
    console.log("Borrower Collateral PDA:", borrowerCollateralPda.toString());

    [guarantorCollateralPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_collateral"), guarantor.publicKey.toBuffer()],
      program.programId
    );
    console.log("Guarantor Collateral PDA:", guarantorCollateralPda.toString());

    console.log("Provider wallet public key:", provider.wallet.publicKey.toString());

    console.log("Minting tokens to lender...");
    const mintAmount = new anchor.BN(20 * LAMPORTS_PER_SOL); // Mint 20 tokens to the lender
    
    // Airdrop some SOL to the lender to pay for transaction fees
    const lenderAirdropSignature = await provider.connection.requestAirdrop(lender.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(lenderAirdropSignature);
    console.log("Airdropped 2 SOL to lender for transaction fees");
  
    try {
      await mintTokens(lender, mintAuthority, lenderTokenAccount, mintAmount.toNumber());
      console.log("Tokens minted successfully to lender");
  
      // Check lender's token balance
      const lenderBalance = await provider.connection.getTokenAccountBalance(lenderTokenAccount);
      console.log("Lender token balance:", lenderBalance.value.uiAmount);
    } catch (error) {
      console.error("Error during token minting:", error);
      throw error;
    }
  
    // Check token balances
    const lenderBalance = await provider.connection.getTokenAccountBalance(lenderTokenAccount);
    const borrowerBalance = await provider.connection.getTokenAccountBalance(borrowerTokenAccount);
    const guarantorBalance = await provider.connection.getTokenAccountBalance(guarantorTokenAccount);
  
    // console.log("Lender token balance:", lenderBalance.value.uiAmount);
    console.log("Borrower token balance:", borrowerBalance.value.uiAmount);
    console.log("Guarantor token balance:", guarantorBalance.value.uiAmount);
  
    // Initialize collateral accounts
    collateralTokenAccountPda = await initializeCollateralAccount(borrower, borrowerTokenAccount);
    guarantorCollateralTokenAccountPda = await initializeCollateralAccount(guarantor, guarantorTokenAccount);
  
  
  

    // Initialize borrower collateral account
    await initializeBorrowerCollateral();
  });

  it("Can create a loan offer", async () => {
    console.log("Creating a loan offer...");

    const counterBefore = await program.account.loanOfferCounter.fetch(loanOfferCounterPda);
    loanOfferId = counterBefore.count;

    [loanOfferPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("loan_offer"),
        lender.publicKey.toBuffer(),
        loanOfferId.toArrayLike(Buffer, 'le', 8)
      ],
      program.programId
    );

    console.log("LoanOfferPDA:", loanOfferPda.toString());

    try {
      const tx = await program.methods.createLoanOffer({
        amount: loanAmount,
        interestRate,
        term,
        requiredCollateral,
      })
      .accounts({
        lender: lender.publicKey,
        loanOfferAccount: loanOfferPda,
        lenderTokenAccount: lenderTokenAccount,
        loanOfferCounter: loanOfferCounterPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([lender])
      .rpc();

      await provider.connection.confirmTransaction(tx);
      console.log("Transaction confirmed:", tx);

      const loanOfferAccount = await program.account.loanOffer.fetch(loanOfferPda);
      console.log("LoanOffer account:", loanOfferAccount);

      expect(loanOfferAccount.lender.toString()).to.equal(lender.publicKey.toString());
      expect(loanOfferAccount.amount.toNumber()).to.equal(loanAmount.toNumber());
      expect(loanOfferAccount.interestRate.toNumber()).to.equal(interestRate.toNumber());
      expect(loanOfferAccount.term.toNumber()).to.equal(term.toNumber());
      expect(loanOfferAccount.requiredCollateral.toNumber()).to.equal(requiredCollateral.toNumber());
      expect(loanOfferAccount.status).to.deep.equal({ proposed: {} });
      expect(loanOfferAccount.loanOfferId.toNumber()).to.equal(loanOfferId.toNumber());

      console.log("Loan offer created successfully");
    } catch (error) {
      console.error("Error creating loan offer:", error);
      throw error;
    }
  });

  it("Can create a guarantor offer", async () => {
    console.log("Creating a guarantor offer...");

    const counterBefore = await program.account.guarantorOfferCounter.fetch(guarantorOfferCounterPda);
    guarantorOfferId = counterBefore.count;

    [guarantorOfferPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("guarantor_offer"),
        guarantor.publicKey.toBuffer(),
        guarantorOfferId.toArrayLike(Buffer, 'le', 8)
      ],
      program.programId
    );

    console.log("GuarantorOfferPDA:", guarantorOfferPda.toString());

    const guarantorAmount = new anchor.BN(6 * LAMPORTS_PER_SOL);
    const guarantorInterestRate = new anchor.BN(200); // 2%
    const expiryDate = new anchor.BN(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30); // 30 days from now

    try {
      const tx = await program.methods.createGuarantorOffer(
        guarantorAmount,
        guarantorInterestRate,
        expiryDate
      )
      .accounts({
        guarantor: guarantor.publicKey,
        guarantorOffer: guarantorOfferPda,
        guarantorOfferCounter: guarantorOfferCounterPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([guarantor])
      .rpc();

      await provider.connection.confirmTransaction(tx);
      console.log("Transaction confirmed:", tx);

      const guarantorOfferAccount = await program.account.guarantorOffer.fetch(guarantorOfferPda);
      console.log("GuarantorOffer account:", guarantorOfferAccount);

      expect(guarantorOfferAccount.guarantor.toString()).to.equal(guarantor.publicKey.toString());
      expect(guarantorOfferAccount.amount.toNumber()).to.equal(guarantorAmount.toNumber());
      expect(guarantorOfferAccount.interestRate.toNumber()).to.equal(guarantorInterestRate.toNumber());
      expect(guarantorOfferAccount.expiryDate.toNumber()).to.equal(expiryDate.toNumber());
      expect(guarantorOfferAccount.offerId.toNumber()).to.equal(guarantorOfferId.toNumber());

      console.log("Guarantor offer created successfully");
    } catch (error) {
      console.error("Error creating guarantor offer:", error);
      throw error;
    }
  });

  it("Guarantor can provide necessary collateral", async () => {
    console.log("Depositing collateral by guarantor...");
    const collateralAmount = requiredCollateral.toNumber();

    try {
      const tx = await program.methods.depositCollateral(new anchor.BN(collateralAmount))
        .accounts({
          user: guarantor.publicKey,
          userCollateral: guarantorCollateralPda,
          userTokenAccount: guarantorTokenAccount,
          collateralTokenAccount: guarantorCollateralTokenAccountPda,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([guarantor])
        .rpc();

      await provider.connection.confirmTransaction(tx);
      console.log("Collateral deposit transaction confirmed:", tx);

      const guarantorCollateralAccount = await program.account.userCollateral.fetch(guarantorCollateralPda);
      console.log("Collateral amount deposited:", guarantorCollateralAccount.amount.toString());
      // expect(guarantorCollateralAccount.amount.toNumber()).to.equal(collateralAmount);
      expect(guarantorCollateralAccount.amount.toNumber()).to.equal(7010000000);

      console.log("Collateral deposited successfully");
    } catch (error) {
      console.error("Error depositing collateral:", error);
      throw error;
    }
  });

  it("Cannot accept a loan with insufficient collateral", async () => {
    console.log("Starting test: Cannot accept a loan with insufficient collateral");
  
    // Mint insufficient tokens to borrower
    await mintTokens(borrower,mintAuthority, borrowerTokenAccount, insufficientCollateral.toNumber());
  
    console.log("Insufficient tokens minted to borrower");
  
    // Deposit insufficient collateral
    try {
      await program.methods.depositCollateral(insufficientCollateral)
        .accounts({
          user: borrower.publicKey,
          userCollateral: borrowerCollateralPda,
          userTokenAccount: borrowerTokenAccount,
          collateralTokenAccount: collateralTokenAccountPda,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();
  
      console.log("Insufficient collateral deposited");
  
      // Derive the PDA for the loan account
      const [loanPda] = await PublicKey.findProgramAddress(
        [Buffer.from("loan"), loanOfferPda.toBuffer(), borrower.publicKey.toBuffer()],
        program.programId
      );

      // Attempt to accept the loan
      await program.methods.acceptLoan(loanOfferId, false)
        .accounts({
          borrower: borrower.publicKey,
          lender: lender.publicKey,
          loanOffer: loanOfferPda,
          loan: loanPda,
          borrowerCollateral: borrowerCollateralPda,
          borrowerTokenAccount: borrowerTokenAccount,
          lenderTokenAccount: lenderTokenAccount,
          collateralTokenAccount: collateralTokenAccountPda,
          guarantor: null,
          guarantorCollateral: null,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([borrower])
        .rpc();
  
      expect.fail("The loan should not have been accepted with insufficient collateral");
    } catch (error) {
      console.log("Error caught:", error);
      expect(error.toString()).to.include("InsufficientCollateral");
    }
  });

  it("Borrower can accept the loan without guarantor with sufficient collateral", async () => {
    console.log("Starting test: Accept loan without guarantor");
    verifySigner(borrower, "Borrower");

    // Mint more tokens than required for collateral to the borrower
    const mintAmount = requiredCollateral.add(new anchor.BN(LAMPORTS_PER_SOL));
    await mintTokens(borrower, mintAuthority, borrowerTokenAccount, mintAmount.toNumber());

    // Verify borrower's token balance
    let borrowerBalance = await provider.connection.getTokenAccountBalance(borrowerTokenAccount);
    console.log("Borrower token balance after minting:", borrowerBalance.value.uiAmount);
    expect(borrowerBalance.value.uiAmount).to.be.at.least(requiredCollateral.toNumber() / LAMPORTS_PER_SOL);

    // Deposit collateral
    console.log("Depositing collateral");
    try {
      await program.methods.depositCollateral(requiredCollateral)
        .accounts({
          user: borrower.publicKey,
          userCollateral: borrowerCollateralPda,
          userTokenAccount: borrowerTokenAccount,
          collateralTokenAccount: collateralTokenAccountPda,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([borrower])
        .rpc();
      console.log("Collateral deposited successfully");
    } catch (error) {
      console.error("Error depositing collateral:", error);
      throw error;
    }

    const [loanOfferPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("loan_offer"),
        lender.publicKey.toBuffer(),
        loanOfferId.toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );

    // Derive loan PDA
    [loanPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("loan"), loanOfferPda.toBuffer(), borrower.publicKey.toBuffer()],
      program.programId
    );

    

    // Accept loan
    console.log("Accepting loan");
    console.log("Lender token account:", lenderTokenAccount.toString());
    console.log("Borrower token account:", borrowerTokenAccount.toString());
    console.log("Loan offer PDA:", loanOfferPda.toString());
    try {
      await program.methods.acceptLoan(loanOfferId, false)
      .accounts({
        borrower: borrower.publicKey,
        lender: lender.publicKey,
        loanOffer: loanOfferPda,
        loan: loanPda,
        borrowerCollateral: borrowerCollateralPda,
        borrowerTokenAccount: borrowerTokenAccount,
        lenderTokenAccount: lenderTokenAccount,
        collateralTokenAccount: collateralTokenAccountPda,
        loanOfferPda: loanOfferPda,
        guarantor: null,
        guarantorCollateral: null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([borrower])
      .rpc();
      console.log("Loan accepted successfully");

      // Verify loan state
      const loanAccount = await program.account.loan.fetch(loanPda);
      console.log("Loan account state:", loanAccount);
      expect(loanAccount.borrower.toString()).to.equal(borrower.publicKey.toString());
      expect(loanAccount.amount.toNumber()).to.equal(loanAmount.toNumber());
      expect(loanAccount.status).to.deep.equal({ active: {} });

      // Check borrower's final token balance
      borrowerBalance = await provider.connection.getTokenAccountBalance(borrowerTokenAccount);
      console.log("Borrower token balance after loan acceptance:", borrowerBalance.value.uiAmount);
      
      // const expectedBalance = (mintAmount.toNumber() - requiredCollateral.toNumber() + loanAmount.toNumber()) / LAMPORTS_PER_SOL;
    //   expect(borrowerBalance.value.uiAmount).to.be.closeTo(expectedBalance, 0.001);
    } catch (error) {
      console.error("Error accepting loan:", error);
      console.error("Detailed error:", JSON.stringify(error, null, 2));
      throw error;
    }
  });

  it("Borrower can accept the loan with a guarantor", async () => {
    console.log("Starting test: Accept loan with guarantor");
    verifySigner(borrower, "Borrower");
    verifySigner(guarantor, "Guarantor");

    // Create a new loan offer for this test
    const newLoanOfferId = (await program.account.loanOfferCounter.fetch(loanOfferCounterPda)).count;
    const [newLoanOfferPda] = await PublicKey.findProgramAddress(
      [Buffer.from("loan_offer"), lender.publicKey.toBuffer(), newLoanOfferId.toArrayLike(Buffer, 'le', 8)],
      program.programId
    );
    const [newLoanPda] = await PublicKey.findProgramAddress(
      [Buffer.from("loan"), newLoanOfferPda.toBuffer(), borrower.publicKey.toBuffer()],
      program.programId
    );

    await program.methods.createLoanOffer({
      amount: loanAmount,
      interestRate,
      term,
      requiredCollateral,
    })
    .accounts({
      lender: lender.publicKey,
      loanOfferAccount: newLoanOfferPda,
      lenderTokenAccount: lenderTokenAccount,
      loanOfferCounter: loanOfferCounterPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([lender])
    .rpc();

    console.log("New loan offer created for guarantor test");

    try {
      await program.methods.acceptLoan(newLoanOfferId, true)
        .accounts({
          borrower: borrower.publicKey,
          lender: lender.publicKey,
          loanOffer: newLoanOfferPda,
          loan: newLoanPda,
          borrowerCollateral: borrowerCollateralPda,
          borrowerTokenAccount: borrowerTokenAccount,
          lenderTokenAccount: lenderTokenAccount,
          collateralTokenAccount: collateralTokenAccountPda,
          guarantor: guarantor.publicKey,
          guarantorCollateral: guarantorCollateralPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([borrower])
        .rpc();

      console.log("Loan accepted successfully with guarantor");

      const loanAccount = await program.account.loan.fetch(newLoanPda);
      expect(loanAccount.status).to.deep.equal({ active: {} });
      expect(loanAccount.amount.toNumber()).to.equal(loanAmount.toNumber());
      expect(loanAccount.guarantor.toString()).to.equal(guarantor.publicKey.toString());

    } catch (error) {
      console.error("Error accepting loan with guarantor:", error);
      throw error;
    }
  });

  it("Can repay a loan", async () => {
    console.log("Repaying the loan...");

    try {
      const loanAccount = await verifyLoanExists();

      const repaymentAmount = loanAccount.amount.add(
        loanAccount.amount.mul(loanAccount.interestRate).div(new anchor.BN(10000))
      );

      // Mint additional tokens to the borrower for repayment
      await mintTokens(borrower, mintAuthority, borrowerTokenAccount, repaymentAmount.toNumber());

      const tx = await program.methods.repayLoan(repaymentAmount)
        .accounts({
          borrower: borrower.publicKey,
          loan: loanPda,
          borrowerTokenAccount: borrowerTokenAccount,
          lenderTokenAccount: lenderTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([borrower])
        .rpc();

      await provider.connection.confirmTransaction(tx);
      console.log("Repayment transaction confirmed:", tx);

      const updatedLoanAccount = await program.account.loan.fetch(loanPda);
      expect(updatedLoanAccount.status).to.deep.equal({ repaid: {} });

      console.log("Loan repaid successfully");
    } catch (error) {
      console.error("Error repaying loan:", error);
      throw error;
    }
  });

  it("Guarantor can recover collateral after loan repayment", async () => {
    console.log("Guarantor recovering collateral...");
  
    try {
      // Fetch the current collateral balance
      let guarantorCollateralAccount = await program.account.userCollateral.fetch(guarantorCollateralPda);
      const collateralAmount = guarantorCollateralAccount.amount;
      console.log("Current collateral amount:", collateralAmount.toString());
  
      // Withdraw the full collateral amount
      const tx = await program.methods.withdrawCollateral(collateralAmount)
        .accounts({
          user: guarantor.publicKey,
          userCollateral: guarantorCollateralPda,
          userTokenAccount: guarantorTokenAccount,
          collateralTokenAccount: guarantorCollateralTokenAccountPda,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([guarantor])
        .rpc();
  
      await provider.connection.confirmTransaction(tx);
      console.log("Collateral withdrawal transaction confirmed:", tx);
  
      // Fetch the updated collateral account
      guarantorCollateralAccount = await program.account.userCollateral.fetch(guarantorCollateralPda);
      console.log("Collateral amount after withdrawal:", guarantorCollateralAccount.amount.toString());
  
      // Check if the collateral account is now empty
      expect(guarantorCollateralAccount.amount.toNumber()).to.equal(0);
  
      // Optionally, check the balance of the guarantor's token account
      const guarantorTokenAccountInfo = await getAccount(provider.connection, guarantorTokenAccount);
      console.log("Guarantor token account balance:", guarantorTokenAccountInfo.amount.toString());
  
      console.log("Collateral recovered successfully");
    } catch (error) {
      console.error("Error recovering collateral:", error);
      throw error;
    }
  });

  it("Can cancel a loan offer", async () => {
    console.log("Cancelling a loan offer...");

    // Create a new loan offer to cancel
    const newLoanOfferId = (await program.account.loanOfferCounter.fetch(loanOfferCounterPda)).count;
    const [newLoanOfferPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("loan_offer"),
        lender.publicKey.toBuffer(),
        newLoanOfferId.toArrayLike(Buffer, 'le', 8)
      ],
      program.programId
    );

    // Create the loan offer
    await program.methods.createLoanOffer({
      amount: loanAmount,
      interestRate,
      term,
      requiredCollateral,
    })
    .accounts({
      lender: lender.publicKey,
      loanOfferAccount: newLoanOfferPda,
      lenderTokenAccount: lenderTokenAccount,
      loanOfferCounter: loanOfferCounterPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([lender])
    .rpc();

    console.log("New loan offer created for cancellation test");

    // Cancel the loan offer
    try {
      const tx = await program.methods.cancelLoanOffer()
        .accounts({
          lender: lender.publicKey,
          loanOffer: newLoanOfferPda,
        })
        .signers([lender])
        .rpc();

      await provider.connection.confirmTransaction(tx);
      console.log("Loan offer cancellation transaction confirmed:", tx);

      const cancelledLoanOffer = await program.account.loanOffer.fetch(newLoanOfferPda);
      expect(cancelledLoanOffer.status).to.deep.equal({ cancelled: {} });

      console.log("Loan offer cancelled successfully");
    } catch (error) {
      console.error("Error cancelling loan offer:", error);
      throw error;
    }
  });
});