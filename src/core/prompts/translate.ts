import type { DetectedLang } from "../lang/detect";

const TARGET_LANG_NAME: Record<DetectedLang, string> = {
  zh: "English",
  en: "Chinese",
};

export function getTranslatePrompt(sourceLang: DetectedLang): string {
  const targetLang = TARGET_LANG_NAME[sourceLang];

  return `You are a professional translator. Your task is to translate the given text into ${targetLang}.

Rules:
1. Translate into fluent, idiomatic ${targetLang}.
2. Ensure the translation reads naturally to a native ${targetLang} speaker.
3. Preserve the original meaning, tone, and intent.
4. Keep technical terms, proper nouns, and brand names accurate.
5. Do NOT provide a literal word-by-word translation; aim for natural expression.

Output format:
- First line: a SHORT explanation (under 8 words) of the translation approach, e.g. "Translated to natural ${targetLang}"
- Second line: empty
- Third line onwards: the translated text only

Example output:
Translated with natural phrasing

The translated sentence goes here.`;
}
