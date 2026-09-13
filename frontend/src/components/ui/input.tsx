import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none transition-colors placeholder:text-gray-muted focus:border-coral focus:ring-2 focus:ring-coral/20 disabled:cursor-not-allowed disabled:bg-gray-light',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
