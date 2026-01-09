import { FastifyInstance } from "fastify";
import { z } from "zod";
import { Db } from "../db.js";

const EntrySchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  content: z.string(),
});

const WebhookPayloadSchema = z.object({
  event_type: z.string(),
  entries: z.array(EntrySchema),
});

export async function registerWebhookRoutes(app: FastifyInstance, db: Db) {
  app.post("/webhook", async (request, reply) => {
    const parsed = WebhookPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "invalid payload", details: parsed.error.errors });
    }

    if (parsed.data.event_type !== "new_entries") {
      return reply.send({ received: 0, ignore: true });
    }

    const entries = parsed.data.entries;
    for (const entry of entries) {
      db.insertQueueItem(entry.id, entry.title, entry.content);
    }

    return reply.send({ received: entries.length });
  });
}
