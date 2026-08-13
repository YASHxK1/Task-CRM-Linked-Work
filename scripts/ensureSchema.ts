import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPool } from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.warn("[EnsureSchema] DATABASE_URL not set, skipping schema setup");
  process.exit(0);
}

const pool = createPool(databaseUrl);

const bootstrapSql = readFileSync(
  resolve(import.meta.dirname, "../drizzle/bootstrap.sql"),
  "utf-8"
)
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = bootstrapSql
  .split(/;\s*(\r?\n|$)/)
  .map((statement) => statement.trim())
  .filter(Boolean);

try {
  for (const statement of statements) {
    await pool.query(statement);
  }
  console.log(
    `[EnsureSchema] Database schema ready (${statements.length} statements)`
  );
} catch (error) {
  console.error("[EnsureSchema] Failed to apply schema:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
process.exit(process.exitCode ?? 0);
