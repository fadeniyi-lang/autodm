import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { isPublicDemoHost } from "@/lib/env";

export const metadata = {
  title: "Login - AutoDM",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  if (await isPublicDemoHost()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="max-w-sm text-center text-sm text-muted">
          Sign-in is off on this demo.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";
  const failed = params.error === "1";
  const justReset = params.reset === "1";

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: callbackUrl,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        redirect("/login?error=1");
      }
      throw error;
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1c0a10] px-6">
      {/* Ambient color field — three named hues (gold, teal, crimson) as soft
          overlapping glows, kept off the form card itself so contrast never
          depends on where a blob happens to sit. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#e8a33d] opacity-40 blur-[110px]" />
        <div className="absolute -bottom-40 -right-20 h-[36rem] w-[36rem] rounded-full bg-[#1b6b6b] opacity-40 blur-[120px]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-accent opacity-50 blur-[100px]" />
      </div>

      <form
        action={authenticate}
        className="relative w-full max-w-xs rounded-2xl border border-white/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "color-mix(in srgb, var(--color-background) 70%, transparent)" }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          AutoDM
        </h1>
        <p className="mt-2 text-sm text-muted">
          Automatically DMs anyone who comments a keyword on your Instagram
          posts, so you never have to reply one by one.
        </p>

        <div className="mt-10 space-y-5">
          <div>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="Email"
              className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {failed && (
            <p className="text-sm text-error">
              That email or password isn&rsquo;t right.
            </p>
          )}
          {justReset && !failed && (
            <p className="text-sm text-success">
              Password updated. Log in with your new one.
            </p>
          )}

          <div className="flex justify-end">
            <Link href="/forgot-password" className="text-xs text-muted underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Sign in
          </button>

          <p className="text-center text-sm text-muted">
            New to AutoDM?{" "}
            <Link href="/signup" className="font-semibold text-foreground underline">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
