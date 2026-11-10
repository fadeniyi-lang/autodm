import { describe, it, expect } from "vitest";
import {
  findGuidesForDm,
  guideLookupButtons,
  isShortEnoughForGuideLookup,
  keywordFromCampaignName,
  type GuideLookupCampaign,
} from "@/lib/campaigns/dm-guide-lookup";

function campaign(
  id: string,
  keywords: string[],
  url: string,
  createdAt: string,
  extra: Partial<GuideLookupCampaign> = {}
): GuideLookupCampaign {
  return {
    id,
    name: keywords[0] ?? id,
    keywords,
    wholeWordMatch: true,
    matchAnyWord: false,
    linkButtonLabel: "Get the guide",
    createdAt: new Date(createdAt),
    trackedLinks: [{ slug: `s_${id}`, label: "Guide", destinationUrl: url }],
    ...extra,
  };
}

describe("DM guide lookup", () => {
  const agents = campaign("a1", ["AGENTS"], "https://x.com/guide/agents", "2026-09-01");
  const agents2 = campaign("a2", ["AGENTS"], "https://x.com/guide/agents/", "2026-10-01");
  const build = campaign("b1", ["BUILD"], "https://x.com/guide/build", "2026-09-10");

  it("finds the guide for a DM that is just the keyword", () => {
    const [m] = findGuidesForDm("agents", [agents, build]);
    expect(m.campaign.id).toBe("a1");
    expect(m.matchedKeyword).toBe("AGENTS");
  });

  it("matches the keyword inside a short request", () => {
    expect(findGuidesForDm("can I get AGENTS pls", [agents])).toHaveLength(1);
  });

  it("ignores long conversational messages", () => {
    expect(
      findGuidesForDm("I set up my agents yesterday and they work great", [agents])
    ).toEqual([]);
    expect(isShortEnoughForGuideLookup("one two three four five")).toBe(true);
    expect(isShortEnoughForGuideLookup("one two three four five six")).toBe(false);
  });

  it("uses the newest campaign when the same guide sits behind a reused keyword", () => {
    const matches = findGuidesForDm("AGENTS", [agents, agents2]);
    expect(matches).toHaveLength(1);
    expect(matches[0].campaign.id).toBe("a2");
  });

  it("returns one entry per guide when the DM names several", () => {
    const matches = findGuidesForDm("agents and build", [agents, build]);
    expect(matches.map((m) => m.campaign.id).sort()).toEqual(["a1", "b1"]);
    expect(guideLookupButtons(matches).map((b) => b.label).sort()).toEqual([
      "AGENTS guide",
      "BUILD guide",
    ]);
  });

  it("skips campaigns without a guide link", () => {
    const noLink = campaign("y", ["AGENTS"], "https://x.com/b", "2026-10-06", {
      trackedLinks: [],
    });
    expect(findGuidesForDm("AGENTS", [noLink])).toEqual([]);
  });

  it("reads the keyword from the campaign name", () => {
    expect(keywordFromCampaignName("PROMPTS 7")).toBe("PROMPTS");
    expect(keywordFromCampaignName("BUILD 25 Sep")).toBe("BUILD");
    expect(keywordFromCampaignName("BUILD 18 Aug 2")).toBe("BUILD");
    expect(keywordFromCampaignName("BUILD 07 Aug post")).toBe("BUILD");
    expect(keywordFromCampaignName("HUMANISE · Writing tips")).toBe("HUMANISE");
    expect(keywordFromCampaignName("BRAG · SECRET hook")).toBe("BRAG");
    expect(keywordFromCampaignName("SQUAD copy")).toBe("SQUAD");
    expect(keywordFromCampaignName("WEEKEND 3 copy Builds")).toBe("WEEKEND");
    expect(keywordFromCampaignName("CLAUDE MD 2 (repost)")).toBe("CLAUDE MD");
    expect(keywordFromCampaignName("Claude Code")).toBe("Claude Code");
  });

  describe("any-comment campaigns (keyword in the name)", () => {
    const anyWord = (id: string, name: string, url: string, createdAt: string) =>
      campaign(id, [], url, createdAt, { name, matchAnyWord: true });
    const vault = anyWord("v", "VAULT", "https://x.com/vault", "2026-10-01");
    const ai6 = anyWord("ai6", "AI 6", "https://x.com/ai6", "2026-09-01");
    const ai7 = anyWord("ai7", "AI 7", "https://x.com/ai7", "2026-10-01");
    const humanise = anyWord("h", "HUMANISE · Writing", "https://x.com/h", "2026-10-01");
    const watermark = anyWord("w", "WATERMARK", "https://x.com/w", "2026-10-01");

    it("matches a DM that is the keyword", () => {
      expect(findGuidesForDm("Vault", [vault])[0].campaign.id).toBe("v");
      expect(findGuidesForDm("Watermark remover", [watermark])).toHaveLength(1);
    });

    it("needs the DM to be 3 words or fewer", () => {
      expect(findGuidesForDm("thanks for the AI tips", [ai7])).toEqual([]);
    });

    it("answers a reused keyword with its newest guide only", () => {
      const matches = findGuidesForDm("AI", [ai6, ai7]);
      expect(matches.map((m) => m.campaign.id)).toEqual(["ai7"]);
    });

    it("treats -ise and -ize as the same word", () => {
      expect(findGuidesForDm("Humanize", [humanise])).toHaveLength(1);
    });
  });

  it("ignores DMs that are an email address or website", () => {
    const gmail = campaign("g", [], "https://x.com/g", "2026-10-01", { name: "GMAIL", matchAnyWord: true });
    expect(findGuidesForDm("Jo Bloggs\njo@gmail.com", [gmail])).toEqual([]);
    expect(findGuidesForDm("gmail.com", [gmail])).toEqual([]);
    expect(findGuidesForDm("Gmail", [gmail])).toHaveLength(1);
  });

  it("uses the campaign's own button label for a single guide", () => {
    expect(guideLookupButtons(findGuidesForDm("build", [build]))[0].label).toBe(
      "Get the guide"
    );
  });
});
