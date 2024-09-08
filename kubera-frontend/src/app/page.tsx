import React from 'react';
import dynamic from 'next/dynamic';
import Dashboard from '@/components/Dashboard';
import '@solana/wallet-adapter-react-ui/styles.css';

const DynamicDashboard = dynamic(() => import('@/components/Dashboard'), { 
  loading: () => <p>Loading...</p>,
  ssr: false
});

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold">Kubera DeFi</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <DynamicDashboard />
      </main>

      <footer className="bg-secondary text-secondary-foreground py-4 mt-8">
        <div className="container mx-auto px-4 text-center">
          <p>© 2023 Kubera DeFi Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}