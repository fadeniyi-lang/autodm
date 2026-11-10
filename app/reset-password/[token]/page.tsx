import { redirect } from "next/navigation";
import Link from "next/link";
import { isPublicDemoHost } from "@/lib/env";
import { resetPasswordWithToken } from "@/lib/reset-token";

export const metadata = {
  title: "Set a new password - AutoDM",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
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

  const { token } = await params;
  const { error } = await searchParams;

  async function submit(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) {
      redirect(`/reset-password/${token}?error=${encodeURIComponent("Passwords don't match.")}`);
    }

    const result = await resetPasswordWithToken(token, password);
    if (!result.ok) {
      redirect(`/reset-password/${token}?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/login?reset=1");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#1c0a10] px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-[#e8a33d] opacity-40 blur-[110px]" />
        <div className="absolute -bottom-40 -right-20 h-[36rem] w-[36rem] rounded-full bg-[#1b6b6b] opacity-40 blur-[120px]" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-accent opacity-50 blur-[100px]" />
      </div>

      <form
        action={submit}
        className="relative w-full max-w-xs rounded-2xl border border-white/40 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl backdrop-saturate-150"
        style={{ background: "color-mix(in srgb, var(--color-background) 70%, transparent)" }}
      >
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Set a new password
        </h1>

        <div className="mt-10 space-y-5">
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="New password (8+ characters)"
            className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="w-full border-b border-border bg-transparent py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            type="submit"
            className="mt-2 w-full rounded bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Set password
          </button>

          <p className="text-center text-sm text-muted">
            <Link href="/forgot-password" className="font-semibold text-foreground underline">
              Request a new link
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
