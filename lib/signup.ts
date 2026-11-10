import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";
import { isEmailAllowedToSignIn } from "@/lib/env";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";

export type CreateAccountResult = { ok: true } | { ok: false; error: string };

// Shared by the signup page's server action and the JSON API route below,
// so there's exactly one place that decides whether an email/password pair
// is allowed to become an account.
export async function createAccount(opts: {
  name?: string;
  email: string;
  password: string;
}): Promise<CreateAccountResult> {
  const name = (opts.name ?? "").trim().slice(0, 200);
  const email = opts.email.trim().toLowerCase().slice(0, 200);
  const password = opts.password;

  if (!email || !email.includes("@") || !email.split("@")[1]?.includes(".")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!isPasswordStrongEnough(password)) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (!isEmailAllowedToSignIn(email)) {
    return { ok: false, error: "Sign-ups aren't open for this email right now." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // A row can already exist without a password (e.g. the legacy admin
    // upsert, or a prior magic-link sign-in) — let sign-up "claim" it rather
    // than bouncing the person to a login they can't complete.
    if (existing.password) {
      return { ok: false, error: "An account with this email already exists. Try logging in." };
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { name: name || existing.name, password: hashPassword(password) },
    });
    await ensureWorkspaceForUser(existing.id, email);
    return { ok: true };
  }

  const user = await prisma.user.create({
    data: { name: name || null, email, password: hashPassword(password) },
  });
  await ensureWorkspaceForUser(user.id, email);
  return { ok: true };
}
