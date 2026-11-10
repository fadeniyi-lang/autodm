import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { canManageWorkspace, getCurrentWorkspaceContext } from "@/lib/workspace-access";
import { hashConnectorToken, newConnectorToken } from "@/lib/mcp/connector-token";

// The MCP connector link: GET says whether one exists, POST makes a
// new one (replacing any old link, which stops working) and returns it once,
// DELETE switches the connector off.

function baseUrl() {
  return (process.env.NEXTAUTH_URL || "").replace(/\/+$/, "");
}

export async function GET() {
  const ctx = await getCurrentWorkspaceContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { connectorTokenHash: true } });
  return NextResponse.json({ success: true, data: { connected: Boolean(ws?.connectorTokenHash) } });
}

export async function POST() {
  const ctx = await getCurrentWorkspaceContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ success: false, error: "Only owners and admins can do this." }, { status: 403 });
  const token = newConnectorToken();
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { connectorTokenHash: hashConnectorToken(token) } });
  return NextResponse.json({ success: true, data: { url: `${baseUrl()}/api/mcp/${token}` } });
}

export async function DELETE() {
  const ctx = await getCurrentWorkspaceContext();
  if (!ctx) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if (!canManageWorkspace(ctx.role)) return NextResponse.json({ success: false, error: "Only owners and admins can do this." }, { status: 403 });
  await prisma.workspace.update({ where: { id: ctx.workspaceId }, data: { connectorTokenHash: null } });
  return NextResponse.json({ success: true });
}
