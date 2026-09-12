import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXCLUDE = [
  "freshbox-frontend/node_modules/*",
  "freshbox-frontend/node_modules/**",
  "freshbox-frontend/.next/*",
  "freshbox-frontend/.next/**",
  "freshbox-backend/.venv/*",
  "freshbox-backend/.venv/**",
  "**/__pycache__/*",
  "**/__pycache__/**",
  ".git/*",
  ".git/**",
  "*.db",
  "**/*.db",
  ".env",
  "**/.env",
  ".env.local",
  "**/.env.local",
  "*.zip",
];

export async function GET() {
  const out = path.join(tmpdir(), `freshbox-${randomBytes(6).toString("hex")}.zip`);
  try {
    execFileSync("zip", ["-rq", out, ".", "-x", ...EXCLUDE], {
      cwd: path.resolve(process.cwd(), ".."),
    });
    const body = readFileSync(out);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="freshbox.zip"',
        "Cache-Control": "no-store",
      },
    });
  } finally {
    try {
      unlinkSync(out);
    } catch {
      // ignore
    }
  }
}
