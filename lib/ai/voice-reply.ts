// Rewrites a campaign's fixed template into a short, personalized reply in
// the account owner's voice before it goes out as a comment reply or DM. Off by
// default — only runs when ANTHROPIC_API_KEY and AI_VOICE_REPLIES=true are
// both set — and always falls back to the original template untouched on any
// failure, timeout, or missing config, so a flaky AI call never blocks a
// send that would otherwise have gone out fine.
//
// {username} and {link} tokens are preserved verbatim through the rewrite
// (never invented, never dropped) so the existing renderMessageWithTracking /
// renderMessageWithoutLink pipeline downstream keeps working unchanged: this
// only touches wording, never the token mechanics, button structure, or
// billing/rate-limit logic around it.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5";
const REQUEST_TIMEOUT_MS = 8000;

const VOICE_SYSTEM_PROMPT = `You are rewriting a short Instagram reply on behalf of the creator who owns this Instagram account, in their own voice. This is a single comment reply or DM, not an email — keep it brief (1-3 short sentences).

Non-negotiables:
- No em dashes, ever (not -, not --, not –). Use a comma or full stop instead.
- No ellipsis for effect. No more than one exclamation mark, and only if it's genuinely warranted.
- Contractions are required: "I'll", "you're", "it's", "that's" — never "I will", "it is".
- No corporate filler: never "I hope this finds you well", "I just wanted to", "please do not hesitate", "kindly note".
- Sound like a real, warm, direct person replying to another person, not a template or a bot.
- Preserve the {username} and {link} tokens EXACTLY as written, character for character, if they appear in the source message. Never remove them, never replace them with a real value, never invent a new link or name.
- Keep the same core content and any offer/link the source message is delivering. You are rewriting the wording and warmth, not the substance.
- Output ONLY the rewritten message text. No preamble, no quotes, no explanation.`;

interface PersonalizeInVoiceArgs {
  template: string;
  commenterName?: string | null;
  sourceText?: string | null;
  kind: "comment_reply" | "dm";
}

function isEnabled(): boolean {
  return (
    Boolean(process.env.ANTHROPIC_API_KEY) &&
    process.env.AI_VOICE_REPLIES === "true"
  );
}

export async function personalizeInVoice({
  template,
  commenterName,
  sourceText,
  kind,
}: PersonalizeInVoiceArgs): Promise<string> {
  if (!isEnabled() || !template.trim()) return template;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Never hand the model the real name when the template still has the
    // {username} placeholder — the actual bug this guards against: given
    // both, the model "helpfully" filled the token in with the real name
    // but kept it wrapped in braces (e.g. "{launching_jumi}"), which then
    // renders literally instead of the clean substitution downstream. The
    // model doesn't need the real name to preserve a placeholder untouched.
    const templateHasUsernameToken = /\{username\}/i.test(template);

    const contextLines = [
      `Message type: ${kind === "comment_reply" ? "public comment reply" : "direct message"}`,
      commenterName && !templateHasUsernameToken
        ? `Commenter's name: ${commenterName}`
        : null,
      sourceText ? `What they said: "${sourceText.slice(0, 300)}"` : null,
      `Source message to rewrite:\n${template}`,
    ].filter(Boolean);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY as string,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 300,
        system: process.env.AI_VOICE_GUIDE
          ? `${VOICE_SYSTEM_PROMPT}\n\nHow this creator writes:\n${process.env.AI_VOICE_GUIDE.slice(0, 2000)}`
          : VOICE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: contextLines.join("\n\n") }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[voice-reply] Anthropic API ${response.status}, falling back to template`
      );
      return template;
    }

    const data = await response.json();
    const rewritten = data?.content?.[0]?.text?.trim();
    if (!rewritten) return template;

    // Never let a rewrite silently drop the link — if the token vanished,
    // the original template is safer than a personalized message with no
    // way to deliver what it promised.
    if (/\{link\}/i.test(template) && !/\{link\}/i.test(rewritten)) {
      console.error("[voice-reply] Rewrite dropped {link} token, falling back to template");
      return template;
    }

    // Same guard for {username}: it must survive character-for-character,
    // not just "the word username somewhere" — a rewrite that mangles it
    // (e.g. wraps the real name in braces instead of leaving the token
    // alone) is worse than the original template, which at least renders
    // a clean name once the real substitution runs downstream.
    if (templateHasUsernameToken && !/\{username\}/i.test(rewritten)) {
      console.error("[voice-reply] Rewrite mangled {username} token, falling back to template");
      return template;
    }

    return rewritten;
  } catch (error) {
    console.error("[voice-reply] Generation failed, falling back to template:", error);
    return template;
  } finally {
    clearTimeout(timeout);
  }
}
