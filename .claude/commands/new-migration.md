# Database schema changes

trad-ding uses **Supabase** as its database. There is no SQLAlchemy, no Alembic, and no migration files in this repo. Schema changes are made directly in Supabase.

---

## When to use this

- Adding, renaming, or removing a column on an existing table
- Creating a new table
- Changing a column type, constraint, or index
- Inserting seed data

---

## Tables

| Table | Description |
|---|---|
| `assets` | Tracked assets (`id`, `symbol`, `name`, `asset_type`, `yfinance_symbol`) |
| `asset_models` | Trained ML model registry (`asset_id`, `storage_path`, `metrics JSONB`, `is_active`, `created_at`) |
| `asset_news` | Cached news items (`asset_id`, `content_id`, `source_type`, `content JSONB`, `created_at`) |

TypeScript types for these tables are in `web/src/lib/services/supabase.ts`.

---

## How to make a schema change

### 1. Apply the change in Supabase

Go to your Supabase project → **Table Editor** or **SQL Editor** and run the migration manually:

```sql
-- Example: add a column
ALTER TABLE assets ADD COLUMN sector TEXT;

-- Example: create a new table
CREATE TABLE asset_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. Update the TypeScript types

Update the DB types in `web/src/lib/services/supabase.ts` to match the new schema.

### 3. Update any affected services

Update `web/src/lib/services/*.ts` files that query the changed table.

---

## Tips

- **Primary keys** are UUIDs generated server-side with `gen_random_uuid()`.
- **`asset_models.is_active`** — only one active model per asset. Before inserting a new model, set all existing ones to `is_active = false`.
- **`asset_news.content_id`** — used as a deduplication key (URL or source UUID). Always set this when inserting news.
- Apply changes to **production** Supabase before deploying code that depends on them.
