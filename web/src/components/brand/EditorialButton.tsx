import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  children: ReactNode;
};

export function EditorialButton({ variant = 'primary', className = '', children, ...rest }: Props) {
  const base =
    'font-mono uppercase tracking-[0.08em] text-[13px] px-5 py-3 transition-colors duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'border border-ink text-ink hover:bg-signal hover:text-ink'
      : 'text-quiet underline-offset-4 hover:underline';
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}
