import { redirect } from 'next/navigation';
import { parseMetricsRange } from '@/lib/admin-metrics';

/** Metrics moved onto the overview; keep old links working. */
export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  redirect(`/admin?range=${parseMetricsRange((await searchParams).range)}#metrics`);
}
