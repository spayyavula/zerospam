import { describe, it, expect } from 'vitest';
import { groupBySender, type GroupableMessage } from '../groupBySender';

const m = (id: string, from: string, at: number, name?: string): GroupableMessage =>
  ({ id, from_address: from, from_name: name ?? null, received_at: at } as GroupableMessage);

describe('groupBySender', () => {
  it('groups messages by from_address, newest message first within a group', () => {
    const groups = groupBySender([
      m('1', 'a@x.com', 100),
      m('2', 'b@y.com', 300),
      m('3', 'a@x.com', 500, 'Alpha'),
    ]);
    expect(groups.map((g) => g.address)).toEqual(['a@x.com', 'b@y.com']); // a's latest (500) is newest
    expect(groups[0].messages.map((x) => x.id)).toEqual(['3', '1']); // newest-first within group
    expect(groups[0].name).toBe('Alpha'); // prefers a non-null name
    expect(groups[0].latestReceivedAt).toBe(500);
  });

  it('is case-insensitive on the address', () => {
    const groups = groupBySender([m('1', 'A@X.com', 1), m('2', 'a@x.com', 2)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].messages).toHaveLength(2);
  });

  it('returns [] for no messages', () => {
    expect(groupBySender([])).toEqual([]);
  });
});
