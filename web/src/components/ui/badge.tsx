import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantStyles = {
    default: 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)]',
    secondary: 'border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]',
    destructive: 'border-transparent bg-[var(--destructive)] text-[var(--destructive-foreground)]',
    success: 'border-transparent bg-[var(--success)] text-[var(--success-foreground)]',
    warning: 'border-transparent bg-[var(--warning)] text-[var(--warning-foreground)]',
    outline: 'text-[var(--foreground)]',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
