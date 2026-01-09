# mini-flux-hooks

A small Node.js + TypeScript service to handle Miniflux webhooks and generate summaries for new entries using a local Ollama model. Jobs are queued in SQLite so work survives restarts.

## Features
- Fastify webhook endpoint (`POST /webhook`) that accepts `entries` and enqueues them.
- SQLite-backed queue with statuses (pending/processing/done/failed) and retry tracking.
- Background worker that feeds article content to a local Ollama model for summarization.
- Health check at `GET /health`.

## Requirements
- Node.js 18+
- SQLite (bundled via `better-sqlite3`)
- Local Ollama running and a model pulled (default: `llama3`).

## Quick start
```bash
npm install
npm run dev
```

The server listens on port `3000` by default and will create `./data/queue.db`.

## Configuration
Environment variables:
- `PORT` (default `3000`)
- `DB_PATH` (default `./data/queue.db`)
- `OLLAMA_URL` (default `http://localhost:11434`)
- `OLLAMA_MODEL` (default `llama3`)
- `QUEUE_INTERVAL_MS` (default `2000`): poll interval for the worker.
- `MAX_RETRIES` (default `3`): maximum retry attempts before marking a job as failed.

## Webhook payload example
```json
{
  "entries": [
    {
      "id": "123",
      "title": "Example article",
      "content": "<p>Full content here...</p>"
    }
  ]
}
```
Send this to `POST /webhook`. Each entry is deduplicated by `entry_id`.

## Notes
- On startup, any jobs left in `processing` are reset to `pending` to avoid being stuck after a crash.
- Summaries are stored in the `queue` table. Extend or add a new table if you need to push results back to Miniflux or elsewhere.
- `better-sqlite3` is synchronous; the worker processes one job per tick to keep things simple for a local setup.
