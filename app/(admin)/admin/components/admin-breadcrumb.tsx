import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function AdminBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
          {item.href ? (
            <Link href={item.href} className="break-all hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="break-all text-foreground">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
