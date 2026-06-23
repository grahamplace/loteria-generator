import { fontVariables } from '@/lib/fonts';

// /unsubscribe lives outside the [locale] tree (it's reached straight from email
// links), so the pass-through root layout provides no <html>/<body>. This layout
// supplies them, mirroring the (admin) route group.
export default function UnsubscribeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${fontVariables}`}>
        <div className="min-h-screen bg-background">{children}</div>
      </body>
    </html>
  );
}
