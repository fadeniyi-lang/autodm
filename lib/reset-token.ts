import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getBaseUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { hashPassword, isPasswordStrongEnough } from "@/lib/password";

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Always resolves, and never reveals whether the email had an account —
// callers show the same "check your email" message either way.
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return;

  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${getBaseUrl()}/reset-password/${raw}`;
  await sendEmail({
    to: normalized,
    subject: "Reset your AutoDM password",
    text: `Reset your password: ${resetUrl}\n\nThis link works once and expires in 30 minutes. If you didn't ask for this, ignore this email.`,
    html: `<p>Someone asked to reset the password on this AutoDM account.</p>
<p><a href="${resetUrl}">Reset your password</a></p>
<p style="color:#767676;font-size:13px;">This link works once and expires in 30 minutes. If you didn't ask for this, ignore this email — your password hasn't changed.</p>`,
  });
}

export type ResetPasswordResult = { ok: true } | { ok: false; error: string };

export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!isPasswordStrongEnough(newPassword)) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const tokenHash = hashToken(rawToken);
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!token || token.usedAt || token.expiresAt <= new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { password: hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
