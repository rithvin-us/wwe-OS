# Database backups

Scripts for backing up and restoring the WWE OS PostgreSQL database.
Archives are `pg_dump --format=custom` files (compressed, selective-restore
capable via `pg_restore`).

| Script       | What it does                                                        |
| ------------ | ------------------------------------------------------------------- |
| `backup.sh`  | Timestamped dump + prunes archives older than `BACKUP_RETENTION_DAYS` (default 14) |
| `restore.sh` | Restores an archive with `--clean --if-exists` after confirmation   |

Both read `DATABASE_URL` first, then fall back to the compose defaults
(`POSTGRES_HOST/PORT/USER/PASSWORD/DB`, defaulting to `bop`).

## Windows (PowerShell) equivalents

Backup via the compose container (no local PostgreSQL install needed):

```powershell
docker compose exec postgres pg_dump -U bop -Fc bop > "wweos-$(Get-Date -Format yyyyMMdd-HHmmss).dump"
```

Restore:

```powershell
Get-Content wweos-20260721-023000.dump -Raw -AsByteStream | docker compose exec -T postgres pg_restore -U bop -d bop --clean --if-exists
```

## Production (Render)

Render managed PostgreSQL takes daily automatic snapshots; these scripts are
the *second*, provider-independent copy. Schedule `backup.sh` (cron, scheduled
job, or a Render cron service) with `DATABASE_URL` pointing at the production
database, and ship the archive off the host (object storage, second disk) —
a backup that lives next to the database it protects is not a backup.

## Restore drill

A backup you have never restored is a hope, not a backup. Quarterly:

1. `docker compose up -d postgres` with a scratch volume.
2. `restore.sh <latest archive>` against it (`DATABASE_URL=postgresql://bop:bop@localhost:5432/bop`).
3. `cd platform && python manage.py migrate && python manage.py check`.
4. Spot-check row counts (`users_user`, `purchase_bill`, `audit_log`).
