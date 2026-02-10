import type { PolishrConfig, PolishMode, ChatMessage } from "./types";
import { getPrompt } from "../prompts";
import { parseSSEStream } from "./stream";

export class PolishError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "PolishError";
  }
}

/**
 * Stream a polishing/translation request to an OpenAI-compatible API.
 * Yields content tokens as they arrive.
 *
 * @param customInstruction - Optional free-form instruction from the user
 *   (e.g. "make it more formal"). Appended to the user message.
 */
export async function* polishStream(
  text: string,
  mode: PolishMode,
  config: PolishrConfig,
  signal?: AbortSignal,
  customInstruction?: string,
): AsyncGenerator<string> {
  const systemPrompt = getPrompt(mode);

  const userContent = customInstruction
    ? `${text}\n\n[Additional instruction from user: ${customInstruction}]`
    : text;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ];

  const response = await fetch(
    `${config.apiEndpoint.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
        temperature: config.temperature,
      }),
      signal,
    },
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    if (response.status === 401) {
      throw new PolishError("Invalid API key. Check your settings.", 401);
    }
    if (response.status === 429) {
      throw new PolishError("Rate limited. Please wait and try again.", 429);
    }
    if (response.status === 404) {
      throw new PolishError(
        `Model "${config.model}" not found. Check your settings.`,
        404,
      );
    }
    throw new PolishError(
      `API error (${response.status}): ${errorBody || response.statusText}`,
      response.status,
    );
  }

  yield* parseSSEStream(response);
}

/**
 * Polish text and return the complete result (non-streaming).
 */
export async function polish(
  text: string,
  mode: PolishMode,
  config: PolishrConfig,
  signal?: AbortSignal,
  customInstruction?: string,
): Promise<string> {
  let result = "";
  for await (const token of polishStream(
    text,
    mode,
    config,
    signal,
    customInstruction,
  )) {
    result += token;
  }
  return result;
}
