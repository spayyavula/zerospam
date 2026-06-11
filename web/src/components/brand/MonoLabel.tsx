import type { ReactNode } from 'react';
export function MonoLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono uppercase tracking-[0.06em] text-quiet text-[12px] ${className}`}
    >
      {children}
    </span>
  );
}
