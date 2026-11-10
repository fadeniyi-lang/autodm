import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import {
  getAllUserMedia,
  getMediaInsights,
  PermissionError,
  RateLimitError,
  type InstagramMedia,
} from "@/lib/instagram/provider";
import { createInstagramContext } from "@/lib/instagram/provider";
import {
  ensureFollowerHistory,
  getFollowerHistory,
  type FollowerHistoryPoint,
} from "@/lib/reports/follower-history";
import { generatePostInsight } from "@/lib/ai/post-insight";

// Allow time for paginated media + per-post insight calls on larger accounts.
export const maxDuration = 60;

// Safety ceiling for "all time": bounds pagination and the number of
// per-media insight requests so we can't hammer the API or time out.
const MAX_POSTS = 500;

// How many insight requests to run at once. Zernio's analytics endpoint
// rate-limits to 6/sec; staying under that (rather than retrying our way
// through 429s on every request) keeps a full account's worth of posts from
// silently losing their stats.
const INSIGHTS_CONCURRENCY = 5;

/** Retry once or twice on a 429 before giving up, with a short backoff. */
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  attempts = 3
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof RateLimitError) || attempt >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
}

/** Map over items with a bounded number of in-flight async operations. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

export interface OverviewPost {
  id: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaType: string;
  timestamp: string;
  views: number | null;
  reach: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
}

export interface OverviewResponse {
  account: { id: string; username: string };
  accounts: Array<{ id: string; username: string }>;
  requestedCount: "all" | number;
  truncated: boolean;
  insightsAvailable: boolean;
  /** Current follower total, or null if Instagram did not return it. */
  followers: number | null;
  /**
   * Follower total per day, ascending. Independent of the selected post range —
   * limited to what has been snapshotted plus any 30-day insights backfill.
   */
  followerHistory: FollowerHistoryPoint[];
  totals: {
    posts: number;
    views: number;
    reach: number;
    likes: number;
    comments: number;
    saved: number;
    shares: number;
    interactions: number;
  };
  posts: OverviewPost[];
  provider?: "META" | "ZERNIO";
  limitations?: string[];
  /** Top 3 posts by views in the last 30 days, each with an AI-written
   * explanation grounded in the post's actual caption. */
  topPerformers: {
    postId: string;
    reachMultiple: number;
    standoutMetrics: string[];
    insightPoints: string[] | null;
  }[];
}

function isVideoLike(media: InstagramMedia): boolean {
  return media.media_product_type === "REELS" || media.media_type === "VIDEO";
}

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const account = await getWorkspaceInstagramAccount(
    workspaceId,
    request.nextUrl.searchParams.get("instagramAccountId")
  );

  if (!account) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Instagram account not connected. Please connect your account first.",
      },
      { status: 400 }
    );
  }

  try {
    const accessToken = await createInstagramContext(account);

    // `count` is either "all" or a positive integer (last N posts).
    const countParam = request.nextUrl.searchParams.get("count");
    const isAll = countParam === "all";
    const parsedCount = countParam ? Number.parseInt(countParam, 10) : NaN;
    const requestedCount: "all" | number = isAll
      ? "all"
      : Number.isFinite(parsedCount)
        ? Math.max(parsedCount, 1)
        : 50;

    const target = isAll
      ? MAX_POSTS
      : Math.min(requestedCount as number, MAX_POSTS);

    const media = await getAllUserMedia({ context: accessToken, max: target });
    const truncated =
      media.length >= MAX_POSTS ||
      (account.provider === "ZERNIO" && media.length >= 25);

    // Likes and comments come free with basic media fields. Views / reach /
    // saved / shares require a live insights call, which shares the
    // account's Zernio rate-limit budget with the always-running worker —
    // fetching all of it live on every page view was what actually made
    // this page slow (repeated 429s, each retried with a backoff sleep).
    // A row fresher than this window is served straight from the database
    // instead: no network call, no rate limit, no wait.
    const INSIGHT_CACHE_TTL_MS = 10 * 60 * 1000;

    const cached = await prisma.mediaInsightCache.findMany({
      where: { instagramAccountId: account.id, mediaId: { in: media.map((m) => m.id) } },
    });
    const cacheByMediaId = new Map(cached.map((c) => [c.mediaId, c]));
    const now = Date.now();

    let insightsAvailable = false;
    let permissionDenied = false;

    const insights = await mapWithConcurrency(
      media,
      INSIGHTS_CONCURRENCY,
      async (m) => {
        const fresh = cacheByMediaId.get(m.id);
        if (fresh && now - fresh.fetchedAt.getTime() < INSIGHT_CACHE_TTL_MS) {
          insightsAvailable = true;
          return { views: fresh.views ?? undefined, reach: fresh.reach ?? undefined, saved: fresh.saved ?? undefined, shares: fresh.shares ?? undefined };
        }

        const metrics = isVideoLike(m)
          ? ["views", "reach", "saved", "shares", "total_interactions"]
          : ["reach", "saved", "shares", "total_interactions"];
        try {
          const data = await withRateLimitRetry(() =>
            getMediaInsights({
              context: accessToken,
              mediaId: m.id,
              metrics: metrics,
            })
          );
          insightsAvailable = true;
          await prisma.mediaInsightCache.upsert({
            where: { instagramAccountId_mediaId: { instagramAccountId: account.id, mediaId: m.id } },
            create: {
              instagramAccountId: account.id,
              mediaId: m.id,
              views: data.views ?? null,
              reach: data.reach ?? null,
              saved: data.saved ?? null,
              shares: data.shares ?? null,
            },
            update: {
              views: data.views ?? null,
              reach: data.reach ?? null,
              saved: data.saved ?? null,
              shares: data.shares ?? null,
              fetchedAt: new Date(),
            },
          });
          return data;
        } catch (err) {
          if (err instanceof PermissionError) permissionDenied = true;
          // A stale cached row is still better than nothing on a rate-limit
          // failure — serve it rather than blanking the post's stats.
          if (fresh) {
            return { views: fresh.views ?? undefined, reach: fresh.reach ?? undefined, saved: fresh.saved ?? undefined, shares: fresh.shares ?? undefined };
          }
          return null;
        }
      }
    );

    const posts: OverviewPost[] = media.map((m, i) => {
      const ins = insights[i];
      const likes = m.like_count ?? 0;
      const comments = m.comments_count ?? 0;
      return {
        id: m.id,
        caption: m.caption?.trim().slice(0, 120) ?? null,
        permalink: m.permalink ?? null,
        thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
        mediaType: m.media_product_type ?? m.media_type,
        timestamp: m.timestamp,
        views: ins?.views ?? null,
        reach: ins?.reach ?? null,
        likes,
        comments,
        saved: ins?.saved ?? null,
        shares: ins?.shares ?? null,
      };
    });

    const totals = posts.reduce(
      (acc, p) => {
        acc.posts += 1;
        acc.views += p.views ?? 0;
        acc.reach += p.reach ?? 0;
        acc.likes += p.likes;
        acc.comments += p.comments;
        acc.saved += p.saved ?? 0;
        acc.shares += p.shares ?? 0;
        acc.interactions +=
          p.likes + p.comments + (p.saved ?? 0) + (p.shares ?? 0);
        return acc;
      },
      {
        posts: 0,
        views: 0,
        reach: 0,
        likes: 0,
        comments: 0,
        saved: 0,
        shares: 0,
        interactions: 0,
      }
    );

    // Best performers: last 30 days specifically (falling back to the full
    // set if that window is empty), ranked by views — not reach, not an
    // engagement rate — because that's the metric actually asked for here.
    // Each of the top 3 gets a real AI-written explanation grounded in its
    // actual caption, not just its stats.
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentPosts = posts.filter(
      (p) => new Date(p.timestamp).getTime() >= thirtyDaysAgo
    );
    const rankingPool = recentPosts.length >= 3 ? recentPosts : posts;
    const viewsOf = (p: OverviewPost) => p.views ?? p.reach ?? 0;
    const avgViews =
      rankingPool.reduce((sum, p) => sum + viewsOf(p), 0) /
        (rankingPool.length || 1) || 1;
    const rate = (n: number, denom: number) => (denom > 0 ? n / denom : 0);

    const top3Ranked = [...rankingPool]
      .filter((p) => viewsOf(p) > 0)
      .sort((a, b) => viewsOf(b) - viewsOf(a))
      .slice(0, 3);

    const topPerformers = await Promise.all(
      top3Ranked.map(async (post) => {
        const reachMultiple = viewsOf(post) / avgViews;
        const engagementMetrics: { label: string; value: (p: OverviewPost) => number }[] = [
          { label: "likes", value: (p) => rate(p.likes, viewsOf(p)) },
          { label: "comments", value: (p) => rate(p.comments, viewsOf(p)) },
          { label: "saves", value: (p) => rate(p.saved ?? 0, viewsOf(p)) },
          { label: "shares", value: (p) => rate(p.shares ?? 0, viewsOf(p)) },
        ];
        const standoutMetrics = engagementMetrics
          .map((m) => {
            const topRate = m.value(post);
            const avgRate =
              rankingPool.reduce((sum, p) => sum + m.value(p), 0) /
                (rankingPool.length || 1) || 0;
            return { label: m.label, multiple: avgRate > 0 ? topRate / avgRate : 0 };
          })
          .filter((m) => m.multiple >= 1.3)
          .sort((a, b) => b.multiple - a.multiple)
          .map((m) => `${m.label} (${m.multiple.toFixed(1)}x average)`);

        const fullMedia = media.find((m) => m.id === post.id);
        const insightPoints = await generatePostInsight({
          caption: fullMedia?.caption ?? null,
          reachMultiple,
          standoutMetrics,
        });

        return {
          postId: post.id,
          reachMultiple,
          standoutMetrics,
          insightPoints,
        };
      })
    );

    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId },
      orderBy: { connectedAt: "desc" },
      select: { id: true, username: true },
    });

    // Followers is a point-in-time figure and deliberately not part of
    // `totals`, which sums over the selected posts. A failure here must not
    // take down the rest of the overview.
    let followers: number | null = null;
    let followerHistory: FollowerHistoryPoint[] = [];
    try {
      followers = await ensureFollowerHistory(
        { id: account.id, instagramId: account.instagramId },
        accessToken
      );
      followerHistory = await getFollowerHistory(account.id);
    } catch (err) {
      console.warn(
        "[Instagram Overview] Follower history unavailable:",
        err instanceof Error ? err.message : err
      );
    }

    const data: OverviewResponse = {
      account: { id: account.id, username: account.username },
      accounts,
      requestedCount,
      provider: account.provider,
      limitations:
        account.provider === "ZERNIO"
          ? [
              "Post reporting covers the 25 most recent Instagram posts.",
              "Insights and follower history require the Zernio Analytics add-on and reflect its last sync. Missing metrics remain unavailable.",
            ]
          : [],
      truncated,
      insightsAvailable: insightsAvailable && !permissionDenied,
      followers,
      followerHistory,
      totals,
      posts,
      topPerformers,
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[Instagram Overview] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load Instagram overview" },
      { status: 500 }
    );
  }
}
