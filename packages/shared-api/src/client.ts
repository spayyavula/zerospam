export type ApiErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'validation'
  | 'network-error'
  | 'network-timeout'
  | 'http-error';

type MaybePromise<T> = T | Promise<T>;

export type ApiClientOptions = {
  baseUrl?: string;
  credentials?: RequestCredentials;
  defaultHeaders?: HeadersInit | (() => MaybePromise<HeadersInit | undefined>);
  getAuthToken?: () => MaybePromise<string | null | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type ApiRequestOptions = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
  signal?: AbortSignal;
  timeoutMs?: number;
  auth?: 'auto' | 'omit';
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | null;
  readonly data: unknown;

  constructor(message: string, code: ApiErrorCode, status: number | null, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

function isBodyInit(value: unknown): value is BodyInit {
  return value instanceof FormData
    || value instanceof URLSearchParams
    || value instanceof Blob
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
    || typeof value === 'string';
}

function mergeHeaders(...sources: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();
  for (const source of sources) {
    if (!source) continue;
    const next = new Headers(source);
    next.forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

async function resolveHeaders(
  source: ApiClientOptions['defaultHeaders'],
): Promise<HeadersInit | undefined> {
  if (typeof source === 'function') return source();
  return source;
}

function buildUrl(baseUrl: string | undefined, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function mapHttpError(status: number): ApiErrorCode {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'not-found';
  if (status === 422) return 'validation';
  return 'http-error';
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createApiClient(options: ApiClientOptions = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    if (init.signal) {
      if (init.signal.aborted) controller.abort(init.signal.reason);
      else init.signal.addEventListener('abort', () => controller.abort(init.signal?.reason), { once: true });
    }

    const timeoutMs = init.timeoutMs ?? options.timeoutMs;
    if (timeoutMs != null) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }

    try {
      const defaultHeaders = await resolveHeaders(options.defaultHeaders);
      const headers = mergeHeaders(defaultHeaders, init.headers);
      const authToken = init.auth === 'omit' ? null : await options.getAuthToken?.();
      if (authToken) headers.set('Authorization', `Bearer ${authToken}`);

      let body: BodyInit | null | undefined = init.body as BodyInit | null | undefined;
      if (init.body != null && !isBodyInit(init.body)) {
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        body = JSON.stringify(init.body);
      }

      const response = await fetchImpl(buildUrl(options.baseUrl, path), {
        method: init.method,
        body,
        headers,
        credentials: options.credentials,
        signal: controller.signal,
      });

      if (response.status === 204) return undefined as T;

      const data = await parseResponseBody(response);
      if (!response.ok) {
        throw new ApiError(
          typeof data === 'string' ? data : `${response.status} ${response.statusText}`,
          mapHttpError(response.status),
          response.status,
          data,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (timedOut) throw new ApiError('network timeout', 'network-timeout', null);
      throw new ApiError(
        error instanceof Error ? error.message : 'network error',
        'network-error',
        null,
      );
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  return {
    request,
    get: <T>(path: string, init?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'GET' }),
    post: <T>(path: string, body?: ApiRequestOptions['body'], init?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'POST', body }),
    patch: <T>(path: string, body?: ApiRequestOptions['body'], init?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
      request<T>(path, { ...init, method: 'PATCH', body }),
    delete: <T>(
      path: string,
      init?: Omit<ApiRequestOptions, 'method'>,
    ) => request<T>(path, { ...init, method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;