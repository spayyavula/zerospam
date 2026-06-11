import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function OtpGrid({ value, onChange, disabled }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const setAt = (i: number, ch: string) => {
    const arr = digits.slice();
    arr[i] = ch.replace(/\D/, '').slice(0, 1);
    onChange(arr.join('').slice(0, 6));
  };

  const handleChange = (i: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) {
      setAt(i, '');
      return;
    }
    setAt(i, v.slice(-1));
    if (v && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKey = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 0) return;
    e.preventDefault();
    onChange(text);
    refs.current[Math.min(text.length, 5)]?.focus();
  };

  return (
    <div className="flex gap-3">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          role="textbox"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={d}
          onChange={handleChange(i)}
          onKeyDown={handleKey(i)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="w-12 h-14 text-center font-mono text-[28px] text-ink bg-transparent border-b border-rule-strong focus:border-b-2 focus:outline-none disabled:opacity-50"
        />
      ))}
    </div>
  );
}
