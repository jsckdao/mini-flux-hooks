import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { Db } from "./db.js";
import { QueueWorker } from "./queue.js";
import { registerWebhookRoutes } from "./routes/webhook.js";

async function main() {
  const config = loadConfig();
  const db = new Db(config);
  await db.init();
  
  const queue = new QueueWorker(db, config);

  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ status: "ok" }));
  await registerWebhookRoutes(app, db);

  queue.start();

  const shutdown = async () => {
    queue.stop();
    db.close();
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info({ port: config.port }, "server started");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
