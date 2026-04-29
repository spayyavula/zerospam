import { useState } from 'react';
import { api } from '../api';
import { Beaker, X } from 'lucide-react';

type Props = {
  defaultTo: string;
  onClose: () => void;
  onSent: () => void;
};

export default function InjectorPanel({ defaultTo, onClose, onSent }: Props) {
  const [to, setTo] = useState(defaultTo);
  const [from, setFrom] = useState('boss@trusted.com');
  const [fromName, setFromName] = useState('The Boss');
  const [subject, setSubject] = useState('Quick favor');
  const [text, setText] = useState('Hey — got 5 minutes to chat?');
  const [last, setLast] = useState<string | null>(null);

  const send = async () => {
    const r = (await api.inject({ to, from, fromName, subject, text })) as any;
    setLast(r?.folder ? `→ ${r.folder} (${r.reason})` : JSON.stringify(r));
    onSent();
  };

  const presets = [
    {
      label: 'Whitelisted (boss)',
      apply: () => {
        setFrom('boss@trusted.com');
        setFromName('The Boss');
        setSubject('Quick favor');
        setText('Hey — got 5 minutes to chat?');
      },
    },
    {
      label: 'Spam (will quarantine)',
      apply: () => {
        setFrom('lottery@evil.io');
        setFromName('Lottery Office');
        setSubject('You have won $10,000,000');
        setText('Click this very legitimate link.');
      },
    },
    {
      label: 'GitHub (whitelisted by domain)',
      apply: () => {
        setFrom('notifications@github.com');
        setFromName('GitHub');
        setSubject('[repo] new pull request');
        setText('A new pull request was opened.');
      },
    },
  ];

  return (
    <div className="h-full flex flex-col">
      <header className="h-12 px-4 border-b border-zsborder flex items-center gap-2">
        <Beaker className="w-4 h-4 text-zsaccent" />
        <div className="font-medium">Test Injector</div>
        <div className="text-xs text-zsmuted">
          fakes an inbound mail through the same pipeline as real SMTP
        </div>
        <div className="flex-1" />
        <button onClick={onClose} className="p-1.5 rounded hover:bg-zsborder/40">
          <X className="w-4 h-4" />
        </button>
      </header>

      <div className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={p.apply}
              className="text-xs px-2 py-1 rounded bg-zsborder/40 hover:bg-zsborder"
            >
              {p.label}
            </button>
          ))}
        </div>

        <Field label="To" value={to} onChange={setTo} />
        <Field label="From" value={from} onChange={setFrom} />
        <Field label="From name" value={fromName} onChange={setFromName} />
        <Field label="Subject" value={subject} onChange={setSubject} />
        <div>
          <div className="text-xs uppercase tracking-wider text-zsmuted mb-1">Body</div>
          <textarea
            rows={6}
            className="w-full bg-zsbg border border-zsborder rounded px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={send}
            className="bg-zsaccent text-zsbg font-medium px-4 py-2 rounded text-sm hover:opacity-90"
          >
            Send test
          </button>
          {last && <div className="text-xs text-zsmuted">{last}</div>}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-zsmuted mb-1">{label}</div>
      <input
        className="w-full bg-zsbg border border-zsborder rounded px-3 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
