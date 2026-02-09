export interface PolishrConfig {
  apiEndpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export type PolishMode = "polish-en" | "polish-zh" | "translate";

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

export const DEFAULT_CONFIG: PolishrConfig = {
  apiEndpoint: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4o",
  temperature: 0.3,
};

export const PRESET_ENDPOINTS = [
  { label: "OpenAI", value: "https://api.openai.com/v1" },
  { label: "DeepSeek", value: "https://api.deepseek.com/v1" },
  { label: "Ollama (local)", value: "http://localhost:11434/v1" },
] as const;
