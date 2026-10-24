import { db, user, boards } from '@/db';
import { and, desc, eq, gte, isNotNull, sql, type SQL } from 'drizzle-orm';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ADMIN_EMAIL } from '@/lib/admin';
import {
  METRICS_RANGES,
  formatCents,
  metricsRangeStart,
  parseMetricsRange,
  percentOf,
  type MetricsRange,
} from '@/lib/admin-metrics';
import { cn } from '@/lib/utils';

// The admin's own account (test boards, Etsy orders) is left out everywhere.
const notAdmin = sql`lower(${user.email}) <> ${ADMIN_EMAIL}`;

// A user "uploaded" once any card on any of their boards has their own photo.
const uploaded = sql`exists (
  select 1 from cards c
  where c.user_id = ${user.id} and c.is_default = false and c.original_image_url is not null
)`;
// Paid through Stripe — admin-unlocked boards have no payment id.
const paid = sql`exists (
  select 1 from boards b where b.user_id = ${user.id} and b.stripe_payment_id is not null
)`;
const exported = sql`exists (
  select 1 from board_exports e where e.user_id = ${user.id} and e.source <> 'admin'
)`;

async function getFunnel(start: Date | null) {
  const where: SQL[] = [notAdmin];
  if (start) where.push(gte(user.createdAt, start));

  const [row] = await db
    .select({
      signedUp: sql<number>`count(*)`,
      uploaded: sql<number>`count(*) filter (where ${uploaded})`,
      paid: sql<number>`count(*) filter (where ${uploaded} and ${paid})`,
      paidAndExported: sql<number>`count(*) filter (where ${uploaded} and ${paid} and ${exported})`,
      exportedFree: sql<number>`count(*) filter (where ${exported} and not ${paid})`,
    })
    .from(user)
    .where(and(...where));

  return {
    signedUp: Number(row.signedUp),
    uploaded: Number(row.uploaded),
    paid: Number(row.paid),
    paidAndExported: Number(row.paidAndExported),
    exportedFree: Number(row.exportedFree),
  };
}

function paymentFilters(start: Date | null): SQL[] {
  const where: SQL[] = [isNotNull(boards.stripePaymentId), notAdmin];
  if (start) where.push(gte(boards.unlockedAt, start));
  return where;
}

async function getRevenue(start: Date | null) {
  const [row] = await db
    .select({
      payments: sql<number>`count(*)`,
      gross: sql<number>`coalesce(sum(${boards.amountPaidCents}), 0)`,
      discounts: sql<number>`coalesce(sum(${boards.amountDiscountCents}), 0)`,
      refunds: sql<number>`coalesce(sum(${boards.amountRefundedCents}), 0)`,
      withCode: sql<number>`count(*) filter (where ${boards.promotionCode} is not null)`,
      missingDetails: sql<number>`count(*) filter (where ${boards.amountPaidCents} is null)`,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(and(...paymentFilters(start)));

  const gross = Number(row.gross);
  const refunds = Number(row.refunds);
  const payments = Number(row.payments);
  const missingDetails = Number(row.missingDetails);
  const withAmount = payments - missingDetails;

  return {
    payments,
    gross,
    discounts: Number(row.discounts),
    refunds,
    net: gross - refunds,
    average: withAmount > 0 ? Math.round(gross / withAmount) : null,
    withCode: Number(row.withCode),
    missingDetails,
  };
}

async function getPayments(start: Date | null) {
  return db
    .select({
      boardId: boards.id,
      boardName: boards.name,
      unlockedAt: boards.unlockedAt,
      amountPaidCents: boards.amountPaidCents,
      amountDiscountCents: boards.amountDiscountCents,
      amountRefundedCents: boards.amountRefundedCents,
      currency: boards.currency,
      promotionCode: boards.promotionCode,
      userId: user.id,
      userEmail: user.email,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(and(...paymentFilters(start)))
    .orderBy(desc(boards.unlockedAt))
    .limit(100);
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </CardContent>
    </Card>
  );
}

function RangeTabs({ active }: { active: MetricsRange }) {
  return (
    <nav aria-label="Time range" className="flex flex-wrap gap-1">
      {METRICS_RANGES.map((r) => (
        <Link
          key={r.key}
          href={`/admin/metrics?range=${r.key}`}
          aria-current={r.key === active ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            r.key === active
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const range = parseMetricsRange((await searchParams).range);
  const start = metricsRangeStart(range);
  const [funnel, revenue, payments] = await Promise.all([
    getFunnel(start),
    getRevenue(start),
    getPayments(start),
  ]);

  const steps = [
    { label: 'Signed up', count: funnel.signedUp },
    { label: 'Uploaded a photo', count: funnel.uploaded },
    { label: 'Paid', count: funnel.paid },
    { label: 'Paid & exported', count: funnel.paidAndExported },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Metrics</h2>
        <RangeTabs active={range} />
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Funnel</CardTitle>
          <p className="text-xs text-muted-foreground">
            Users who signed up in this range, excluding the admin account. Each step counts users
            who also reached every step before it.
          </p>
        </CardHeader>
        <CardContent>
          <div className="-mx-6 overflow-x-auto px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Of previous</TableHead>
                  <TableHead className="text-right">Of signups</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step, i) => (
                  <TableRow key={step.label}>
                    <TableCell className="whitespace-nowrap text-sm">{step.label}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{step.count}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {i === 0 ? '—' : formatPercent(percentOf(step.count, steps[i - 1].count))}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                      {formatPercent(percentOf(step.count, funnel.signedUp))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Used the free export without paying:{' '}
            <span className="tabular-nums text-foreground">{funnel.exportedFree}</span>
          </p>
        </CardContent>
      </Card>

      {/* Revenue */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Revenue (by unlock date)</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <Stat
            label="Net revenue"
            value={formatCents(revenue.net)}
            note={
              revenue.refunds > 0 ? `after ${formatCents(revenue.refunds)} refunded` : undefined
            }
          />
          <Stat
            label="Paid boards"
            value={String(revenue.payments)}
            note={revenue.average !== null ? `avg ${formatCents(revenue.average)} each` : undefined}
          />
          <Stat
            label="Discounts given"
            value={formatCents(revenue.discounts)}
            note={`${revenue.withCode} of ${revenue.payments} used a code`}
          />
          <Stat label="Gross collected" value={formatCents(revenue.gross)} />
        </div>
        {revenue.missingDetails > 0 && (
          <p className="text-xs text-muted-foreground">
            {revenue.missingDetails} payment{revenue.missingDetails === 1 ? ' has' : 's have'} no
            amount recorded yet and {revenue.missingDetails === 1 ? 'is' : 'are'} left out of the
            totals. Run <code className="font-mono">pnpm backfill:payments</code> to fill them in.
          </p>
        )}
      </div>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments in this range</p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Board</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.boardId}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {p.unlockedAt?.toLocaleDateString() ?? '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/admin/users/${p.userId}`} className="text-xs hover:underline">
                          {p.userEmail}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">
                        <Link
                          href={`/admin/boards/${p.boardId}`}
                          className="text-xs hover:underline"
                        >
                          {p.boardName}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                        {p.amountPaidCents === null
                          ? 'Unknown'
                          : formatCents(p.amountPaidCents, p.currency ?? undefined)}
                        {p.amountRefundedCents > 0 && (
                          <span className="ml-1 text-destructive">
                            (−{formatCents(p.amountRefundedCents, p.currency ?? undefined)}{' '}
                            refunded)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {p.promotionCode ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
