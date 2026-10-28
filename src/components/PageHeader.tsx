/** The top of a page: an optional way back, the title, and one line on what the page is for. */
import type { ReactNode } from 'react';
import { go } from '../lib/router';
import { ChevronLeft } from './icons';

export function PageHeader({ title, back, children, action }: { title: string; back?: { label: string; to: string }; children?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-2">
      {back && (
        <button onClick={() => go(back.to)} className="-ml-1.5 mb-3 flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm font-medium text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[1.75rem] font-semibold leading-tight">{title}</h1>
        {action}
      </div>
      {children && <p className="mt-1.5 max-w-prose text-[0.9375rem] leading-relaxed text-muted">{children}</p>}
    </header>
  );
}
