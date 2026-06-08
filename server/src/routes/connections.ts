import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { listConnectionsForAccount, deleteConnection } from '../connections-repo.js';

export async function connectionsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/connections', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    return listConnectionsForAccount(accountId);
  });

  app.delete('/api/connections/:id', async (req, reply) => {
    const accountId = (req as any).account?.id;
    if (!accountId) return reply.code(401).send({ error: 'unauthorized' });
    const id = Number((req.params as { id: string }).id);
    const owned = db
      .prepare('SELECT 1 FROM connections WHERE id = ? AND account_id = ?')
      .get(id, accountId);
    if (!owned) return reply.code(404).send({ error: 'connection not found' });
    deleteConnection(id);
    return { ok: true };
  });
}
