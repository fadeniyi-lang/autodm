import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { parseCommentEvents } from '@/lib/meta/webhook';

type InstagramPayload = Parameters<typeof parseCommentEvents>[0];

const envelopeSchema = z.object({
  id: z.string().min(1),
  event: z.string(),
  account: z.object({ id: z.string(), platform: z.literal('instagram') }),
  comment: z.object({
    id: z.string().min(1), platformPostId: z.string().min(1), text: z.string(),
    author: z.object({ id: z.string().min(1), username: z.string().optional() }),
  }).optional(),
  message: z.object({
    platformMessageId: z.string().min(1), direction: z.enum(['incoming', 'outgoing']),
    text: z.string().nullable(), sender: z.object({ id: z.string().min(1) }),
  }).optional(),
  conversation: z.object({ participantId: z.string().nullish() }).optional(),
  metadata: z.object({ postbackPayload: z.string().optional(), postbackTitle: z.string().optional() }).optional(),
  statusAt: z.string().optional(),
});

export function verifyZernioSignature({ rawBody, signature, secret }: {
  rawBody: string; signature: string | null; secret: string;
}): boolean {
  if (!signature || !secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
}

export function normalizeZernioEvent({ payload, account }: {
  payload: unknown; account: { zernioAccountId: string | null; instagramId: string; username: string };
}): InstagramPayload | null {
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success || parsed.data.account.id !== account.zernioAccountId) return null;
  const { event, comment, message, metadata, conversation, statusAt } = parsed.data;
  const entry: InstagramPayload['entry'][number] = { id: account.instagramId, time: Date.now() };
  if (event === 'comment.received' && comment) {
    // Zernio's comment.author.id for the connected account's own comments
    // uses a different id space than account.instagramId (the two don't
    // match even though they're the same account), so the generic
    // commenterId === entry.id self-check in parseCommentEvents silently
    // never fires here. Without this, the bot's own public replies come
    // back in as new "incoming" comments and it replies to itself forever.
    // Username is the one field Zernio reports consistently for the
    // account either way, so it's the reliable self-check for this provider.
    if (comment.author.username?.toLowerCase() === account.username.toLowerCase()) {
      return null;
    }
    entry.changes = [{ field: 'comments', value: { id: comment.id, text: comment.text, from: comment.author, media: { id: comment.platformPostId } } }];
  } else if (event === 'message.received' && message?.direction === 'incoming') {
    const sender = { id: message.sender.id };
    entry.messaging = [metadata?.postbackPayload
      ? { sender, postback: { mid: message.platformMessageId, payload: metadata.postbackPayload, title: metadata.postbackTitle } }
      : { sender, message: { mid: message.platformMessageId, text: message.text ?? '' } }];
  } else if (event === 'message.read' && conversation?.participantId) {
    const watermark = statusAt ? Date.parse(statusAt) : undefined;
    entry.messaging = [{ sender: { id: conversation.participantId }, read: { watermark: watermark !== undefined && Number.isFinite(watermark) ? watermark : undefined } }];
  } else {
    return null;
  }
  return { object: 'instagram', entry: [entry] };
}
