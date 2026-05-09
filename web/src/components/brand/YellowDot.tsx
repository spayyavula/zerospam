export function YellowDot({ className = '' }: { className?: string }) {
  return (
    <span
      data-testid="yellow-dot"
      aria-hidden="true"
      className={`inline-block w-[6px] h-[6px] bg-signal align-middle ${className}`}
      style={{ borderRadius: 1 }}
    />
  );
}
