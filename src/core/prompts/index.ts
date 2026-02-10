import type { PolishMode } from "../llm/types";
import type { DetectedLang } from "../lang/detect";
import { IMPROVE_PROMPT } from "./improve";
import { REPHRASE_PROMPT } from "./rephrase";
import { getTranslatePrompt } from "./translate";

export function getPrompt(mode: PolishMode, lang: DetectedLang): string {
  switch (mode) {
    case "improve":
      return IMPROVE_PROMPT;
    case "rephrase":
      return REPHRASE_PROMPT;
    case "translate":
      return getTranslatePrompt(lang);
  }
}

export { IMPROVE_PROMPT } from "./improve";
export { REPHRASE_PROMPT } from "./rephrase";
export { getTranslatePrompt } from "./translate";
