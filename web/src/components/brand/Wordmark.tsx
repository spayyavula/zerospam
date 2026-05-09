type Size = 'sm' | 'md' | 'lg';
const sizeMap: Record<Size, string> = {
  sm: 'text-[20px]',
  md: 'text-[28px]',
  lg: 'text-[38px]',
};
export function Wordmark({ size = 'md' }: { size?: Size }) {
  return (
    <span className={`font-display italic ${sizeMap[size]} text-ink select-none tracking-tight`}>
      Zero<span data-testid="wordmark-dot" className="text-signal not-italic">·</span>Spam
    </span>
  );
}
