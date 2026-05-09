import { useId, type InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export function EditorialInput({ label, className = '', id, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={`space-y-2 ${className}`}>
      <label
        htmlFor={inputId}
        className="block font-mono uppercase tracking-[0.08em] text-[11px] text-quiet"
      >
        {label}
      </label>
      <input
        id={inputId}
        className="w-full bg-transparent text-ink text-[18px] font-body focus:outline-none border-b border-rule-strong focus:border-b-2 pb-2"
        {...rest}
      />
    </div>
  );
}
