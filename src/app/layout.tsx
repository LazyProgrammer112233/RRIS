import { Toaster } from 'react-hot-toast';
import './globals.css';
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata = {
  title: 'RRIS | Retail AI Intelligence',
  description: 'Advanced retail refrigeration audit powered by Gemini Vision CoV.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <style>{`
          body {
            background: #0a0510;
          }
        `}</style>
      </head>
      <body className={`${outfit.className} min-h-screen mesh-gradient selection:bg-purple-500/30 overflow-x-hidden`}>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(20, 10, 35, 0.8)',
              color: '#fff',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
            }
          }}
        />
        {children}
      </body>
    </html>
  );
}
