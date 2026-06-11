export function HardRule({ label }: { label?: string }) {
  return (
    <div className="relative my-12">
      <div data-rule className="border-t border-rule-strong" />
      {label && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-[7px] bg-paper px-3 font-mono uppercase tracking-[0.1em] text-[11px] text-ink">
          {label}
        </span>
      )}
    </div>
  );
}
