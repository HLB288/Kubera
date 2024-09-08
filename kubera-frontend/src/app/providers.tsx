import React from 'react';
import { WalletProviderComponent } from '@/components/WalletProviderComponent';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProviderComponent>
          {children}
        </WalletProviderComponent>
      </body>
    </html>
  );
}