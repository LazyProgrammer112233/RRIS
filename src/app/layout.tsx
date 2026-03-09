import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata = {
  title: 'Retail Refrigeration Intelligence',
  description: 'Analyze retail stores for refrigeration appliances using Google Maps.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Toaster position="top-right" />
        <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
              Retail Refrigeration <span className="text-blue-600">Intelligence</span>
            </h1>
            <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
              Analyze store imagery for cooling appliances directly from Google Maps links.
            </p>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
