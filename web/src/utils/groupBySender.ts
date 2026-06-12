export type GroupableMessage = {
  id: string;
  from_address: string;
  from_name: string | null;
  received_at: number;
};

export type SenderGroup<T extends GroupableMessage> = {
  address: string; // lowercased key
  name: string | null; // first non-null from_name seen
  messages: T[]; // newest-first
  latestReceivedAt: number;
};

/** Group messages by lowercased from_address. Groups and the messages inside
 *  them are both ordered newest-first. Pure; does not mutate the input. */
export function groupBySender<T extends GroupableMessage>(messages: T[]): SenderGroup<T>[] {
  const byAddr = new Map<string, SenderGroup<T>>();
  for (const msg of messages) {
    const key = msg.from_address.toLowerCase();
    let g = byAddr.get(key);
    if (!g) {
      g = { address: key, name: msg.from_name, messages: [], latestReceivedAt: 0 };
      byAddr.set(key, g);
    }
    if (!g.name && msg.from_name) g.name = msg.from_name;
    g.messages.push(msg);
    if (msg.received_at > g.latestReceivedAt) g.latestReceivedAt = msg.received_at;
  }
  for (const g of byAddr.values()) {
    g.messages.sort((a, b) => b.received_at - a.received_at);
  }
  return [...byAddr.values()].sort((a, b) => b.latestReceivedAt - a.latestReceivedAt);
}
