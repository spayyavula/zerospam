import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

// Request shapes — identical to the server's runtime validators. Kept here as the
// documentation source; the live routes still validate with their own safeParse.
const loginRequest = z.object({
  email: z.string().min(3).regex(/.+@.+/),
  password: z.string().min(1),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

const deviceRegisterRequest = z.object({
  name: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  appVersion: z.string().optional(),
});

function jsonSchema(schema: z.ZodTypeAny) {
  // strip the $schema/definitions wrapper; inline the object schema
  const out = zodToJsonSchema(schema, { target: 'openApi3' }) as Record<string, unknown>;
  delete (out as any).$schema;
  return out;
}

// Response shapes — authored from packages/shared-api/types.ts.
const mailbox = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    address: { type: 'string' },
    domain_id: { type: 'integer' },
    display_name: { type: 'string', nullable: true },
    quarantine_ttl_hours: { type: 'integer' },
    created_at: { type: 'integer' },
  },
  required: ['id', 'address', 'domain_id', 'quarantine_ttl_hours', 'created_at'],
} as const;

const messageSummary = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    mailbox_id: { type: 'integer' },
    folder: { type: 'string', enum: ['inbox', 'quarantine', 'sent', 'trash'] },
    from_address: { type: 'string' },
    from_name: { type: 'string', nullable: true },
    to_addresses: { type: 'string' },
    subject: { type: 'string', nullable: true },
    preview: { type: 'string', nullable: true },
    received_at: { type: 'integer' },
    expires_at: { type: 'integer', nullable: true },
    read: { type: 'integer' },
    starred: { type: 'integer' },
    size_bytes: { type: 'integer' },
    attachment_count: { type: 'integer' },
  },
  required: ['id', 'mailbox_id', 'folder', 'from_address', 'to_addresses', 'received_at', 'read', 'starred', 'size_bytes', 'attachment_count'],
} as const;

const messageDetail = {
  allOf: [
    messageSummary,
    {
      type: 'object',
      properties: {
        body_text: { type: 'string', nullable: true },
        body_html: { type: 'string', nullable: true },
        cc_addresses: { type: 'string', nullable: true },
      },
    },
  ],
} as const;

const authMe = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        email: { type: 'string' },
        totp_enabled: { type: 'boolean' },
        tour_completed_at: { type: 'integer', nullable: true },
      },
      required: ['id', 'email', 'totp_enabled'],
    },
  },
  required: ['user'],
} as const;

const loginResponse = {
  oneOf: [
    { type: 'object', properties: { ok: { type: 'boolean', enum: [true] } }, required: ['ok'] },
    { type: 'object', properties: { needs_totp: { type: 'boolean', enum: [true] } }, required: ['needs_totp'] },
  ],
} as const;

const deviceRegisterResponse = {
  type: 'object',
  properties: { token: { type: 'string' } },
  required: ['token'],
} as const;

const errorResponse = {
  type: 'object',
  properties: { error: { type: 'string' } },
  required: ['error'],
} as const;

export const openApiDocument = {
  openapi: '3.0.3',
  info: { title: 'ZeroSpam API (mobile slice)', version: '0.1.0' },
  servers: [{ url: 'http://localhost:8025' }],
  tags: [{ name: 'mobile', description: 'Endpoints consumed by the mobile slice' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'Device token from POST /api/auth/devices' },
    },
    schemas: {
      LoginRequest: jsonSchema(loginRequest),
      LoginResponse: loginResponse,
      DeviceRegisterRequest: jsonSchema(deviceRegisterRequest),
      DeviceRegisterResponse: deviceRegisterResponse,
      AuthMe: authMe,
      Mailbox: mailbox,
      MessageSummary: messageSummary,
      MessageDetail: messageDetail,
      ErrorResponse: errorResponse,
    },
  },
  paths: {
    '/api/auth/login': {
      post: {
        operationId: 'login', tags: ['mobile'], summary: 'Log in (sets session cookie)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          '400': { description: 'Invalid body', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/devices': {
      post: {
        operationId: 'registerDevice', tags: ['mobile'], summary: 'Register a device, get a bearer token',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegisterRequest' } } } },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/DeviceRegisterResponse' } } } },
          '422': { description: 'Invalid body', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/me': {
      get: {
        operationId: 'getMe', tags: ['mobile'], summary: 'Current user', security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthMe' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/mailboxes': {
      get: {
        operationId: 'listMailboxes', tags: ['mobile'], summary: 'List mailboxes', security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Mailbox' } } } } },
        },
      },
    },
    '/api/messages': {
      get: {
        operationId: 'listMessages', tags: ['mobile'], summary: 'List messages in a folder', security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mailboxId', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'folder', in: 'query', required: true, schema: { type: 'string', enum: ['inbox', 'quarantine', 'sent', 'trash'] } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 100 } },
          { name: 'offset', in: 'query', required: false, schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MessageSummary' } } } } },
          '404': { description: 'Mailbox not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/messages/{id}': {
      get: {
        operationId: 'getMessage', tags: ['mobile'], summary: 'Get one message', security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageDetail' } } } },
          '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
  },
} as const;
