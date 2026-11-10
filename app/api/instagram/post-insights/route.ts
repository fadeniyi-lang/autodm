import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  createInstagramContext,
  getMediaInsights,
  PermissionError,
} from "@/lib/instagram/provider";

/** Views/reach/saved/shares for one post — the metrics not already carried on
 * the media object itself (likes/comments come from /api/instagram/posts). */
export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const postId = request.nextUrl.searchParams.get("postId");
  if (!postId) {
    return NextResponse.json(
      { success: false, error: "postId is required" },
      { status: 400 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );
  if (!account) {
    return NextResponse.json(
      { success: false, error: "Instagram account not connected." },
      { status: 400 }
    );
  }

  try {
    const context = await createInstagramContext(account);
    const insights = await getMediaInsights({
      context,
      mediaId: postId,
      metrics: ["views", "reach", "saved", "shares"],
    });
    return NextResponse.json({ success: true, data: insights });
  } catch (err) {
    if (err instanceof PermissionError) {
      return NextResponse.json({ success: true, data: {}, unavailable: true });
    }
    console.error("[Post Insights] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load post insights" },
      { status: 500 }
    );
  }
}
