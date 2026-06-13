import { describe, it, expect } from 'vitest';
import { openApiDocument } from '../src/openapi/spec.js';

describe('OpenAPI document', () => {
  it('is OpenAPI 3 with the six slice paths', () => {
    expect(openApiDocument.openapi).toMatch(/^3\./);
    const paths = Object.keys(openApiDocument.paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/auth/login',
        '/api/auth/devices',
        '/api/auth/me',
        '/api/mailboxes',
        '/api/messages',
        '/api/messages/{id}',
      ]),
    );
  });

  it('declares a bearerAuth security scheme', () => {
    expect(openApiDocument.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('gives every operation a stable operationId (deterministic codegen)', () => {
    const ids: string[] = [];
    for (const path of Object.values(openApiDocument.paths)) {
      for (const op of Object.values(path as Record<string, any>)) {
        if (op && typeof op === 'object' && 'operationId' in op) ids.push(op.operationId);
      }
    }
    expect(ids.sort()).toEqual(
      ['getMe', 'getMessage', 'listMailboxes', 'listMessages', 'login', 'registerDevice'].sort(),
    );
  });
});
