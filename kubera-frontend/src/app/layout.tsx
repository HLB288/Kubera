import dynamic from 'next/dynamic';

const ClientLayout = dynamic(
  () => import('../components/ClientLayout'),
  { ssr: false }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}