export type DetectedLang = "en" | "zh";

/**
 * Detect whether the input text is primarily Chinese or English.
 * Uses CJK Unicode range ratio — if more than 30% of characters
 * are CJK, the text is considered Chinese.
 */
export function detectLanguage(text: string): DetectedLang {
  if (!text.trim()) return "en";
  const cjk = text.match(/[\u4e00-\u9fff]/g);
  const ratio = (cjk?.length ?? 0) / text.length;
  return ratio > 0.3 ? "zh" : "en";
}
