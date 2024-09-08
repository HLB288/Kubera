"use client";

import React from 'react';
import { WalletContextProvider } from './WalletContextProvider';

interface ClientLayoutProps {
  children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
  return (
    <WalletContextProvider>
      {children}
    </WalletContextProvider>
  );
};

export default ClientLayout;