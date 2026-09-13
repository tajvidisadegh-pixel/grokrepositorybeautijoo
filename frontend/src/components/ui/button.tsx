import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-coral text-white shadow-sm hover:bg-coral-dark disabled:bg-coral-light disabled:text-white/80',
  secondary:
    'bg-blue text-white shadow-sm hover:bg-blue-dark disabled:bg-blue-light disabled:text-blue',
  outline:
    'border border-border bg-white text-foreground hover:border-coral/40 hover:bg-coral-soft',
  ghost: 'bg-transparent text-foreground hover:bg-gray-light',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 min-h-9 px-3 text-sm rounded-xl',
  md: 'h-11 min-h-11 px-4 text-sm rounded-2xl',
  lg: 'h-12 min-h-12 px-6 text-base rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/35 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? 'لطفاً صبر کنید...' : children}
    </button>
  ),
);
Button.displayName = 'Button';
