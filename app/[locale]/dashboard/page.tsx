import { redirect } from '@/i18n/navigation';

/** Keep saved dashboard links working without showing an intermediate index. */
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/start', locale });
}
