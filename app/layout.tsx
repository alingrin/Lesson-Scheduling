import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Miki's Spanish Lessons",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        {/* Spanish flag stripe: red–gold–red in 1:2:1 ratio */}
        <div className="flex h-2">
          <div className="bg-es-red" style={{ flex: 1 }} />
          <div className="bg-es-yellow" style={{ flex: 2 }} />
          <div className="bg-es-red" style={{ flex: 1 }} />
        </div>
        {children}
      </body>
    </html>
  );
}
