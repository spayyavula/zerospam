import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

type Variant = 'header' | 'floating';

export default function ThemeToggle({ variant = 'header' }: { variant?: Variant }) {
  const [theme, , toggle] = useTheme();
  const isDark = theme === 'dark';

  const base =
    'inline-flex items-center justify-center rounded-full text-zsmuted hover:text-zstext ' +
    'transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-zsaccent/40';

  const sizing =
    variant === 'floating'
      ? 'fixed top-4 right-4 w-9 h-9 bg-zspanel/80 backdrop-blur ring-1 ring-zsborder/60 z-40 ' +
        'shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]'
      : 'w-8 h-8 hover:bg-zsborder/40';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={`${base} ${sizing}`}
    >
      {isDark ? <Sun className="w-4 h-4" strokeWidth={2.25} /> : <Moon className="w-4 h-4" strokeWidth={2.25} />}
    </button>
  );
}
