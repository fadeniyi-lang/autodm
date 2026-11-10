import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { isPublicDemoHost } from "@/lib/env";
import { createAccount } from "@/lib/signup";

export const metadata = {
  title: "Sign up - AutoDM",
  description: "Create your AutoDM account.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isPublicDemoHost()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="max-w-sm text-center text-sm text-muted">
          Sign-up is off on this demo.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const errorMessage = params.error;

  async function register(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await createAccount({ name, email, password });
    if (!result.ok) {
      redirect(`/signup?error=${encodeURIComponent(result.error)}`);
    }

    try {
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    } catch (error) {
      if (error instanceof AuthError) {
        // Account was created but sign-in failed for some other reason
        // (e.g. an allowlist edge case) — send them to log in normally
        // rather than showing a dead end after a successful sign-up.
        redirect("/login");
      }
      throw error;
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1c0a10] px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#e8a33d] opacity-40 blur-[110px]" />
        <div className="absolute -bottom-40 -right-20 h-[36rem] w-[36rem] rounded-full bg-[#1b6b6b] opacity-40 blur-[120px]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-accent opacity-50 blur-[100px]" />
      </div>

      <form
        action={register}
        className="relative w-full max-w-xs rounded-2xl border border-white/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "color-mix(in srgb, var(--color-background) 70%, transparent)" }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted">
          7 days free, then $5 a month. Cancel any time. Connect Instagram once you&rsquo;re in.
        </p>

        <div className="mt-10 space-y-5">
          <div>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Name"
              className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>
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
              minLength={8}
              autoComplete="new-password"
              placeholder="Password (8+ characters)"
              className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-error">{errorMessage}</p>
          )}

          <button
            type="submit"
            className="mt-2 w-full rounded bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Create account
          </button>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-foreground underline">
              Log in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
