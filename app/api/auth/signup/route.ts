import { NextResponse } from "next/server";
import { isPublicDemoHost } from "@/lib/env";
import { createAccount } from "@/lib/signup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (await isPublicDemoHost()) {
    return NextResponse.json({ error: "Sign-up is off on this demo." }, { status: 403 });
  }

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const result = await createAccount({
    name: body.name,
    email: String(body.email ?? ""),
    password: String(body.password ?? ""),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
