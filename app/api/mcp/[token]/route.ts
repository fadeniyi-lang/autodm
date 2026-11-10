import { NextRequest, NextResponse } from "next/server";
import { workspaceForConnectorToken } from "@/lib/mcp/connector-token";
import { handleMcp } from "@/lib/mcp/server";

// The "AutoDM" MCP connector endpoint (MCP, Streamable HTTP, JSON only).
// The URL secret identifies the workspace; it's generated in Settings.
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const workspace = await workspaceForConnectorToken(token);
  if (!workspace) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "This AutoDM connector link isn't valid any more. Make a new one in AutoDM Settings." } },
      { status: 401 }
    );
  }
  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const { status, json } = await handleMcp(workspace.id, body);
  if (status === 202) return new NextResponse(null, { status: 202 });
  return NextResponse.json(json, { status });
}

// No server-initiated stream: this server only answers requests.
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
