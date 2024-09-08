# Kubera DeFi Platform

Kubera is a decentralized finance (DeFi) platform built on the Solana blockchain. It facilitates peer-to-peer lending and borrowing with an option for guarantors to support loans. The project consists of a Rust-based Anchor backend for on-chain operations and a Next.js frontend for user interactions.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Running the Project](#running-the-project)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- Create and manage loan offers
- Browse and accept available loans
- Provide guarantees for loans
- Deposit and withdraw collateral
- Repay loans

## Tech Stack

### Backend
- Solana blockchain
- Anchor framework
- Rust programming language

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui components

### Development Tools
- Anchor CLI
- Solana CLI
- Node.js and npm

## Project Structure

The project is organized into two main parts:

1. **Anchor Backend**: Contains the Rust code for the Solana program.
   - `lib.rs`: Main program file
   - `errors.rs`: Custom error definitions
   - `models.rs`: Data structures and enums
   - `states.rs`: Account structures
   - Various instruction files (e.g., `create_loan_offer.rs`, `accept_loan.rs`, etc.)

2. **Next.js Frontend**: Contains the web application code.
   - `pages/`: Next.js pages
   - `components/`: React components, including the main Dashboard
   - `utils/`: Utility functions and configurations
   - `styles/`: CSS and Tailwind configurations

## Getting Started

### Prerequisites

- Rust and Cargo
- Solana CLI
- Anchor CLI
- Node.js and npm
- Git

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/kubera-defi.git
   cd kubera-defi
   ```

2. Install Anchor dependencies:
   ```
   anchor build
   ```

3. Install frontend dependencies:
   ```
   cd app
   npm install
   ```

## Running the Project

1. Start a local Solana validator:
   ```
   solana-test-validator
   ```

2. Deploy the Anchor program:
   ```
   anchor deploy
   ```

3. Start the Next.js development server:
   ```
   cd app
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

## Testing

To run the Anchor tests:

```
anchor test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
