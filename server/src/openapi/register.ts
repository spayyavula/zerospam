import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { openApiDocument } from './spec.js';

// Documentation-only: static mode means @fastify/swagger serves the provided
// document verbatim and does NOT read route schemas, so fastify performs no
// extra validation or response serialization for any route.
export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    mode: 'static',
    // Cast through `any`: the document is a literal `as const` object that is a
    // valid OpenAPI 3 doc at runtime, but its deeply-readonly inferred type does
    // not structurally match @fastify/swagger's mutable OpenAPIV3.Document type.
    specification: { document: openApiDocument as any },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  // Explicit JSON endpoint (stable path for codegen / the extension's fetch).
  app.get('/openapi.json', async () => app.swagger());
}
