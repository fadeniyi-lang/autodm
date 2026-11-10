import {
  MetaApiError,
  RateLimitError,
  TokenExpiredError,
} from "@/lib/meta/client";

export class ZernioApiError extends MetaApiError {
  constructor(status: number) {
    super(
      status,
      undefined,
      undefined,
      `Zernio request failed (HTTP ${status})`
    );
    this.name = "ZernioApiError";
  }
}

export class ZernioDeliveryUnconfirmedError extends ZernioApiError {
  constructor() {
    super(502);
    this.name = "ZernioDeliveryUnconfirmedError";
    this.message =
      "Message delivery is unconfirmed. Inspect the Instagram inbox before retrying.";
  }
}

// A structural Instagram restriction, not a transient failure: nested-reply
// comments, Story/Ad comments, and comments from users whose privacy
// settings block DMs can never get a private reply, on any attempt. This
// text is Instagram's own error description (no credentials in it), unlike
// the general response body zernioRequest otherwise discards unread —
// distinguishing this one case lets the worker stop retrying something that
// will fail identically forever, and log it as a real skip instead of an
// error.
export class ZernioIneligibleReplyError extends ZernioApiError {
  constructor() {
    super(400);
    this.name = "ZernioIneligibleReplyError";
    this.message =
      "Instagram won't allow a private reply on this comment (a nested reply, a Story/Ad comment, or the commenter's privacy settings block DMs).";
  }
}

export async function zernioRequest<T>({
  apiKey,
  path,
  method = "GET",
  body,
  idempotencyKey,
}: {
  apiKey: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
}): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new Error("Invalid Zernio API path");
  const response = await fetch(`https://zernio.com/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  }).catch(() => {
    throw new ZernioApiError(502);
  });
  // Responses can contain platform credentials. Only the HTTP classification is
  // safe to persist in job errors or return to the browser — but discarding
  // the body entirely (as this used to) means even server-side logs never
  // say why a 400 happened, which is a real diagnosis dead end. Logging it
  // server-side only (console, not the thrown error) is safe: Railway logs
  // aren't user-facing.
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error(
      `[Zernio] ${method} ${path} -> HTTP ${response.status}: ${bodyText.slice(0, 500)}`
    );
    if (
      response.status === 400 &&
      /not eligible for a private reply/i.test(bodyText)
    ) {
      throw new ZernioIneligibleReplyError();
    }
    const message = `Zernio request failed (HTTP ${response.status})`;
    if (response.status === 429) throw new RateLimitError(message);
    if (response.status === 401) throw new TokenExpiredError(message);
    throw new ZernioApiError(response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json().catch(() => {
    throw new ZernioApiError(502);
  }) as Promise<T>;
}
