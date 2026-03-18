# Create a new database migration

Use this whenever you change a SQLModel table definition in `app/models/`.

---

## When to use

- Added, renamed, or removed a column on an existing model
- Created a new SQLModel table
- Changed a column type, constraint, or index
- Need to insert seed data into the DB

---

## Steps

### 1. Make your model change

Edit the relevant file in `app/models/`. Example — adding a column to `Asset`:

```python
# app/models/asset.py
class Asset(SQLModel, table=True):
    ...
    sector: str | None = Field(default=None)   # ← new column
```

### 2. Generate the migration automatically

```bash
make db-migrate msg="add sector to assets"
```

This runs `alembic revision --autogenerate -m "..."` and creates a new file in `migrations/versions/`.

> **Always review the generated file** before applying. Alembic sometimes misses renames, or generates `DROP` statements unintentionally.

### 3. Review the generated migration

```bash
# Open the latest migration file
ls -t migrations/versions/ | head -1
```

Check the `upgrade()` and `downgrade()` functions are correct.

### 4. Apply the migration

```bash
make db-upgrade
```

### 5. Verify

```bash
# Connect to your DB and confirm the schema change
# Or just start the server and confirm there are no errors
make run
```

---

## Seed data (blank migration)

If you only need to insert initial data without a schema change:

```bash
make db-seed msg="seed default assets"
```

This creates a blank migration. Then write your `op.execute(...)` statements manually inside it.

---

## Rollback

To undo the last migration:

```bash
source .venv/bin/activate
alembic downgrade -1
```

To go back to a specific revision:

```bash
alembic downgrade <revision_id>
```

---

## Common mistakes

| Mistake | Fix |
|---|---|
| Forgot to activate `.venv` | `source .venv/bin/activate` first |
| Migration generates empty `upgrade()` | Did you save the model file? Check for import errors. |
| `target_metadata` not seeing the new model | Make sure the model is imported in `migrations/env.py` |
| Applied to wrong DB | Check `DB_HOST` and `DB_NAME` in your `.env` |
