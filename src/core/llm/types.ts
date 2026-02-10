export interface PolishrConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export type PolishMode = "improve" | "rephrase" | "translate";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
}

/** A configured LLM provider (e.g. OpenAI, DeepSeek). */
export interface Provider {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
}

/** A saved polish history record. */
export interface HistoryRecord {
  id: string;
  timestamp: number;
  mode: PolishMode;
  inputText: string;
  resultText: string;
  provider: string;
}

/** Built-in provider presets with default endpoints and models. */
export const PROVIDER_PRESETS: Omit<Provider, "apiKey">[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    temperature: 0.3,
  },
  {
    id: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o",
    temperature: 0.3,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o",
    temperature: 0.3,
  },
  {
    id: "minimax",
    name: "MiniMax",
    endpoint: "https://api.minimax.chat/v1",
    model: "abab6.5s-chat",
    temperature: 0.3,
  },
];

export const DEFAULT_CONFIG: PolishrConfig = {
  apiEndpoint: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.3,
};
