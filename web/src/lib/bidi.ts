/** Wraps text that may run the other way (an email in an Arabic sentence) in Unicode
 * "first strong isolate" marks, so it keeps its own direction instead of scrambling
 * the sentence around it. */
export function isolate(text: string): string {
  return `⁨${text}⁩`;
}
