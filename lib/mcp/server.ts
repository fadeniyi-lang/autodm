// The "AutoDM" MCP connector. A minimal MCP server over Streamable HTTP
// (JSON responses, no SSE), scoped to one workspace by the secret in its URL.
// Any MCP client (for example Claude, as a custom connector) can call these
// tools so a creator manages their DM automations from their AI assistant;
// the DMs themselves are still sent by AutoDM's always-on worker.
//
// Safety: new automations are always created switched off. Turning one on
// resets activeSince, the same guardrail the dashboard uses, so it never
// DMs people who commented before it went live. Nothing here deletes.

import { prisma } from "@/lib/db/client";
import { createInstagramContext, getUserMedia } from "@/lib/instagram/provider";
import { generateTrackedLinkSlug } from "@/lib/tracking/server";
import { generateReportShareSlug } from "@/lib/reports/share";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type Json = Record<string, unknown>;
interface Tool {
  name: string;
  description: string;
  inputSchema: Json;
  annotations?: Json;
  run: (workspaceId: string, args: Json) => Promise<unknown>;
}

class ToolError extends Error {}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
function httpUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

async function primaryAccount(workspaceId: string, id?: unknown) {
  const acct =
    typeof id === "string" && id
      ? await prisma.instagramAccount.findFirst({ where: { id, workspaceId } })
      : await prisma.instagramAccount.findFirst({ where: { workspaceId }, orderBy: { connectedAt: "desc" } });
  if (!acct) throw new ToolError("No Instagram account is connected in AutoDM yet. Connect it through Zernio in AutoDM Settings first.");
  return acct;
}

const TOOLS: Tool[] = [
  {
    name: "get_setup_status",
    description: "Check the AutoDM setup: connected Instagram accounts, whether Zernio is connected, and how many automations exist. Call this first.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async run(workspaceId) {
      const [accounts, zernio, total, active] = await Promise.all([
        prisma.instagramAccount.findMany({ where: { workspaceId }, select: { id: true, username: true, provider: true } }),
        prisma.zernioConnection.findUnique({ where: { workspaceId }, select: { profileId: true } }),
        prisma.automation.count({ where: { workspaceId } }),
        prisma.automation.count({ where: { workspaceId, isActive: true } }),
      ]);
      return {
        instagramAccounts: accounts,
        zernioConnected: Boolean(zernio),
        zernioProfileChosen: Boolean(zernio?.profileId),
        automations: total,
        activeAutomations: active,
        ready: accounts.length > 0,
        nextStep: accounts.length
          ? null
          : zernio
            ? "Pick your Zernio profile and import your Instagram account in AutoDM Settings."
            : "Add your Zernio API key in AutoDM Settings, then import your Instagram account.",
      };
    },
  },
  {
    name: "list_recent_posts",
    description: "List the connected Instagram account's most recent posts and reels (up to 25), so an automation can be attached to one.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 25, description: "How many posts, newest first. Default 12." },
        instagramAccountId: { type: "string", description: "Optional. Defaults to the most recently connected account." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(workspaceId, args) {
      const acct = await primaryAccount(workspaceId, args.instagramAccountId);
      const limit = typeof args.limit === "number" ? Math.min(25, Math.max(1, Math.round(args.limit))) : 12;
      const posts = await getUserMedia({ context: await createInstagramContext(acct), limit });
      return posts.map((p) => ({
        id: p.id,
        caption: (p.caption ?? "").slice(0, 300),
        type: p.media_product_type === "REELS" ? "REEL" : p.media_type,
        permalink: p.permalink ?? null,
        thumbnail: p.thumbnail_url ?? p.media_url ?? null,
        postedAt: p.timestamp,
      }));
    },
  },
  {
    name: "list_automations",
    description: "List the comment-to-DM automations with their keywords, message, link, on/off state and results so far.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    async run(workspaceId) {
      const rows = await prisma.automation.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        include: { trackedLinks: { where: { purpose: "REVEAL" }, orderBy: { sortOrder: "asc" } } },
        take: 100,
      });
      const ids = rows.map((r) => r.id);
      const [sent, clicks] = await Promise.all([
        prisma.dmLog.groupBy({ by: ["automationId"], where: { automationId: { in: ids }, status: "SENT" }, _count: true }),
        prisma.linkClick.groupBy({ by: ["automationId"], where: { automationId: { in: ids } }, _count: true }),
      ]);
      const sentBy = new Map(sent.map((s) => [s.automationId, s._count]));
      const clicksBy = new Map(clicks.map((c) => [c.automationId, c._count]));
      return rows.map((a) => ({
        id: a.id,
        name: a.name,
        active: a.isActive,
        trigger: a.pendingNextReel ? "next_reel" : a.matchAnyPost ? "any_post" : "post",
        postUrl: a.postUrl,
        keywords: a.keywords,
        matchAnyWord: a.matchAnyWord,
        dmMessage: a.dmMessage,
        linkButtonLabel: a.linkButtonLabel,
        linkUrl: a.trackedLinks[0]?.destinationUrl ?? null,
        publicReply: a.publicReplyEnabled ? a.publicReplyMessages[0] ?? a.publicReplyMessage : null,
        requireFollow: a.requireFollow,
        dmsSent: sentBy.get(a.id) ?? 0,
        linkClicks: clicksBy.get(a.id) ?? 0,
        createdAt: a.createdAt,
      }));
    },
  },
  {
    name: "create_automation",
    description:
      "Create a comment-to-DM automation. It is always created switched OFF; turn it on with set_automation_active once the creator has checked it. When someone comments one of the keywords, AutoDM sends dmMessage with a button to linkUrl.",
    inputSchema: {
      type: "object",
      required: ["name", "keywords", "dmMessage", "trigger"],
      properties: {
        name: { type: "string", maxLength: 100 },
        trigger: { type: "string", enum: ["post", "next_reel", "any_post"], description: "post = one specific post (needs postId), next_reel = the next reel they publish, any_post = every post." },
        postId: { type: "string", description: "Required when trigger is 'post'. From list_recent_posts." },
        postUrl: { type: "string" },
        keywords: { type: "array", items: { type: "string", maxLength: 50 }, minItems: 1, maxItems: 10, description: "Comment keywords, e.g. ['GUIDE']." },
        dmMessage: { type: "string", maxLength: 1000, description: "The DM text." },
        linkUrl: { type: "string", description: "The freebie link the DM button opens (https://...)." },
        linkButtonLabel: { type: "string", maxLength: 20, description: "Button text, e.g. 'Get the guide'." },
        publicReply: { type: "string", maxLength: 1000, description: "Optional public reply under the comment, e.g. 'Sent! Check your DMs'." },
        requireFollow: { type: "boolean", description: "Ask them to follow before the link is sent." },
        instagramAccountId: { type: "string" },
      },
      additionalProperties: false,
    },
    async run(workspaceId, args) {
      const acct = await primaryAccount(workspaceId, args.instagramAccountId);
      const name = str(args.name, 100);
      const dmMessage = str(args.dmMessage, 1000);
      const trigger = args.trigger === "next_reel" || args.trigger === "any_post" ? args.trigger : "post";
      const keywords = Array.isArray(args.keywords)
        ? args.keywords.map((k) => str(k, 50)).filter(Boolean).slice(0, 10)
        : [];
      const postId = str(args.postId, 100);
      if (!name) throw new ToolError("Give the automation a name.");
      if (!dmMessage) throw new ToolError("Write the DM message.");
      if (!keywords.length) throw new ToolError("Add at least one keyword.");
      if (trigger === "post" && !postId) throw new ToolError("Pick the post: call list_recent_posts and pass its id as postId.");
      const linkUrl = args.linkUrl ? httpUrl(args.linkUrl) : null;
      if (args.linkUrl && !linkUrl) throw new ToolError("The link must be a full web address starting with https://");
      const publicReply = str(args.publicReply, 1000);
      const requireFollow = args.requireFollow === true;
      const created = await prisma.automation.create({
        data: {
          workspaceId,
          instagramAccountId: acct.id,
          name,
          postId: trigger === "post" ? postId : null,
          postUrl: trigger === "post" ? httpUrl(args.postUrl) : null,
          pendingNextReel: trigger === "next_reel",
          matchAnyPost: trigger === "any_post",
          keywords,
          dmMessage,
          linkButtonLabel: str(args.linkButtonLabel, 20) || null,
          publicReplyEnabled: Boolean(publicReply),
          publicReplyMessage: publicReply || null,
          publicReplyMessages: publicReply ? [publicReply] : [],
          requireFollow,
          followPromptMessage: requireFollow ? "Follow me first, then tap the button and I'll send it straight over." : null,
          followPromptButtonLabel: requireFollow ? "I'm following" : null,
          isActive: false,
          reportShareSlug: generateReportShareSlug(),
          ...(linkUrl
            ? {
                trackedLinks: {
                  create: [{ workspaceId, slug: generateTrackedLinkSlug(), label: "Primary campaign link", destinationUrl: linkUrl, sortOrder: 0, purpose: "REVEAL" as const }],
                },
              }
            : {}),
        },
        select: { id: true, name: true, isActive: true },
      });
      return { ...created, note: "Created switched off. Turn it on with set_automation_active when it looks right." };
    },
  },
  {
    name: "set_automation_active",
    description: "Turn an automation on or off. Turning it on only affects comments made from now on.",
    inputSchema: {
      type: "object",
      required: ["automationId", "active"],
      properties: { automationId: { type: "string" }, active: { type: "boolean" } },
      additionalProperties: false,
    },
    async run(workspaceId, args) {
      const id = str(args.automationId, 60);
      const active = args.active === true;
      const a = await prisma.automation.findFirst({ where: { id, workspaceId }, select: { id: true, isActive: true } });
      if (!a) throw new ToolError("That automation wasn't found.");
      const reactivating = active && !a.isActive;
      await prisma.automation.update({
        where: { id },
        data: { isActive: active, ...(reactivating ? { activeSince: new Date() } : {}) },
      });
      return { id, active };
    },
  },
  {
    name: "get_automation_results",
    description: "DM results: totals by outcome, link clicks, and the most recent DMs (who, keyword, outcome, when). Optionally for one automation.",
    inputSchema: {
      type: "object",
      properties: {
        automationId: { type: "string" },
        days: { type: "integer", minimum: 1, maximum: 90, description: "Look-back window, default 30." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    async run(workspaceId, args) {
      const days = typeof args.days === "number" ? Math.min(90, Math.max(1, Math.round(args.days))) : 30;
      const since = new Date(Date.now() - days * 86400000);
      const automationId = str(args.automationId, 60) || undefined;
      const where = { workspaceId, createdAt: { gte: since }, ...(automationId ? { automationId } : {}) };
      const [byStatus, clicks, recent] = await Promise.all([
        prisma.dmLog.groupBy({ by: ["status"], where, _count: true }),
        prisma.linkClick.count({ where }),
        prisma.dmLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { commenterName: true, matchedKeyword: true, status: true, createdAt: true, automation: { select: { name: true } } },
        }),
      ]);
      return {
        days,
        totals: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        linkClicks: clicks,
        recent: recent.map((r) => ({ who: r.commenterName, keyword: r.matchedKeyword, outcome: r.status, at: r.createdAt, automation: r.automation.name })),
      };
    },
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleOne(workspaceId: string, msg: Json): Promise<Json | null> {
  const id = msg.id;
  const method = msg.method;
  const isNotification = id === undefined || id === null;
  if (typeof method !== "string") return isNotification ? null : rpcError(id, -32600, "Invalid request");
  if (method.startsWith("notifications/")) return null;

  switch (method) {
    case "initialize": {
      const requested = (msg.params as Json | undefined)?.protocolVersion;
      const protocolVersion = typeof requested === "string" && PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "AutoDM", version: "1.0.0" },
        instructions:
          "AutoDM sends Instagram comment-to-DM automations for this creator. Call get_setup_status first. New automations are created switched off; only turn one on when the creator asks.",
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, ...(annotations ? { annotations } : {}) })),
      });
    case "tools/call": {
      const params = (msg.params ?? {}) as Json;
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${String(params.name)}`);
      try {
        const out = await tool.run(workspaceId, (params.arguments ?? {}) as Json);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: Array.isArray(out) ? { items: out } : (out as Json) });
      } catch (err) {
        const message = err instanceof ToolError ? err.message : "AutoDM couldn't do that just now. Try again in a minute.";
        if (!(err instanceof ToolError)) console.error(`[MCP] ${tool.name} failed:`, err);
        return rpcResult(id, { content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
  }
}

export async function handleMcp(workspaceId: string, body: unknown): Promise<{ status: number; json: unknown }> {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleOne(workspaceId, (m ?? {}) as Json)))).filter(Boolean);
    return out.length ? { status: 200, json: out } : { status: 202, json: null };
  }
  const out = await handleOne(workspaceId, (body ?? {}) as Json);
  return out ? { status: 200, json: out } : { status: 202, json: null };
}
