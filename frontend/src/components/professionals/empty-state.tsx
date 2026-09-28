import type { ReactNode } from 'react';
import { PanelEmpty } from '@/components/panel/state-blocks';

type Props = {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: string | null;
};

/** Public-facing empty state — same visual language as panel empties. */
export function EmptyState({
  title = 'موردی یافت نشد',
  description = 'فیلترها را تغییر دهید یا بعداً دوباره تلاش کنید.',
  action,
  icon = '🔍',
}: Props) {
  return (
    <PanelEmpty title={title} description={description} action={action} icon={icon} />
  );
}
