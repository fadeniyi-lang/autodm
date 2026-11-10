import { timingSafeEqual } from "node:crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser, getPrimaryWorkspace } from "@/lib/workspace";
import { isEmailAllowedToSignIn } from "@/lib/env";
import { verifyPassword } from "@/lib/password";

type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

// Constant-time comparison so a wrong password takes the same time to reject
// regardless of how many characters matched — a naive `===` leaks that via
// timing and is an easy target for a brute-force script.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const authConfig = {
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        if (!isEmailAllowedToSignIn(email)) return null;

        // Legacy path: the original single-admin login, kept working so the
        // account that pre-dates self-serve sign-up (and its live
        // campaigns/workspace) never gets locked out. Checked first since it
        // doesn't require a DB round trip.
        const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD ?? "";
        if (adminEmail && adminPassword && safeEqual(email, adminEmail) && safeEqual(password, adminPassword)) {
          const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email },
          });
          return { id: user.id, email: user.email };
        }

        // Real per-user path: a self-serve account with its own password
        // hash, set at sign-up or via the forgot-password flow.
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !verifyPassword(password, user.password)) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    // Credentials sessions run on JWT, so the user id is carried on the
    // token (set once at sign-in) rather than read back from the adapter on
    // every request the way a database-session provider would.
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureWorkspaceForUser(user.id, user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const workspace = await getPrimaryWorkspace(userId);
  if (workspace) return workspace.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const createdWorkspace = await ensureWorkspaceForUser(userId, user?.email);
  return createdWorkspace.id;
}
