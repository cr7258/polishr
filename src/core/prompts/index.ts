import type { PolishMode } from "../llm/types";
import { POLISH_EN_PROMPT } from "./polish-en";
import { POLISH_ZH_PROMPT } from "./polish-zh";
import { TRANSLATE_PROMPT } from "./translate";

const PROMPTS: Record<PolishMode, string> = {
  "polish-en": POLISH_EN_PROMPT,
  "polish-zh": POLISH_ZH_PROMPT,
  translate: TRANSLATE_PROMPT,
};

export function getPrompt(mode: PolishMode): string {
  return PROMPTS[mode];
}

export { POLISH_EN_PROMPT, POLISH_ZH_PROMPT, TRANSLATE_PROMPT };
