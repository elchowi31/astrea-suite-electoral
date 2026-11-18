const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

/** The two short Workspace tasks need JSON and a bounded provider deadline. */
export async function generateWorkspaceJson(prompt: string, apiKey = process.env.GEMINI_API_KEY) {
  if (!apiKey) throw Error('AI_SERVICE_UNAVAILABLE');
  for (const model of models) {
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(11_000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingLevel: 'LOW' },
            maxOutputTokens: 4096,
          },
        }),
      });
    } catch {
      console.warn('Workspace AI provider did not respond within the deadline', { model });
      continue;
    }
    if (!response.ok) {
      console.warn('Workspace AI provider rejected the request', { model, status: response.status });
      if ([401, 403].includes(response.status)) break;
      continue;
    }
    const result = await response.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const text = result.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('').trim();
    if (text) return text;
  }
  throw Error('AI_SERVICE_UNAVAILABLE');
}
