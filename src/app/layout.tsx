import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Product Viewer',
  description: 'Shared product page',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const company = process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'Product Viewer';
  const logo    = process.env.NEXT_PUBLIC_COMPANY_LOGO_URL ?? '';

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={company} className="h-8 w-auto object-contain" />
            )}
            <span className="font-semibold text-gray-800 text-sm">{company}</span>
            <span className="ml-auto text-xs text-gray-400 hidden sm:block">
              Powered by Akeneo PIM
            </span>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>

        <footer className="mt-16 border-t border-gray-200 py-6 text-center text-xs text-gray-400">
          Product data served by Akeneo PIM · {new Date().getFullYear()}
        </footer>
      </body>
    </html>
  );
}
