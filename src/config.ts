import dotenv from "dotenv";

dotenv.config();

export interface AppConfig {
  port: number;
  dbPath: string;
  ollamaUrl: string;
  ollamaModel: string;
  queueIntervalMs: number;
  maxRetries: number;
  minifluxUrl: string;
  minifluxApiKey: string;
}

export function loadConfig(): AppConfig {
  const {
    PORT,
    DB_PATH,
    OLLAMA_URL,
    OLLAMA_MODEL,
    QUEUE_INTERVAL_MS,
    MAX_RETRIES,
    MINIFLUX_URL,
    MINIFLUX_API_KEY,
  } = process.env;

  return {
    port: Number(PORT ?? 3000),
    dbPath: DB_PATH ?? "./data/queue.db",
    ollamaUrl: OLLAMA_URL ?? "http://localhost:11434",
    ollamaModel: OLLAMA_MODEL ?? "llama3",
    queueIntervalMs: Number(QUEUE_INTERVAL_MS ?? 2000),
    maxRetries: Number(MAX_RETRIES ?? 3),
    minifluxUrl: MINIFLUX_URL ?? "http://localhost:8080",
    minifluxApiKey: MINIFLUX_API_KEY ?? "",
  };
}
