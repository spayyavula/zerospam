const SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter>
    <rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/>
  </svg>`,
)}`;

export function PaperGrain() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ backgroundImage: `url("${SVG}")`, opacity: 0.06, mixBlendMode: 'multiply' }}
    />
  );
}
