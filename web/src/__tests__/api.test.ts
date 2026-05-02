// web/src/__tests__/api.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api } from '../api';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function lastCall(fetchMock: FetchMock) {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  const [url, init] = call as [string, RequestInit];
  return { url: String(url), init: init ?? {} };
}

describe('api wrapper', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mailboxes() GETs /api/mailboxes and returns parsed JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, address: 'a@x' }]));
    const out = await api.mailboxes();
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes');
    expect(init.method).toBe('GET');
    expect(out).toEqual([{ id: 1, address: 'a@x' }]);
  });

  it('createMailbox() POSTs JSON body to /api/mailboxes', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: 7 }));
    await api.createMailbox({ address: 'b@y', displayName: 'B', quarantineTtlHours: 24 });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      address: 'b@y',
      displayName: 'B',
      quarantineTtlHours: 24,
    });
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('patchMailbox() PATCHes /api/mailboxes/:id with JSON body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.patchMailbox(42, { screenerSlaHours: 48 });
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes/42');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ screenerSlaHours: 48 });
  });

  it('deleteMailbox() DELETEs /api/mailboxes/:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.deleteMailbox(42);
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/mailboxes/42');
    expect(init.method).toBe('DELETE');
  });

  it('screenerList() GETs /api/screener?mailbox_id=:id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await api.screenerList(7);
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener?mailbox_id=7');
    expect(init.method).toBe('GET');
  });

  it('screenerAllow() POSTs body { mailbox_id, sender_address }', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ moved: 2, sender_address: 's@x', domain: 'x', suggest_domain_expand: false }),
    );
    await api.screenerAllow(7, 's@x');
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener/allow');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mailbox_id: 7, sender_address: 's@x' });
  });

  it('screenerAllowDomain() POSTs body { mailbox_id, domain }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ moved: 5 }));
    await api.screenerAllowDomain(7, 'work.dev');
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener/allow-domain');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mailbox_id: 7, domain: 'work.dev' });
  });

  it('screenerReject() POSTs body { mailbox_id, sender_address }', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ trashed: 1 }));
    await api.screenerReject(7, 's@x');
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/screener/reject');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ mailbox_id: 7, sender_address: 's@x' });
  });

  it('tourComplete() POSTs /api/users/me/tour-complete with no body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.tourComplete();
    const { url, init } = lastCall(fetchMock);
    expect(url).toBe('/api/users/me/tour-complete');
    expect(init.method).toBe('POST');
    expect(init.body == null).toBe(true);
  });

  it('throws when response is non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(api.mailboxes()).rejects.toThrow();
  });

  it('translates 401 into an unauthorized error with status=401', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'no' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(api.mailboxes()).rejects.toMatchObject({
      message: 'unauthorized',
      status: 401,
    });
  });
});
