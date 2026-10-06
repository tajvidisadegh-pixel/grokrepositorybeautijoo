'use client';
import { cn } from '@/lib/utils';

export type CompletionFieldItem = { key: string; label: string; done: boolean };

export function CompletionBar({
  percent,
  className,
  fields,
  showFields,
}: {
  percent: number;
  className?: string;
  fields?: CompletionFieldItem[];
  /** When true and fields provided, list each requirement with status */
  showFields?: boolean;
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  const doneCount = fields?.filter((f) => f.done).length ?? 0;
  const totalCount = fields?.length ?? 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray">درصد تکمیل پروفایل</span>
        <span className="font-semibold text-blue" dir="ltr">
          {p}%
          {totalCount > 0 && (
            <span className="mr-1 text-xs font-normal text-gray">
              ({doneCount.toLocaleString('fa-IR')} از {totalCount.toLocaleString('fa-IR')})
            </span>
          )}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-mid">
        <div
          className="h-full rounded-full bg-gradient-to-l from-coral to-coral-dark transition-[width] duration-300"
          style={{ width: `${p}%` }}
          role="progressbar"
          aria-valuenow={p}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showFields && fields && fields.length > 0 && (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {fields.map((f) => (
            <li
              key={f.key}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs',
                f.done
                  ? 'border-blue/20 bg-blue/5 text-blue'
                  : 'border-coral/25 bg-coral/5 text-gray',
              )}
            >
              <span className="font-bold" aria-hidden>
                {f.done ? '✓' : '✗'}
              </span>
              <span className={f.done ? '' : 'text-foreground'}>{f.label}</span>
            </li>
          ))}
        </ul>
      )}
      {showFields && fields && fields.some((f) => !f.done) && (
        <p className="pt-1 text-xs text-coral">
          موارد ناقص را کامل کنید؛ تا قبل از تکمیل ۱۰۰٪ امکان انتشار نیست.
        </p>
      )}
    </div>
  );
}
