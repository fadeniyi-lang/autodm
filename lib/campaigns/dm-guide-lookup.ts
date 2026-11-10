import { matchKeywords } from "@/lib/utils/keyword-matcher";

// Guide lookup for inbound DMs. People often DM a campaign's keyword instead of
// commenting it on the reel. When no campaign has its own DM trigger on, this
// looks the word up across every active campaign and replies with that
// campaign's guide link. It reads campaigns and never changes them.

// Only short DMs count, so a normal conversation that happens to contain a
// keyword ("I built an agent last week") doesn't get a guide pushed at it.
export const GUIDE_LOOKUP_MAX_WORDS = 5;

// Keywords read from a campaign name ("VAULT", "AI 7") include everyday words
// like AI, START or FREE, so for those the DM must be little more than the word.
export const NAME_KEYWORD_MAX_WORDS = 3;

// Instagram's link button template holds at most 3 buttons.
export const GUIDE_LOOKUP_MAX_GUIDES = 3;

export const GUIDE_LOOKUP_MESSAGE_ONE =
  "Hey {username}, looks like you're after this guide 👀 Tap below to grab it.";
export const GUIDE_LOOKUP_MESSAGE_MANY =
  "Hey {username}, looks like you're after one of these guides 👀 Tap below to grab yours.";

export interface GuideLookupCampaign {
  id: string;
  name: string;
  keywords: string[];
  wholeWordMatch: boolean;
  matchAnyWord: boolean;
  linkButtonLabel: string | null;
  createdAt: Date;
  trackedLinks: { slug: string; label: string | null; destinationUrl: string }[];
}

export interface GuideLookupMatch {
  campaign: GuideLookupCampaign;
  matchedKeyword: string;
  link: { slug: string; label: string | null; destinationUrl: string };
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// People reply with their email address or a website; "...@gmail.com" must not
// read as the GMAIL keyword.
const CONTAINS_ADDRESS = /@|https?:\/\/|\b[\w-]+\.(com|co|net|org|io|ai|uk|ng|in)\b/i;

export function isShortEnoughForGuideLookup(text: string): boolean {
  if (CONTAINS_ADDRESS.test(text)) return false;
  const words = wordCount(text);
  return words > 0 && words <= GUIDE_LOOKUP_MAX_WORDS;
}

/**
 * The keyword a campaign answers to. Most campaigns reply to any comment on
 * their reel and keep the keyword only in their name, written as the keyword
 * plus an optional reuse number, date, "copy" or "· reel title":
 * "PROMPTS 7", "BUILD 25 Sep", "HUMANISE · Writing tips...", "SQUAD copy".
 */
export function keywordFromCampaignName(name: string): string | null {
  const keyword = name
    .split(" · ")[0]
    .replace(/\(repost\)/gi, "")
    .replace(/\s+copy\b.*$/i, "")
    .replace(/\s+\d{1,2}\s+[A-Za-z]{3}\b.*$/, "")
    .replace(/\s+(post|hook)\b.*$/i, "")
    .replace(/\s+\d+\s*$/, "")
    .trim();
  return keyword.length >= 2 ? keyword : null;
}

/** British and American spellings both count: HUMANISE also answers "humanize". */
function withSpellingVariants(keyword: string): string[] {
  if (/is(e|ed|ing)$/i.test(keyword)) return [keyword, keyword.replace(/is(e|ed|ing)$/i, "iz$1")];
  if (/iz(e|ed|ing)$/i.test(keyword)) return [keyword, keyword.replace(/iz(e|ed|ing)$/i, "is$1")];
  return [keyword];
}

function campaignKeywords(
  campaign: GuideLookupCampaign,
  messageText: string
): string[] {
  if (!campaign.matchAnyWord && campaign.keywords.length > 0) {
    return campaign.keywords;
  }
  if (wordCount(messageText) > NAME_KEYWORD_MAX_WORDS) return [];
  const fromName = keywordFromCampaignName(campaign.name);
  return fromName ? withSpellingVariants(fromName) : [];
}

/**
 * Find the guide(s) a DM is asking for. One entry per distinct guide URL; when
 * the same guide sits behind several campaigns (a keyword reused on a newer
 * reel), the newest campaign wins so its click stats get the credit.
 */
export function findGuidesForDm(
  messageText: string,
  campaigns: GuideLookupCampaign[]
): GuideLookupMatch[] {
  if (!isShortEnoughForGuideLookup(messageText)) return [];

  const newestFirst = [...campaigns].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const byGuide = new Map<string, GuideLookupMatch>();
  const seenKeywords = new Set<string>();
  for (const campaign of newestFirst) {
    const link = campaign.trackedLinks[0];
    if (!link) continue;
    const keywords = campaignKeywords(campaign, messageText);
    if (keywords.length === 0) continue;

    const result = matchKeywords(messageText, keywords, true);
    if (!result.matched || !result.matchedKeyword) continue;

    // A reused keyword (AI, AI 2 ... AI 7) answers with its newest guide only.
    const keywordKey = keywords[0].toLowerCase();
    const guideKey = link.destinationUrl.replace(/\/$/, "").toLowerCase();
    if (seenKeywords.has(keywordKey) || byGuide.has(guideKey)) continue;
    seenKeywords.add(keywordKey);
    byGuide.set(guideKey, {
      campaign,
      matchedKeyword: result.matchedKeyword,
      link,
    });
  }

  return [...byGuide.values()].slice(0, GUIDE_LOOKUP_MAX_GUIDES);
}

/** Button labels: the campaign's own label for one guide, the keyword for several. */
export function guideLookupButtons(
  matches: GuideLookupMatch[]
): { slug: string; label: string; destinationUrl: string }[] {
  return matches.map((m) => ({
    slug: m.link.slug,
    destinationUrl: m.link.destinationUrl,
    label:
      matches.length === 1
        ? m.campaign.linkButtonLabel || m.link.label || "Get the guide"
        : `${m.matchedKeyword.toUpperCase()} guide`.slice(0, 20),
  }));
}

export function isGuideLookupEnabled(): boolean {
  return process.env.DM_GUIDE_LOOKUP_ENABLED === "1";
}
