/**
 * Aplicador de migraciones que bypassa el problema del TypeORM CLI vs Neon Pooler.
 *
 * Lee `src/database/migrations/*.ts`, compara con la tabla `migrations` (estándar TypeORM),
 * y para las pendientes ejecuta la SQL directa vía @neondatabase/serverless (HTTP, no TCP).
 *
 * NO REEMPLAZA `npm run migration:run` — es el plan B cuando el pooler tira ECONNRESET.
 * Solo soporta migraciones donde `up()` es una secuencia de `queryRunner.query(...)`.
 *
 * Uso:
 *   npx tsx scripts/apply-pending-migrations.ts [--name=<MigrationClassName>]
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { neon } from '@neondatabase/serverless';

type ParsedMigration = {
  filePath: string;
  className: string;
  timestamp: number;
  upStatements: string[];
};

const MIGRATIONS_DIR = resolve(__dirname, '..', 'src', 'database', 'migrations');

function parseMigrationFile(filePath: string): ParsedMigration | null {
  const src = readFileSync(filePath, 'utf-8');
  const classMatch = src.match(/export class (\w+)(\d{13})\s+implements MigrationInterface/);
  if (!classMatch) return null;
  const className = `${classMatch[1]}${classMatch[2]}`;
  const timestamp = Number(classMatch[2]);

  const upStart = src.indexOf('public async up');
  if (upStart < 0) return null;
  const upEnd = src.indexOf('public async down', upStart);
  const upBody = src.substring(upStart, upEnd > 0 ? upEnd : src.length);

  const stmts: string[] = [];
  const re = /queryRunner\.query\(\s*`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(upBody)) !== null) {
    stmts.push(m[1].trim());
  }
  return { filePath, className, timestamp, upStatements: stmts };
}

async function main() {
  const argName = process.argv.find((a) => a.startsWith('--name='))?.slice(7);

  const sql = neon(process.env.DATABASE_URL!);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.ts'))
    .sort();

  const parsed = files
    .map((f) => parseMigrationFile(join(MIGRATIONS_DIR, f)))
    .filter((m): m is ParsedMigration => m !== null);

  if (argName) {
    const target = parsed.find((p) => p.className === argName);
    if (!target) {
      console.error(`Migration ${argName} no encontrada. Disponibles:`);
      for (const p of parsed) console.error(`  - ${p.className}`);
      process.exit(1);
    }
    await applyOne(sql, target);
    return;
  }

  console.log(`Found ${parsed.length} migration files. Checking which are applied...`);
  for (const m of parsed) {
    const exists = (await sql`SELECT 1 FROM migrations WHERE name = ${m.className} LIMIT 1`) as unknown[];
    if (exists.length > 0) {
      console.log(`✓ ${m.className} (already applied)`);
      continue;
    }
    await applyOne(sql, m);
  }
}

async function applyOne(sql: ReturnType<typeof neon>, m: ParsedMigration): Promise<void> {
  console.log(`→ Applying ${m.className} (${m.upStatements.length} statements)...`);
  for (let i = 0; i < m.upStatements.length; i++) {
    const stmt = m.upStatements[i];
    try {
      await sql.query(stmt);
    } catch (err) {
      console.error(`Failed at statement ${i + 1}/${m.upStatements.length}:\n${stmt.slice(0, 200)}...`);
      throw err;
    }
  }
  await sql`INSERT INTO migrations (timestamp, name) VALUES (${m.timestamp}, ${m.className})`;
  console.log(`✓ ${m.className} applied + recorded.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
