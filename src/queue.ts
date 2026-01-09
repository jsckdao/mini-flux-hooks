import { merge } from "zod/v4-mini";
import { AppConfig } from "./config.js";
import { Db, QueueItem } from "./db.js";
import { MinifluxApi } from "./miniflux-api.js";
import { summarizeWithOllama } from "./ollama.js";
import pino from "pino";

function mergeContentAndSummary(content: string, summary: string): string {
  const separator = "\n\n<p>------------------------</p>\n\n";
  summary = `<p>\n${summary}\n</p>`;
  return summary + separator + content;
}

export class QueueWorker {
  private timer?: NodeJS.Timeout;
  private db: Db;
  private config: AppConfig;
  private log = pino({ name: "queue" });
  private minifluxApi: MinifluxApi;

  constructor(db: Db, config: AppConfig) {
    this.db = db;
    this.config = config;
    this.minifluxApi = new MinifluxApi(config.minifluxUrl, config.minifluxApiKey);
  }

  start() {
    if (this.timer) return;
    this.log.info({ interval: this.config.queueIntervalMs }, "queue worker started");
    this.timer = setInterval(() => this.tick(), this.config.queueIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick() {
    const job = this.db.getNextPending();
    if (!job) return;

    this.log.info({ id: job.id, entryId: job.entryId }, "processing job");

    try {
      const summary = await this.handleJob(job);
      await this.minifluxApi.saveEntryContent(job.entryId, mergeContentAndSummary(job.content, summary));
      this.db.deleteQueueItem(job.id);
      this.log.info({ id: job.id }, "job done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      const nextRetryCount = job.retries + 1;
      const shouldRetry = nextRetryCount < this.config.maxRetries;
      this.db.markFailed(job.id, message, shouldRetry);
      this.log.error(
        { id: job.id, error: message, willRetry: shouldRetry },
        "job failed"
      );
    }
  }

  private async handleJob(job: QueueItem): Promise<string> {
    const prompt = `请对下面的文章内容进行总结，保持简洁明了，字数控制在150字以内。无论文章原文使用何种语言，请用中文完成总结。\n\n${job.content}`;
    const summary = await summarizeWithOllama({
      baseUrl: this.config.ollamaUrl,
      model: this.config.ollamaModel,
      prompt,
    });
    return summary.trim();
  }
}
