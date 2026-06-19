# Deploying Pip backend to Railway

These steps get the FastAPI backend (this folder) running on Railway
with persistent storage for the SQLite candle database. End state:
a stable HTTPS URL the mobile app can point at instead of the
cloudflared dev tunnel.

Expected time: **30-60 minutes**, mostly waiting for first deploy.

---

## 1. Sign up + create project

1. Sign in at https://railway.app with GitHub.
2. Click **New Project** → **Deploy from GitHub repo** → pick this
   `trading-app` repo.
3. When prompted for the **root directory**, set it to `backend/`.
4. Railway auto-detects Python and starts a first build. It will fail
   the first time because the SQLite DB isn't there yet — that's
   expected, we fix it in step 3.

## 2. Add a persistent volume

The SQLite candle database (`pocket_trade.db`) must survive deploys.
Railway gives you a Volume mount for that.

1. In the Railway project, open the deployed service → **Settings**
   tab → scroll to **Volumes**.
2. Click **+ New Volume**.
3. **Mount path**: `/data`
4. **Size**: 2 GB to start (you can resize later; the post-slim DB is
   ~2-3 GB).
5. Save. Railway will redeploy the service with the volume attached.

## 3. Tell the backend where the DB lives

The backend's `db.py` currently writes the SQLite file to
`backend/pocket_trade.db`. Override that with an env var so the file
lands on the mounted volume:

1. In the Railway project → **Variables** tab → add:
   - `POCKET_TRADE_DB_PATH` = `/data/pocket_trade.db`
2. *(One-time)* In `backend/db.py`, change the `DB_PATH` constant to
   read from the env var first, falling back to the local file in
   dev. Add this near the top of `db.py`:

   ```python
   import os
   DB_PATH = Path(os.environ.get(
       "POCKET_TRADE_DB_PATH",
       Path(__file__).parent / "pocket_trade.db",
   ))
   ```

3. Commit + push — Railway redeploys automatically.

## 4. Seed the volume with the candle data

The volume starts empty. You need to copy your local
`backend/pocket_trade.db` (after running `slim_db_for_prod.py`) onto
the Railway volume. Easiest path:

1. **Slim the local DB first** to drop the 10 unused symbols:
   ```
   cd backend
   python data_pipeline/slim_db_for_prod.py
   ```
   This produces `backend/pocket_trade_slim.db` — should be ~2-3 GB
   (down from 12 GB).

2. **Open a Railway shell** into the running service:
   - Railway project → service → **⋮** menu → **Shell**.
   - Or via CLI: `railway shell` (after `npm i -g @railway/cli` and
     `railway login`).

3. **Copy the slimmed file up** using Railway's CLI:
   ```
   railway run --service <service-name> "cat > /data/pocket_trade.db" < ./pocket_trade_slim.db
   ```
   *(Or use `scp` / `rsync` if Railway exposes SSH on your plan.)*

4. Restart the service from the Railway UI to pick up the new file.

## 5. Verify

Hit the health endpoint:

```
curl https://<your-service>.up.railway.app/health
```

Expected response: `{"status":"ok"}`.

Then `/markets`:

```
curl https://<your-service>.up.railway.app/markets
```

Expected: a JSON array listing NQ, ES, YM, GC + the other catalog
entries.

## 6. Point the mobile app at Railway

In `src/config/chartBackend.ts` replace the cloudflared URL with the
Railway URL Railway shows in the dashboard (looks like
`https://pip-backend-production-XXXX.up.railway.app`).

Rebuild the mobile app via EAS (`eas build --profile production`) so
the new URL is baked in.

---

## Cost summary

- **Hobby plan**: $5/month — enough for this app's traffic.
- **Volume**: roughly $0.25/GB-month. A 2 GB volume is ~$0.50/month.
- **Total**: ~**$5-6/month**.

If traffic grows enough that the free CPU/memory ceiling is exceeded,
Railway will surface a usage warning before throttling — you can
upgrade to Pro ($20/mo) if/when that happens. Not expected for the
first months.

## Troubleshooting

- **Cold start takes > 30s**: Railway sleeps free Hobby services
  after 5 minutes of idle. The candle DB read on first request adds
  ~3-5s. If that bothers users, upgrade to Pro (no idle sleep).
- **DB file not found**: confirm `POCKET_TRADE_DB_PATH` env var is
  set AND the volume mount path is `/data`.
- **Out-of-memory on first request**: SQLite memory-maps the candle
  DB; if Hobby's 512 MB ceiling is hit, run `VACUUM` on the slim DB
  before uploading.

---

## Future improvements (out of scope for v1)

- Move daily-ingest scripts (`fetch_stooq.py`, `ingest_real_intraday.py`)
  into Railway cron jobs so the DB auto-refreshes nightly.
- Move from SQLite to managed Postgres (Railway provides this in one
  click) for write-heavy concurrency.
- Add Sentry to the FastAPI side for backend crash reporting.
