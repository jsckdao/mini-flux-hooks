interface SummarizeParams {
  baseUrl: string;
  model: string;
  prompt: string;
}

export async function summarizeWithOllama(params: SummarizeParams): Promise<string> {
  const url = new URL("/api/generate", params.baseUrl).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ollama request failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { response?: string };
  if (!data.response) {
    throw new Error("ollama response missing 'response' field");
  }

  return data.response;
}
