/* eslint-disable @typescript-eslint/no-explicit-any -- test doubles for Prisma mocks */
import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// MCP connector: the MCP server, its token helpers and both routes.
// Prisma, the Instagram provider and the session helpers are all mocked, so
// nothing here touches a database or Instagram.

const { mockPrisma, mockProvider, mockAccess } = vi.hoisted(() => ({
  mockPrisma: {
    instagramAccount: { findFirst: vi.fn(), findMany: vi.fn() },
    zernioConnection: { findUnique: vi.fn() },
    automation: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    dmLog: { groupBy: vi.fn(), findMany: vi.fn() },
    linkClick: { groupBy: vi.fn(), count: vi.fn() },
    workspace: { findUnique: vi.fn(), update: vi.fn() },
  },
  mockProvider: {
    createInstagramContext: vi.fn(),
    getUserMedia: vi.fn(),
  },
  mockAccess: {
    getCurrentWorkspaceContext: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/instagram/provider", () => mockProvider);
vi.mock("@/lib/workspace-access", () => ({
  getCurrentWorkspaceContext: mockAccess.getCurrentWorkspaceContext,
  // Same rule as the real helper: ADMIN and OWNER can manage.
  canManageWorkspace: (role: string) => role === "ADMIN" || role === "OWNER",
}));

import { handleMcp } from "../lib/mcp/server";
import { hashConnectorToken, newConnectorToken, workspaceForConnectorToken } from "../lib/mcp/connector-token";
import * as mcpRoute from "../app/api/mcp/[token]/route";
import * as connectorRoute from "../app/api/workspace/connector/route";

const WS = "ws_A";
const OTHER_WS = "ws_B";
const ACCOUNT = { id: "acct_1", workspaceId: WS, username: "examplecreator", provider: "ZERNIO", connectedAt: new Date() };

type RpcOk = { jsonrpc: string; id: unknown; result: Record<string, any> };
type RpcErr = { jsonrpc: string; id: unknown; error: { code: number; message: string } };

async function rpc(method: string, params?: unknown, id: unknown = 1) {
  const res = await handleMcp(WS, { jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) });
  return res;
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await rpc("tools/call", { name, arguments: args });
  expect(res.status).toBe(200);
  const result = (res.json as RpcOk).result;
  return result as { content: { type: string; text: string }[]; structuredContent?: any; isError?: boolean };
}

// Every where clause passed to any mocked prisma method must carry the
// workspace (directly, or via an id list that came from a workspace query).
function allPrismaCalls() {
  const calls: { model: string; method: string; arg: any }[] = [];
  for (const [model, methods] of Object.entries(mockPrisma)) {
    for (const [method, fn] of Object.entries(methods as Record<string, ReturnType<typeof vi.fn>>)) {
      for (const c of fn.mock.calls) calls.push({ model, method, arg: c[0] });
    }
  }
  return calls;
}

function expectNoDeletesOrBulkWrites() {
  expect(mockPrisma.automation.delete).not.toHaveBeenCalled();
  expect(mockPrisma.automation.deleteMany).not.toHaveBeenCalled();
  expect(mockPrisma.automation.updateMany).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.instagramAccount.findFirst.mockResolvedValue(ACCOUNT);
  mockPrisma.instagramAccount.findMany.mockResolvedValue([{ id: ACCOUNT.id, username: ACCOUNT.username, provider: ACCOUNT.provider }]);
  mockPrisma.zernioConnection.findUnique.mockResolvedValue({ profileId: "prof_1" });
  mockPrisma.automation.count.mockImplementation(async ({ where }: any) => (where.isActive ? 2 : 5));
  mockPrisma.automation.findMany.mockResolvedValue([]);
  mockPrisma.automation.create.mockImplementation(async ({ data }: any) => ({ id: "auto_new", name: data.name, isActive: data.isActive }));
  mockPrisma.automation.update.mockResolvedValue({});
  mockPrisma.dmLog.groupBy.mockResolvedValue([]);
  mockPrisma.dmLog.findMany.mockResolvedValue([]);
  mockPrisma.linkClick.groupBy.mockResolvedValue([]);
  mockPrisma.linkClick.count.mockResolvedValue(0);
  mockProvider.createInstagramContext.mockResolvedValue({ ctx: true });
  mockProvider.getUserMedia.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
describe("MCP protocol", () => {
  it("initialize returns serverInfo AutoDM, tools capability and a supported protocol version", async () => {
    const res = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(res.status).toBe(200);
    const { result } = res.json as RpcOk;
    expect(result.serverInfo.name).toBe("AutoDM");
    expect(result.capabilities.tools).toBeDefined();
    expect(result.protocolVersion).toBe("2025-03-26");
  });

  it("initialize falls back to the newest version for an unknown protocolVersion", async () => {
    const { result } = (await rpc("initialize", { protocolVersion: "1999-01-01" })).json as RpcOk;
    expect(result.protocolVersion).toBe("2025-06-18");
  });

  it("tools/list returns exactly the six tools, each with an object inputSchema", async () => {
    const { result } = (await rpc("tools/list")).json as RpcOk;
    const names = result.tools.map((t: any) => t.name);
    expect(names.sort()).toEqual(
      ["create_automation", "get_automation_results", "get_setup_status", "list_automations", "list_recent_posts", "set_automation_active"].sort()
    );
    for (const t of result.tools) {
      expect(typeof t.description).toBe("string");
      expect(t.inputSchema.type).toBe("object");
      expect(t).not.toHaveProperty("run");
    }
    const create = result.tools.find((t: any) => t.name === "create_automation");
    expect(create.inputSchema.required).toEqual(expect.arrayContaining(["name", "keywords", "dmMessage", "trigger"]));
    expect(create.inputSchema.properties.trigger.enum.sort()).toEqual(["any_post", "next_reel", "post"]);
  });

  it("no tool can delete anything", async () => {
    const { result } = (await rpc("tools/list")).json as RpcOk;
    expect(result.tools.some((t: any) => /delete|remove/i.test(t.name))).toBe(false);
  });

  it("tools/call with an unknown tool returns a JSON-RPC -32602 error", async () => {
    const res = await rpc("tools/call", { name: "delete_everything", arguments: {} }, 7);
    expect(res.status).toBe(200);
    const body = res.json as RpcErr;
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(7);
    expect(body.error.code).toBe(-32602);
    expect(body.error.message).toContain("delete_everything");
  });

  it("an unknown method returns -32601, and a message without a method returns -32600", async () => {
    expect(((await rpc("resources/list")).json as RpcErr).error.code).toBe(-32601);
    const bad = await handleMcp(WS, { jsonrpc: "2.0", id: 3 });
    expect((bad.json as RpcErr).error.code).toBe(-32600);
  });

  it("ping returns an empty result", async () => {
    expect(((await rpc("ping")).json as RpcOk).result).toEqual({});
  });

  it("notifications (no id) return 202 with no body", async () => {
    expect(await handleMcp(WS, { jsonrpc: "2.0", method: "notifications/initialized" })).toEqual({ status: 202, json: null });
    expect(await handleMcp(WS, { jsonrpc: "2.0", method: "some/unknown" })).toEqual({ status: 202, json: null });
  });

  it("batch requests return one response per request and drop notifications", async () => {
    const res = await handleMcp(WS, [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);
    expect(res.status).toBe(200);
    const out = res.json as RpcOk[];
    expect(out.map((r) => r.id)).toEqual([1, 2]);
    expect(out[0].result.serverInfo.name).toBe("AutoDM");
    expect(out[1].result.tools).toHaveLength(6);
  });

  it("a batch made only of notifications returns 202", async () => {
    expect(await handleMcp(WS, [{ jsonrpc: "2.0", method: "notifications/initialized" }])).toEqual({ status: 202, json: null });
  });

  it("an unexpected internal error is hidden behind a friendly isError result", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockPrisma.automation.count.mockRejectedValue(new Error("db down: secret connection string"));
    const r = await callTool("get_setup_status");
    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toContain("secret");
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe("get_setup_status", () => {
  it("returns the fields an MCP client reads, scoped to the workspace", async () => {
    const r = await callTool("get_setup_status");
    const s = r.structuredContent;
    expect(s.ready).toBe(true);
    expect(s.instagramAccounts[0].username).toBe("examplecreator");
    expect(s.activeAutomations).toBe(2);
    expect(s.automations).toBe(5);
    expect(typeof s.activeAutomations).toBe("number");
    expect(JSON.parse(r.content[0].text)).toEqual(s);

    expect(mockPrisma.instagramAccount.findMany.mock.calls[0][0].where).toEqual({ workspaceId: WS });
    expect(mockPrisma.zernioConnection.findUnique.mock.calls[0][0].where).toEqual({ workspaceId: WS });
    for (const [arg] of mockPrisma.automation.count.mock.calls) expect(arg.where.workspaceId).toBe(WS);
  });

  it("is not ready with no Instagram account and gives a next step", async () => {
    mockPrisma.instagramAccount.findMany.mockResolvedValue([]);
    mockPrisma.zernioConnection.findUnique.mockResolvedValue(null);
    const s = (await callTool("get_setup_status")).structuredContent;
    expect(s.ready).toBe(false);
    expect(s.zernioConnected).toBe(false);
    expect(s.nextStep).toMatch(/Zernio API key/);
  });
});

// ---------------------------------------------------------------------------
describe("list_recent_posts", () => {
  it("returns id, caption, type, postedAt and permalink, with REELS mapped to REEL", async () => {
    mockProvider.getUserMedia.mockResolvedValue([
      { id: "m1", caption: "New reel", media_type: "VIDEO", media_product_type: "REELS", permalink: "https://instagram.com/reel/1", thumbnail_url: "https://t/1.jpg", timestamp: "2026-11-01T10:00:00Z" },
      { id: "m2", caption: null, media_type: "IMAGE", media_product_type: "FEED", permalink: undefined, media_url: "https://t/2.jpg", timestamp: "2026-10-30T10:00:00Z" },
    ]);
    const r = await callTool("list_recent_posts", { limit: 12 });
    const items = r.structuredContent.items;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: "m1", caption: "New reel", type: "REEL", postedAt: "2026-11-01T10:00:00Z", permalink: "https://instagram.com/reel/1" });
    expect(items[1]).toMatchObject({ id: "m2", caption: "", type: "IMAGE", permalink: null });
    for (const k of ["id", "caption", "type", "postedAt", "permalink"]) expect(items[0]).toHaveProperty(k);

    expect(mockProvider.getUserMedia).toHaveBeenCalledWith({ context: { ctx: true }, limit: 12 });
    expect(mockPrisma.instagramAccount.findFirst.mock.calls[0][0].where).toEqual({ workspaceId: WS });
  });

  it("clamps limit to 1..25", async () => {
    await callTool("list_recent_posts", { limit: 500 });
    expect(mockProvider.getUserMedia.mock.calls[0][0].limit).toBe(25);
    await callTool("list_recent_posts", { limit: 0 });
    expect(mockProvider.getUserMedia.mock.calls[1][0].limit).toBe(1);
  });

  it("looks up a chosen account only inside the workspace", async () => {
    mockPrisma.instagramAccount.findFirst.mockResolvedValue(null);
    const r = await callTool("list_recent_posts", { instagramAccountId: "acct_other_ws" });
    expect(mockPrisma.instagramAccount.findFirst.mock.calls[0][0].where).toEqual({ id: "acct_other_ws", workspaceId: WS });
    expect(r.isError).toBe(true);
    expect(mockProvider.getUserMedia).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("list_automations", () => {
  it("returns the fields an MCP client reads, with counts and trigger", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([
      {
        id: "a1", name: "Guide", isActive: true, pendingNextReel: false, matchAnyPost: false, postUrl: "https://instagram.com/p/x",
        keywords: ["GUIDE"], matchAnyWord: false, dmMessage: "Here you go", linkButtonLabel: "Get it",
        trackedLinks: [{ destinationUrl: "https://example.com/guide" }], publicReplyEnabled: true,
        publicReplyMessages: ["Sent!"], publicReplyMessage: "Sent!", requireFollow: false, createdAt: new Date("2026-11-01"),
      },
      {
        id: "a2", name: "Next", isActive: false, pendingNextReel: true, matchAnyPost: false, postUrl: null,
        keywords: ["NEXT"], matchAnyWord: false, dmMessage: "Hi", linkButtonLabel: null, trackedLinks: [],
        publicReplyEnabled: false, publicReplyMessages: [], publicReplyMessage: null, requireFollow: true, createdAt: new Date("2026-11-02"),
      },
      {
        id: "a3", name: "Any", isActive: false, pendingNextReel: false, matchAnyPost: true, postUrl: null,
        keywords: ["ANY"], matchAnyWord: false, dmMessage: "Hi", linkButtonLabel: null, trackedLinks: [],
        publicReplyEnabled: false, publicReplyMessages: [], publicReplyMessage: null, requireFollow: false, createdAt: new Date("2026-11-03"),
      },
    ]);
    mockPrisma.dmLog.groupBy.mockResolvedValue([{ automationId: "a1", _count: 14 }]);
    mockPrisma.linkClick.groupBy.mockResolvedValue([{ automationId: "a1", _count: 6 }]);

    const items = (await callTool("list_automations")).structuredContent.items;
    expect(items[0]).toMatchObject({
      id: "a1", name: "Guide", active: true, keywords: ["GUIDE"], postUrl: "https://instagram.com/p/x",
      dmsSent: 14, linkClicks: 6, linkUrl: "https://example.com/guide", trigger: "post", publicReply: "Sent!",
    });
    expect(items[1]).toMatchObject({ id: "a2", active: false, trigger: "next_reel", dmsSent: 0, linkClicks: 0, linkUrl: null, publicReply: null });
    expect(items[2].trigger).toBe("any_post");
    for (const k of ["id", "name", "active", "keywords", "postUrl", "dmsSent", "linkClicks", "linkUrl", "trigger"]) {
      for (const it of items) expect(it).toHaveProperty(k);
    }

    // Scoped: automations by workspace, counts only for those automation ids.
    expect(mockPrisma.automation.findMany.mock.calls[0][0].where).toEqual({ workspaceId: WS });
    expect(mockPrisma.dmLog.groupBy.mock.calls[0][0].where).toEqual({ automationId: { in: ["a1", "a2", "a3"] }, status: "SENT" });
    expect(mockPrisma.linkClick.groupBy.mock.calls[0][0].where).toEqual({ automationId: { in: ["a1", "a2", "a3"] } });
    // Read-only.
    expect(mockPrisma.automation.update).not.toHaveBeenCalled();
    expect(mockPrisma.automation.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("create_automation", () => {
  const hqInput = {
    name: "Twenty Hours guide",
    keywords: ["HOURS"],
    dmMessage: "Here's the guide",
    trigger: "post",
    postId: "m1",
    postUrl: "https://www.instagram.com/reel/abc/",
    linkUrl: "https://example.com/guide/the-twenty-hours",
    linkButtonLabel: "Get the guide",
    publicReply: "Sent! Check your DMs",
    requireFollow: true,
  };

  it("creates it switched OFF in the token's workspace, with the link tracked", async () => {
    const r = await callTool("create_automation", hqInput);
    expect(r.isError).toBeUndefined();
    expect(r.structuredContent).toMatchObject({ id: "auto_new", name: "Twenty Hours guide", isActive: false });

    expect(mockPrisma.automation.create).toHaveBeenCalledTimes(1);
    const { data } = mockPrisma.automation.create.mock.calls[0][0];
    expect(data.isActive).toBe(false);
    expect(data.workspaceId).toBe(WS);
    expect(data.instagramAccountId).toBe(ACCOUNT.id);
    expect(data).toMatchObject({
      name: "Twenty Hours guide", postId: "m1", postUrl: "https://www.instagram.com/reel/abc/", pendingNextReel: false,
      matchAnyPost: false, keywords: ["HOURS"], dmMessage: "Here's the guide", linkButtonLabel: "Get the guide",
      publicReplyEnabled: true, publicReplyMessage: "Sent! Check your DMs", publicReplyMessages: ["Sent! Check your DMs"],
      requireFollow: true,
    });
    expect(typeof data.reportShareSlug).toBe("string");
    const link = data.trackedLinks.create[0];
    expect(link).toMatchObject({ workspaceId: WS, destinationUrl: "https://example.com/guide/the-twenty-hours", purpose: "REVEAL", sortOrder: 0 });
    expect(mockPrisma.instagramAccount.findFirst.mock.calls[0][0].where.workspaceId).toBe(WS);

    // Never touches existing automations.
    expect(mockPrisma.automation.update).not.toHaveBeenCalled();
    expectNoDeletesOrBulkWrites();
  });

  it("ignores any attempt to create it switched on or in another workspace", async () => {
    // inputSchema forbids extra properties, but the server must not trust that.
    await callTool("create_automation", { ...hqInput, isActive: true, active: true, workspaceId: OTHER_WS });
    const { data } = mockPrisma.automation.create.mock.calls[0][0];
    expect(data.isActive).toBe(false);
    expect(data.workspaceId).toBe(WS);
  });

  it("next_reel and any_post triggers don't need a post", async () => {
    await callTool("create_automation", { name: "N", keywords: ["KW"], dmMessage: "m", trigger: "next_reel", postId: "ignored" });
    let { data } = mockPrisma.automation.create.mock.calls[0][0];
    expect(data).toMatchObject({ pendingNextReel: true, matchAnyPost: false, postId: null, postUrl: null, isActive: false });
    expect(data.trackedLinks).toBeUndefined();

    await callTool("create_automation", { name: "A", keywords: ["KW"], dmMessage: "m", trigger: "any_post" });
    ({ data } = mockPrisma.automation.create.mock.calls[1][0]);
    expect(data).toMatchObject({ pendingNextReel: false, matchAnyPost: true, postId: null, isActive: false });
  });

  it("defaults: no public reply, no follow gate", async () => {
    await callTool("create_automation", { name: "N", keywords: ["KW"], dmMessage: "m", trigger: "any_post" });
    const { data } = mockPrisma.automation.create.mock.calls[0][0];
    expect(data).toMatchObject({ publicReplyEnabled: false, publicReplyMessage: null, publicReplyMessages: [], requireFollow: false, followPromptMessage: null, linkButtonLabel: null });
  });

  it.each([
    ["missing keyword", { keywords: [] }, /keyword/i],
    ["blank keyword only", { keywords: ["   "] }, /keyword/i],
    ["keywords not an array", { keywords: "HOURS" }, /keyword/i],
    ["missing message", { dmMessage: "" }, /message/i],
    ["missing name", { name: " " }, /name/i],
    ["post trigger with no postId", { postId: undefined }, /list_recent_posts/],
    ["javascript: link", { linkUrl: "javascript:alert(1)" }, /https/],
    ["non-URL link", { linkUrl: "example.com/guide" }, /https/],
    ["ftp link", { linkUrl: "ftp://example.com/file" }, /https/],
  ])("rejects %s without creating anything", async (_label, patch, msg) => {
    const r = await callTool("create_automation", { ...hqInput, ...patch });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(msg);
    expect(mockPrisma.automation.create).not.toHaveBeenCalled();
  });

  it("refuses when the workspace has no Instagram account", async () => {
    mockPrisma.instagramAccount.findFirst.mockResolvedValue(null);
    const r = await callTool("create_automation", hqInput);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Instagram/);
    expect(mockPrisma.automation.create).not.toHaveBeenCalled();
  });

  it("trims and caps keywords at 10, drops blanks", async () => {
    const kws = ["  A ", "", ...Array.from({ length: 12 }, (_, i) => `K${i}`)];
    await callTool("create_automation", { ...hqInput, keywords: kws });
    const { data } = mockPrisma.automation.create.mock.calls[0][0];
    expect(data.keywords).toHaveLength(10);
    expect(data.keywords[0]).toBe("A");
  });

  it("drops an invalid postUrl rather than storing it", async () => {
    await callTool("create_automation", { ...hqInput, postUrl: "not a url" });
    expect(mockPrisma.automation.create.mock.calls[0][0].data.postUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("set_automation_active", () => {
  it("turns on an automation in the same workspace and resets activeSince", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({ id: "a1", isActive: false });
    const r = await callTool("set_automation_active", { automationId: "a1", active: true });
    expect(r.structuredContent).toEqual({ id: "a1", active: true });
    expect(mockPrisma.automation.findFirst.mock.calls[0][0].where).toEqual({ id: "a1", workspaceId: WS });
    const upd = mockPrisma.automation.update.mock.calls[0][0];
    expect(upd.where).toEqual({ id: "a1" });
    expect(upd.data.isActive).toBe(true);
    expect(upd.data.activeSince).toBeInstanceOf(Date);
    expectNoDeletesOrBulkWrites();
  });

  it("turning off does not touch activeSince", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({ id: "a1", isActive: true });
    await callTool("set_automation_active", { automationId: "a1", active: false });
    expect(mockPrisma.automation.update.mock.calls[0][0].data).toEqual({ isActive: false });
  });

  it("re-saying 'on' for an already-on automation keeps activeSince", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({ id: "a1", isActive: true });
    await callTool("set_automation_active", { automationId: "a1", active: true });
    expect(mockPrisma.automation.update.mock.calls[0][0].data).toEqual({ isActive: true });
  });

  it("refuses another workspace's automation and changes nothing", async () => {
    // findFirst filtered by {id, workspaceId: ws_A} finds nothing for ws_B's row.
    mockPrisma.automation.findFirst.mockImplementation(async ({ where }: any) =>
      where.id === "b_auto" && where.workspaceId === OTHER_WS ? { id: "b_auto", isActive: false } : null
    );
    const r = await callTool("set_automation_active", { automationId: "b_auto", active: true });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/wasn't found/);
    expect(mockPrisma.automation.findFirst.mock.calls[0][0].where).toEqual({ id: "b_auto", workspaceId: WS });
    expect(mockPrisma.automation.update).not.toHaveBeenCalled();
  });

  it("treats anything other than literal true as off", async () => {
    mockPrisma.automation.findFirst.mockResolvedValue({ id: "a1", isActive: false });
    await callTool("set_automation_active", { automationId: "a1", active: "true" });
    expect(mockPrisma.automation.update.mock.calls[0][0].data).toEqual({ isActive: false });
  });
});

// ---------------------------------------------------------------------------
describe("get_automation_results", () => {
  beforeEach(() => {
    mockPrisma.dmLog.groupBy.mockResolvedValue([
      { status: "SENT", _count: 12 },
      { status: "FAILED", _count: 2 },
    ]);
    mockPrisma.linkClick.count.mockResolvedValue(5);
    mockPrisma.dmLog.findMany.mockResolvedValue([
      { commenterName: "amaka", matchedKeyword: "HOURS", status: "SENT", createdAt: new Date("2026-11-08T09:00:00Z"), automation: { name: "Twenty Hours guide" } },
    ]);
  });

  it("returns totals, linkClicks and recent in the shape an MCP client reads", async () => {
    const s = (await callTool("get_automation_results", { days: 30 })).structuredContent;
    expect(s.days).toBe(30);
    expect(s.totals).toEqual({ SENT: 12, FAILED: 2 });
    expect(s.linkClicks).toBe(5);
    expect(s.recent).toHaveLength(1);
    expect(s.recent[0]).toMatchObject({ who: "amaka", keyword: "HOURS", outcome: "SENT", automation: "Twenty Hours guide" });
    expect(s.recent[0]).toHaveProperty("at");

    for (const fn of [mockPrisma.dmLog.groupBy, mockPrisma.linkClick.count, mockPrisma.dmLog.findMany]) {
      const where = fn.mock.calls[0][0].where;
      expect(where.workspaceId).toBe(WS);
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where).not.toHaveProperty("automationId");
    }
    const since: Date = mockPrisma.dmLog.groupBy.mock.calls[0][0].where.createdAt.gte;
    const ageDays = (Date.now() - since.getTime()) / 86400000;
    expect(ageDays).toBeGreaterThan(29.9);
    expect(ageDays).toBeLessThan(30.1);
  });

  it("filters by automationId while keeping the workspace filter", async () => {
    await callTool("get_automation_results", { automationId: "a1", days: 7 });
    for (const fn of [mockPrisma.dmLog.groupBy, mockPrisma.linkClick.count, mockPrisma.dmLog.findMany]) {
      const where = fn.mock.calls[0][0].where;
      expect(where.workspaceId).toBe(WS);
      expect(where.automationId).toBe("a1");
    }
  });

  it("defaults to 30 days and clamps to 1..90", async () => {
    expect((await callTool("get_automation_results")).structuredContent.days).toBe(30);
    expect((await callTool("get_automation_results", { days: 365 })).structuredContent.days).toBe(90);
    expect((await callTool("get_automation_results", { days: -4 })).structuredContent.days).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("workspace isolation across every tool", () => {
  it("every prisma where clause is tied to the token's workspace", async () => {
    mockPrisma.automation.findMany.mockResolvedValue([
      { id: "a1", name: "G", isActive: false, pendingNextReel: false, matchAnyPost: false, postUrl: null, keywords: ["G"], matchAnyWord: false, dmMessage: "m", linkButtonLabel: null, trackedLinks: [], publicReplyEnabled: false, publicReplyMessages: [], publicReplyMessage: null, requireFollow: false, createdAt: new Date() },
    ]);
    mockPrisma.automation.findFirst.mockResolvedValue({ id: "a1", isActive: false });

    await callTool("get_setup_status");
    await callTool("list_recent_posts", { limit: 12 });
    await callTool("list_automations");
    await callTool("create_automation", { name: "N", keywords: ["KW"], dmMessage: "m", trigger: "any_post", linkUrl: "https://x.com" });
    await callTool("set_automation_active", { automationId: "a1", active: true });
    await callTool("get_automation_results", { days: 30 });
    await callTool("get_automation_results", { automationId: "a1" });

    const calls = allPrismaCalls();
    expect(calls.length).toBeGreaterThan(10);
    for (const c of calls) {
      const label = `${c.model}.${c.method}`;
      if (c.method === "create") {
        expect(c.arg.data.workspaceId, label).toBe(WS);
      } else if (c.model === "automation" && c.method === "update") {
        // Only reached after a findFirst({id, workspaceId}) succeeded.
        expect(mockPrisma.automation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: c.arg.where.id, workspaceId: WS } }));
      } else if (c.method === "groupBy" && c.arg.where.automationId?.in) {
        // Counts for list_automations: ids came from findMany({ where: { workspaceId } }).
        expect(c.arg.where.automationId.in, label).toEqual(["a1"]);
      } else {
        expect(c.arg.where.workspaceId, label).toBe(WS);
      }
      expect(JSON.stringify(c.arg)).not.toContain(OTHER_WS);
    }
    expectNoDeletesOrBulkWrites();
  });
});

// ---------------------------------------------------------------------------
describe("connector token helpers", () => {
  it("newConnectorToken starts with adm_, is long and random", () => {
    const a = newConnectorToken();
    const b = newConnectorToken();
    expect(a.startsWith("adm_")).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(36); // 24 random bytes as base64url = 32 chars
    expect(a).toMatch(/^adm_[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });

  it("hashConnectorToken is a stable sha256 hex", () => {
    const t = "adm_example_token_value_1234567890";
    const expected = createHash("sha256").update(t).digest("hex");
    expect(hashConnectorToken(t)).toBe(expected);
    expect(hashConnectorToken(t)).toBe(hashConnectorToken(t));
    expect(hashConnectorToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashConnectorToken(t + "x")).not.toBe(expected);
  });

  it.each([
    ["empty", ""],
    ["short", "adm_short"],
    ["wrong prefix", "abc_" + "x".repeat(40)],
    ["no prefix", "x".repeat(44)],
  ])("workspaceForConnectorToken rejects %s token without querying", async (_l, token) => {
    expect(await workspaceForConnectorToken(token)).toBeNull();
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("workspaceForConnectorToken looks up by the hash, never the raw token", async () => {
    const token = newConnectorToken();
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: WS, name: "Example Studio" });
    expect(await workspaceForConnectorToken(token)).toEqual({ id: WS, name: "Example Studio" });
    const arg = mockPrisma.workspace.findUnique.mock.calls[0][0];
    expect(arg.where).toEqual({ connectorTokenHash: hashConnectorToken(token) });
    expect(JSON.stringify(arg)).not.toContain(token);
  });
});

// ---------------------------------------------------------------------------
describe("POST /api/mcp/[token]", () => {
  function post(token: string, body: unknown, raw?: string) {
    const req = new Request(`https://autodm.example.com/api/mcp/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ?? JSON.stringify(body),
    });
    return mcpRoute.POST(req as any, { params: Promise.resolve({ token }) });
  }

  it.each([
    ["missing", ""],
    ["malformed", "not-a-token"],
  ])("rejects a %s token with 401 and no DB lookup", async (_l, token) => {
    const res = await post(token, { jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe(-32001);
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unknown (well-formed) token with 401", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null);
    const res = await post(newConnectorToken(), { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_setup_status" } });
    expect(res.status).toBe(401);
    expect(mockPrisma.automation.count).not.toHaveBeenCalled();
  });

  it("accepts a valid token and runs the call against that token's workspace", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: WS, name: "Example Studio" });
    const res = await post(newConnectorToken(), { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "get_setup_status", arguments: {} } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(9);
    expect(body.result.structuredContent.ready).toBe(true);
    for (const [arg] of mockPrisma.automation.count.mock.calls) expect(arg.where.workspaceId).toBe(WS);
    expect(mockPrisma.instagramAccount.findMany.mock.calls[0][0].where).toEqual({ workspaceId: WS });
  });

  it("returns 202 with an empty body for a notification", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: WS, name: "Example Studio" });
    const res = await post(newConnectorToken(), { jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("returns a 400 parse error for invalid JSON", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: WS, name: "Example Studio" });
    const res = await post(newConnectorToken(), undefined, "{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it("GET and DELETE are 405 (no SSE stream)", async () => {
    expect((await mcpRoute.GET()).status).toBe(405);
    expect((await mcpRoute.DELETE()).status).toBe(405);
  });
});

// ---------------------------------------------------------------------------
describe("/api/workspace/connector", () => {
  const owner = { userId: "u1", workspaceId: WS, role: "OWNER" };

  it("every method needs a signed-in workspace (401)", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue(null);
    for (const fn of [connectorRoute.GET, connectorRoute.POST, connectorRoute.DELETE]) {
      const res = await fn();
      expect(res.status).toBe(401);
    }
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it("members (not owner/admin) can't make or remove the link (403)", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue({ ...owner, role: "MEMBER" });
    expect((await connectorRoute.POST()).status).toBe(403);
    expect((await connectorRoute.DELETE()).status).toBe(403);
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it("GET only says whether a link exists, never returns the hash or token", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue(owner);
    mockPrisma.workspace.findUnique.mockResolvedValue({ connectorTokenHash: "a".repeat(64) });
    const res = await connectorRoute.GET();
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { connected: true } });
    expect(JSON.stringify(body)).not.toContain("aaaa");
    expect(mockPrisma.workspace.findUnique.mock.calls[0][0].where).toEqual({ id: WS });

    mockPrisma.workspace.findUnique.mockResolvedValue({ connectorTokenHash: null });
    expect((await (await connectorRoute.GET()).json()).data.connected).toBe(false);
  });

  it("POST stores only the sha256 hash and returns the raw link once", async () => {
    const prev = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = "https://autodm.example.com/";
    try {
      mockAccess.getCurrentWorkspaceContext.mockResolvedValue({ ...owner, role: "ADMIN" });
      const res = await connectorRoute.POST();
      expect(res.status).toBe(200);
      const { data } = await res.json();
      const m = /^https:\/\/autodm\.example\.com\/api\/mcp\/(adm_[A-Za-z0-9_-]+)$/.exec(data.url);
      expect(m).not.toBeNull();
      const token = m![1];

      const upd = mockPrisma.workspace.update.mock.calls[0][0];
      expect(upd.where).toEqual({ id: WS });
      expect(upd.data).toEqual({ connectorTokenHash: hashConnectorToken(token) });
      expect(JSON.stringify(upd)).not.toContain(token);

      // A second POST rotates: a new token and a new hash replace the old one.
      const second = await (await connectorRoute.POST()).json();
      expect(second.data.url).not.toBe(data.url);
      expect(mockPrisma.workspace.update.mock.calls[1][0].data.connectorTokenHash).not.toBe(upd.data.connectorTokenHash);

      // And GET afterwards never gives the link back.
      mockPrisma.workspace.findUnique.mockResolvedValue({ connectorTokenHash: upd.data.connectorTokenHash });
      const after = await (await connectorRoute.GET()).json();
      expect(JSON.stringify(after)).not.toContain("adm_");
    } finally {
      process.env.NEXTAUTH_URL = prev;
    }
  });

  it("DELETE clears the hash for the signed-in workspace only, touching no automations", async () => {
    mockAccess.getCurrentWorkspaceContext.mockResolvedValue(owner);
    const res = await connectorRoute.DELETE();
    expect(res.status).toBe(200);
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith({ where: { id: WS }, data: { connectorTokenHash: null } });
    expect(mockPrisma.automation.update).not.toHaveBeenCalled();
    expectNoDeletesOrBulkWrites();
  });
});
