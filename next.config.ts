import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      // Only needed behind a proxy that rewrites the Host header (for
      // example a Cloudflare Tunnel in front of a *.up.railway.app domain):
      // Next.js's Server Action CSRF check compares the browser's Origin
      // with the Host it sees and rejects a mismatch, including login.
      // Comma separated hostnames, e.g. "autodm.example.com".
      allowedOrigins: (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  },
};

export default nextConfig;
