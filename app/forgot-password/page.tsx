import { redirect } from "next/navigation";
import Link from "next/link";
import { isPublicDemoHost } from "@/lib/env";
import { requestPasswordReset } from "@/lib/reset-token";

export const metadata = {
  title: "Reset your password - AutoDM",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  if (await isPublicDemoHost()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="max-w-sm text-center text-sm text-muted">
          Password reset is off on this demo.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const sent = params.sent === "1";

  async function requestReset(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    if (email) {
      await requestPasswordReset(email);
    }
    redirect("/forgot-password?sent=1");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1c0a10] px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#e8a33d] opacity-40 blur-[110px]" />
        <div className="absolute -bottom-40 -right-20 h-[36rem] w-[36rem] rounded-full bg-[#1b6b6b] opacity-40 blur-[120px]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-accent opacity-50 blur-[100px]" />
      </div>

      <div
        className="relative w-full max-w-xs rounded-2xl border border-white/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "color-mix(in srgb, var(--color-background) 70%, transparent)" }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Reset password
        </h1>

        {sent ? (
          <>
            <p className="mt-4 text-sm text-muted">
              If that email has an AutoDM account, a reset link is on its way. It works once and expires in 30 minutes.
            </p>
            <Link
              href="/login"
              className="mt-6 block w-full rounded bg-accent py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">
              Enter your email and we&rsquo;ll send you a link to set a new password.
            </p>
            <form action={requestReset} className="mt-10 space-y-5">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="Email"
                className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="mt-2 w-full rounded bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Send reset link
              </button>
              <p className="text-center text-sm text-muted">
                <Link href="/login" className="font-semibold text-foreground underline">
                  Back to login
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
