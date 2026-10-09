import "dotenv/config";
import { defineConfig } from "prisma/config";

// The CLI (migrate, studio, seed) prefers the direct (unpooled) connection.
// On Neon use the unpooled URL in DIRECT_URL; locally both can be the same.
// DATABASE_URL_UNPOOLED is the name the Vercel ↔ Neon integration uses.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL_UNPOOLED"] || process.env["DATABASE_URL"],
  },
});
