import { requireAdmin } from '@/lib/admin';
import { fontVariables } from '@/lib/fonts';
import { AdminSidebar } from './admin/components/admin-sidebar';

export const metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${fontVariables}`}>
        <div className="min-h-screen bg-background">
          <AdminSidebar email={session.user.email} />
          <main className="min-h-screen p-4 md:ml-56 md:p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
