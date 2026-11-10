const SKIPPED_PREFIX = "SKIPPED_";

export interface StatusCountRow {
  status: string;
  _count: number | { status?: number; _all?: number };
}

export interface KeywordCountRow {
  matchedKeyword: string | null;
  _count: number | { matchedKeyword?: number; _all?: number };
}

function getCount(value: StatusCountRow["_count"] | KeywordCountRow["_count"]) {
  if (typeof value === "number") return value;
  if ("status" in value && typeof value.status === "number") {
    return value.status;
  }
  if ("matchedKeyword" in value && typeof value.matchedKeyword === "number") {
    return value.matchedKeyword;
  }
  return value._all ?? 0;
}

export function calculateCtr(clicks: number, sent: number) {
  if (sent <= 0) return 0;
  // Raw clicks can exceed sends (repeat clicks, link-preview bots hitting the
  // tracked URL), which makes a "rate" over 100% — cap it so CTR stays sane.
  return Math.min(100, Number(((clicks / sent) * 100).toFixed(1)));
}

export function summarizeDmStatuses(rows: StatusCountRow[]) {
  return rows.reduce(
    (summary, row) => {
      const count = getCount(row._count);
      if (row.status === "SENT") summary.sent += count;
      if (row.status === "FAILED") summary.failed += count;
      if (row.status.startsWith(SKIPPED_PREFIX)) summary.skipped += count;
      return summary;
    },
    { sent: 0, skipped: 0, failed: 0 }
  );
}

export function normalizeTopKeywords(rows: KeywordCountRow[], limit = 5) {
  return rows
    .filter((row) => row.matchedKeyword)
    .map((row) => ({
      keyword: row.matchedKeyword as string,
      count: getCount(row._count),
    }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}

// Common English filler words that would otherwise dominate a word-frequency
// count without saying anything about what a comment is actually about.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "to", "of", "in", "on", "for", "with", "this", "that", "it", "its",
  "i", "you", "your", "my", "me", "we", "us", "he", "she", "they", "them",
  "do", "did", "does", "so", "just", "not", "no", "yes", "can", "will",
  "would", "could", "should", "have", "has", "had", "at", "as", "by",
  "from", "up", "out", "if", "then", "than", "too", "very", "how", "what",
  "when", "where", "who", "get", "got", "go", "going", "want", "need",
  "please", "thanks", "thank", "love", "like", "im", "its", "u", "ur",
]);

/**
 * "An automation set to fire on any word" has no configured trigger keyword
 * for normalizeTopKeywords to count — matchedKeyword is null on every row.
 * This extracts real, meaningful words directly from what people actually
 * typed, so "what are people commenting" still has an answer for that case.
 * Case-insensitive; strips punctuation/emoji; drops stopwords and anything
 * under 3 characters.
 */
export function extractOrganicKeywords(
  comments: string[],
  limit = 8
): { keyword: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const comment of comments) {
    const words = comment
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

    // Count each distinct word once per comment, not once per occurrence —
    // a comment repeating a word shouldn't outweigh ten different commenters
    // all saying it once.
    for (const word of new Set(words)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}
