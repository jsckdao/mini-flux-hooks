
export class MinifluxApi {

  constructor(private baseUrl: string, private apiKey: string) {}

  async saveEntryContent(entryId: string, content: string): Promise<void> {
    const url = new URL(`/v1/entries/${entryId}`, this.baseUrl).toString();
    
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": this.apiKey,
      },
      body: JSON.stringify({
        content: content,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update entry ${entryId}: ${res.status} ${text}`);
    }
  }

}