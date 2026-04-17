import { requireAdmin } from '@/lib/admin';
import { AdminSidebar } from './admin/components/admin-sidebar';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar email={session.user.email} />
      <main className="ml-56 min-h-screen p-6">{children}</main>
    </div>
  );
}
