// Generates a real, specific written explanation of why a top-performing
// Instagram post worked, reading the post's actual caption rather than just
// reporting engagement-rate multiples. The numbers say a post did well; only
// the content says why — the hook, the topic, the ask — so this is what
// answers "why" in a way a stat can't.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5";
const REQUEST_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are a sharp social media strategist explaining to a creator why one specific Instagram post of theirs outperformed their others. You have the post's actual caption and its stats relative to their average.

Write 2-3 short bullet points of real, specific analysis grounded in what the caption actually says: the hook, the topic, the promise, the call to action, the tone. Reference actual words or ideas from the caption when relevant. This is analysis of the content itself, not a restatement of the numbers you were given.

Non-negotiables:
- Output each point on its own line, starting with "- ". Nothing else on the line.
- Each point is one short sentence, not a paragraph.
- No em dashes, ever (not -, not --, not –). Use a comma or full stop.
- Contractions required: "it's", "that's", "you're".
- No filler, no "great job", no cheerleading. Direct, specific, useful.
- If the caption is missing or too short to say anything real, output exactly one bullet point saying so plainly rather than inventing an explanation.
- Output ONLY the bullet points. No preamble, no labels, no quotes.`;

/** Split the model's "- point" lines into a plain array, dropping the marker. */
function parseBulletPoints(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean);
}

export async function generatePostInsight({
  caption,
  reachMultiple,
  standoutMetrics,
}: {
  caption: string | null;
  reachMultiple: number;
  standoutMetrics: string[];
}): Promise<string[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const context = [
      `Reach: ${reachMultiple.toFixed(1)}x their account average.`,
      standoutMetrics.length > 0
        ? `Standout engagement: ${standoutMetrics.join(", ")}, all well above their average rate.`
        : null,
      caption
        ? `The post's caption: "${caption.slice(0, 600)}"`
        : "No caption text was available for this post.",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 220,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[post-insight] Anthropic API ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) return null;
    const points = parseBulletPoints(text);
    return points.length > 0 ? points : null;
  } catch (error) {
    console.error("[post-insight] Generation failed:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
