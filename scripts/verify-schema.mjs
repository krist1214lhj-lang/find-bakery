import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "202606180001_initial_schema.sql",
);
const seedPath = join(root, "supabase", "seed.sql");
const bakeryPath = join(root, "lib", "bakeries.ts");
const databaseTypesPath = join(root, "lib", "supabase", "database.types.ts");

const migration = readFileSync(migrationPath, "utf8");
const seed = readFileSync(seedPath, "utf8");
const bakeries = readFileSync(bakeryPath, "utf8");
const databaseTypes = readFileSync(databaseTypesPath, "utf8");

const rlsTables = [
  "bakery_brands",
  "bakery_locations",
  "business_hours",
  "sources",
  "special_schedules",
  "menu_items",
  "bread_categories",
  "location_bread_categories",
  "external_accounts",
  "verification_records",
  "fame_evidence",
  "user_roles",
  "saved_bakeries",
  "correction_reports",
  "review_actions",
];

const requiredFragments = [
  "security definer",
  "set search_path = ''",
  "create or replace function public.review_correction_report",
  "revoke all on all tables in schema public from anon, authenticated",
  "grant all on all tables in schema public to service_role",
  "correction_resolution_matches_status",
  "menu_price_requires_check_date",
  "special_schedule_range",
  "search_aliases text[] not null default '{}'",
  "(select auth.role()) = 'service_role'",
  ") to authenticated, service_role",
  "review_action_actor_required",
];

const errors = [];

for (const table of rlsTables) {
  if (
    !migration.includes(
      `alter table public.${table} enable row level security;`,
    )
  ) {
    errors.push(`RLS is not enabled for public.${table}`);
  }
}

for (const fragment of requiredFragments) {
  if (!migration.toLowerCase().includes(fragment.toLowerCase())) {
    errors.push(`Missing migration contract: ${fragment}`);
  }
}

if (
  /grant\s+[^;]*insert[^;]*correction_reports[^;]*\bto\s+anon\b/is.test(
    migration,
  )
) {
  errors.push("Anonymous clients must not insert correction_reports directly");
}

if (
  /grant\s+[^;]*update[^;]*correction_reports[^;]*\bto\s+authenticated\b/is.test(
    migration,
  )
) {
  errors.push("Authenticated clients must review reports through RPC only");
}

const bakeryIds = [
  ...bakeries.matchAll(/id:\s*"(20000000-0000-4000-8000-[0-9]{12})"/g),
].map((match) => match[1]);

if (bakeryIds.length === 0) {
  errors.push("No database-compatible bakery UUIDs found in seed data");
}

for (const bakeryId of bakeryIds) {
  if (!seed.includes(bakeryId)) {
    errors.push(
      `App bakery UUID is missing from supabase/seed.sql: ${bakeryId}`,
    );
  }
}

for (const typeName of [
  "correction_reports",
  "review_actions",
  "review_correction_report",
  "correction_status",
  "review_action_type",
]) {
  if (!databaseTypes.includes(typeName)) {
    errors.push(`Database type snapshot is missing: ${typeName}`);
  }
}

if (errors.length > 0) {
  console.error("[schema] contract verification failed");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `[schema] verified ${rlsTables.length} RLS tables and ${bakeryIds.length} seed location IDs`,
);
