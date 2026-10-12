import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

/**
 * Day / night segmented switch (Apple-style two-option control).
 * Shares state with the in-app ThemeToggle through useTheme, so the choice made on
 * the landing page carries into webmail and is remembered on this device.
 */
export default function DayNightSwitch() {
  const [theme, setTheme] = useTheme();
  const options = [
    { value: 'light' as const, label: 'Day', Icon: Sun },
    { value: 'dark' as const, label: 'Night', Icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex p-0.5 rounded-full border border-rule bg-paper-deep">
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center justify-center w-8 h-7 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
              active ? 'bg-paper text-ink' : 'text-quiet hover:text-ink'
            }`}
          >
            <Icon className="w-[15px] h-[15px]" strokeWidth={1.75} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
