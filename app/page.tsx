import type { Metadata } from "next";
import Link from "next/link";
import PublicSiteHeader from "@/components/public-site-header";

export const metadata: Metadata = {
  title: "AutoDM — Instagram Comment-to-DM Automation",
  description:
    "Someone comments a keyword on your Instagram post, AutoDM sends them a private DM automatically. No team, no manual replies, no missed leads.",
  alternates: { canonical: "/" },
};

const steps = [
  {
    n: "01",
    title: "Someone comments your keyword",
    body: "You post about a product, offer, or freebie and tell people to comment a word — \"LINK\", \"GUIDE\", whatever fits.",
  },
  {
    n: "02",
    title: "AutoDM replies in private, instantly",
    body: "The moment that comment lands, AutoDM sends them a DM through Meta's official private-reply API — not a scraper, nothing that risks the account.",
  },
  {
    n: "03",
    title: "They get exactly what they asked for",
    body: "A link, a discount code, a guide, a booking page — whatever you set the campaign to deliver. Optional follow-up DM if they don't click.",
  },
];

const features = [
  {
    title: "Unlimited keyword campaigns",
    body: "Run a different automation for every post, every offer, every launch — each with its own keyword, message, and delivery link.",
  },
  {
    title: "Tracked links, not guesses",
    body: "Every link AutoDM sends is a tracked link, so you see exactly how many people clicked through from each campaign.",
  },
  {
    title: "Client-ready reports",
    body: "Share a live report link for any campaign — built for agencies managing this on behalf of clients, not just solo accounts.",
  },
  {
    title: "AI-drafted replies for everything else",
    body: "Inbound DMs that don't match a campaign still get a draft reply waiting for you, so nothing sits unanswered.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader active="home" />

      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-5xl px-5 py-24 text-center sm:px-6 lg:px-8">
          <p className="font-display text-sm font-bold uppercase tracking-wide text-accent">
            Instagram comment-to-DM automation
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-5xl font-black leading-tight text-foreground sm:text-6xl">
            Reply to every comment, without replying to a single one.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">
            AutoDM watches your Instagram posts for a keyword in the comments and
            sends the commenter a private DM automatically — the link, the
            code, the guide, whatever you&rsquo;re offering. You post once; AutoDM
            handles every reply after that.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-7 py-3.5 text-sm font-bold text-white transition hover:bg-accent-hover"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-border px-7 py-3.5 text-sm font-bold text-foreground transition hover:border-border-hover hover:bg-surface-hover"
            >
              Log in
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-3xl font-black text-foreground sm:text-4xl">
          How it actually works
        </h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.n} className="rounded-xl border border-border bg-surface p-6">
              <span className="font-display text-sm font-bold text-accent">{step.n}</span>
              <h3 className="mt-3 font-display text-xl font-bold text-foreground">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface py-20">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">
            Built for real campaigns, not a demo
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl border border-border bg-background p-6">
                <h3 className="font-display text-lg font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto w-full max-w-4xl px-5 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-3xl font-black text-foreground sm:text-4xl">Free and open source</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted">
          Run your own copy on your own server, with your own Instagram app.
          No subscription, no per-DM fees. Create an account, connect your
          Instagram account, and launch your first keyword campaign in minutes.
          Built on{" "}
          <a href="https://github.com/diwenne/openreply" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">
            OpenReply
          </a>
          , MIT licensed.
        </p>
      </section>

      <section id="security" className="mx-auto w-full max-w-4xl px-5 pb-20 text-center sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-black text-foreground">
          Meta&rsquo;s official private-reply API, nothing else
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted">
          AutoDM never asks for your Instagram password and doesn&rsquo;t automate
          the app itself — it connects through Meta&rsquo;s own API for Instagram
          professional accounts, the same one every legitimate DM tool uses.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-accent p-10 text-center">
          <h2 className="font-display text-3xl font-black text-white sm:text-4xl">
            Turn your next comment into a sent DM
          </h2>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-accent transition hover:bg-white/90"
          >
            Sign up
          </Link>
        </div>
      </section>
    </main>
  );
}
