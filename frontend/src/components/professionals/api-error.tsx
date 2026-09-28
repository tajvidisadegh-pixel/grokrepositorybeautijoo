'use client';

import { PanelError } from '@/components/panel/state-blocks';

type Props = {
  message?: string;
  onRetry?: () => void;
};

/** Public API error — same visual language as panel errors. */
export function ApiErrorState({
  message = 'دریافت اطلاعات از سرور ممکن نشد.',
  onRetry,
}: Props) {
  return (
    <PanelError
      title="خطا در دریافت اطلاعات"
      message={message}
      onRetry={onRetry}
    />
  );
}
