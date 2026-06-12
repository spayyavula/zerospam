import { describe, it, expect } from 'vitest';
import { closeAll } from '../src/shutdown.js';

describe('closeAll', () => {
  it('invokes every closer once, in order', async () => {
    const calls: string[] = [];
    await closeAll([
      { name: 'a', close: async () => { calls.push('a'); } },
      { name: 'b', close: async () => { calls.push('b'); } },
    ]);
    expect(calls).toEqual(['a', 'b']);
  });

  it('continues if one closer throws and reports the failures', async () => {
    const calls: string[] = [];
    const errors = await closeAll([
      { name: 'a', close: async () => { throw new Error('boom'); } },
      { name: 'b', close: async () => { calls.push('b'); } },
    ]);
    expect(calls).toEqual(['b']);
    expect(errors.map((e) => e.name)).toEqual(['a']);
  });
});
