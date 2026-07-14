interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export async function generateStructuredContent(
  prompt: string,
  responseSchema: Record<string, unknown>
): Promise<unknown> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
  const model = Deno.env.get('GEMINI_MODEL')?.trim() || 'gemini-3.5-flash';
  if (!apiKey) throw new Error('SERVER_CONFIGURATION');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            responseFormat: {
              text: {
                mimeType: 'APPLICATION_JSON',
                schema: responseSchema,
              },
            },
          },
        }),
        signal: controller.signal,
      }
    );
    if (!response.ok) throw new Error(`GEMINI_${response.status}`);

    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('INVALID_RESPONSE');
    return JSON.parse(text) as unknown;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) throw new Error('INVALID_RESPONSE');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
