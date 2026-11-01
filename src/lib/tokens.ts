/**
 * Lightweight token estimator. Real tokenizers differ per model, so this is a heuristic:
 * CJK characters ≈ 1 token each (GLM is more efficient ≈ 0.75), Latin text ≈ 4 chars per token.
 */
export function estimateTokens(text: string, model = ''): number {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (
      (c >= 0x3040 && c <= 0x30ff) ||
      (c >= 0x3400 && c <= 0x9fff) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xff00 && c <= 0xffef) ||
      (c >= 0xac00 && c <= 0xd7af)
    )
      cjk++;
    else other++;
  }
  const cjkRate = model.startsWith('glm') ? 0.75 : 1.05;
  return Math.ceil(cjk * cjkRate + other / 3.8);
}

/** Trim text from the start so that it fits roughly within `tokens`. Cuts at a newline when possible. */
export function trimStartToTokens(text: string, tokens: number, model = ''): string {
  if (estimateTokens(text, model) <= tokens) return text;
  if (tokens <= 0) return '';
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (estimateTokens(text.slice(mid), model) <= tokens) hi = mid;
    else lo = mid + 1;
  }
  let cut = text.slice(lo);
  const nl = cut.indexOf('\n');
  if (nl > 0 && nl < cut.length * 0.2) cut = cut.slice(nl + 1);
  return cut;
}

export function trimEndToTokens(text: string, tokens: number, model = ''): string {
  if (estimateTokens(text, model) <= tokens) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (estimateTokens(text.slice(0, mid), model) <= tokens) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}
