import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";

export function hashConnectorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newConnectorToken() {
  return `adm_${randomBytes(24).toString("base64url")}`;
}

export async function workspaceForConnectorToken(token: string) {
  if (!token || !token.startsWith("adm_") || token.length < 30) return null;
  return prisma.workspace.findUnique({
    where: { connectorTokenHash: hashConnectorToken(token) },
    select: { id: true, name: true },
  });
}
