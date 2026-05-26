import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate as drizzleMigrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

// Migrations are emitted into `<package_root>/drizzle/` by drizzle-kit and
// shipped via the `files` field in package.json. From the compiled
// `dist/migrate.js` we walk one level up to find them; if a consumer rebundles
// the package they can override the path explicitly.
function defaultMigrationsFolder() {
  const distDir = fileURLToPath(new URL('.', import.meta.url));
  return resolve(distDir, '..', 'drizzle');
}

export type RunMigrationsOptions = {
  databaseUrl: string;
  migrationsFolder?: string;
};

// Apply every pending Drizzle migration against the given Postgres database.
// Connects with node-postgres (not the Neon HTTP shim) so the same code path
// works against any Postgres — local docker, RDS, Supabase, Neon direct, etc.
export async function runMigrations({
  databaseUrl,
  migrationsFolder = defaultMigrationsFolder(),
}: RunMigrationsOptions) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const db = drizzle(client);
    await drizzleMigrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}
