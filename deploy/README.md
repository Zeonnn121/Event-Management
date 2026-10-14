# `deploy/` — EC2 and Auto Scaling artifacts

Everything here targets **Amazon Linux 2023** in **`ap-south-1`**. The Windows
development machine only runs `build-and-upload.ps1`; everything else runs on the
instance.

## Files

| File | Runs on | Purpose |
| --- | --- | --- |
| `build-and-upload.ps1` | Windows | Builds frontend + backend, creates `app.tar.gz`, uploads it and the CloudWatch config to S3 |
| `user-data.sh` | EC2 (root, first boot) | Installs Node 20 / pm2 / CloudWatch agent, pulls the bundle, installs deps, starts the app, redirects :80 → :3000 |
| `ecosystem.config.js` | EC2 (pm2) | pm2 app definition: `tc-backend`, port 3000, production env, logs to `/var/log/tc-app/` |
| `cloudwatch-agent-config.json` | EC2 (CloudWatch agent) | Ships both log files to `/tc-events/app` and collects memory/disk metrics |
| `iam-ec2-policy.json` | AWS console | Least-privilege inline policy for the EC2 instance role |
| `ssm-parameters.md` | Windows / console | The seven `/tc-events/prod/` parameters the app reads at boot |
| `schema-import.md` | EC2 (Session Manager) | Import `database/schema.sql` into private RDS, plus loading demo data |

## Required IAM permissions for the EC2 role

Attach **all three** of the following to the instance role:

1. **`iam-ec2-policy.json`** (this folder) — inline policy. Replace the
   `BUCKET_NAME`, `REGION` and `ACCOUNT_ID` placeholders before attaching. This
   covers reading the deploy bundle, reading/writing the private S3 bucket, and
   reading the app's SSM parameters.
2. **`CloudWatchAgentServerPolicy`** — AWS managed. Lets the CloudWatch agent
   create the `/tc-events/app` log group and publish metrics.
3. **`AmazonSSMManagedInstanceCore`** — AWS managed. Lets you open a Session
   Manager shell **without opening port 22 or using a key pair**. The schema
   import and any instance debugging depend on this.

## End-to-end workflow

1. **Create the bucket folders** `events/`, `certificates/`, `backups/`,
   `deploy/`, and add the S3 CORS config documented at the top of
   `backend/src/services/s3.service.ts`.
2. **Create the SSM parameters** — see `ssm-parameters.md`.
3. **Create the IAM role** with the three policies above.
4. **Build and upload:**
   ```powershell
   cd deploy
   .\build-and-upload.ps1 -BucketName <BUCKET_NAME>
   ```
5. **Launch the instance** (Amazon Linux 2023, `t3.micro`, public subnet,
   `app-sg`, the IAM role) with the contents of `user-data.sh` as user data.
   Edit `BUCKET_NAME` at the top of that script first.
6. **Import the schema** into RDS — see `schema-import.md`. Do this before the
   demo, or you will have no admin user to log in with.
7. **Open `http://<INSTANCE_PUBLIC_IP>/`** in a browser. Port 80 is redirected
   to the app's port 3000 by an iptables rule.

## Updating a running deployment (checklist)

Use this whenever you change `backend/src/**`, `frontend/src/**`, or
`database/*.sql` and need a running instance to pick the change up.

### Step 1 — Work out what actually changed

| Changed | Schema step needed? |
| --- | --- |
| Only `backend/src`, `frontend/src`, docs | No — skip to Step 3 |
| Anything in `database/` | Yes — do Step 2 first |

The schema must land **before** the new code runs: the new routes query the new
tables, so deploying code first leaves those endpoints returning 500s.

### Step 2 — RDS schema (only when `database/` changed)

RDS is private (`public access = No`, and `db-sg` accepts only from `app-sg`), so
this runs **from the instance** over Session Manager, exactly like
`schema-import.md`.

**2a. Find the schema version currently in RDS**

```bash
mysql -h <RDS_ENDPOINT> -u <DB_USER> -p -e "SHOW COLUMNS FROM users; SHOW TABLES;" tc_events
```

Read the `role` column, then check whether `registration_requests` is listed:

| `users.role` includes | `registration_requests` | Run |
| --- | --- | --- |
| `council_member` | present | Nothing — already current |
| `enum('super_admin','council_lead','member')` (no `council_member`) | present | `migrate_v4.sql` |
| `enum('super_admin','council_lead','member')` | missing | `migrate_v3.sql`, then `migrate_v4.sql` |
| `enum('admin','organizer','member')` | either | `migrate_v2.sql`, then `migrate_v3.sql`, then `migrate_v4.sql` |

> **Do not re-import `schema.sql` to upgrade an existing database.** Every
> statement in it is `CREATE TABLE IF NOT EXISTS`, so it silently skips tables
> that already exist — including `users`, whose role `ENUM` is precisely what
> `migrate_v2.sql` has to change. `schema.sql` is for a **fresh** RDS instance
> only.

Both migration files are written to be safe to re-run, so applying one you are
unsure about is harmless.

**2b. Upload the migration from Windows**

```powershell
aws s3 cp database/migrate_v2.sql "s3://<BUCKET_NAME>/deploy/migrate_v2.sql" --region ap-south-1
aws s3 cp database/migrate_v3.sql "s3://<BUCKET_NAME>/deploy/migrate_v3.sql" --region ap-south-1
aws s3 cp database/migrate_v4.sql "s3://<BUCKET_NAME>/deploy/migrate_v4.sql" --region ap-south-1
```

**2c. Apply it on the instance**

```bash
sudo dnf install -y mariadb105                     # only if the client is missing
aws s3 cp s3://<BUCKET_NAME>/deploy/migrate_v2.sql ~/migrate_v2.sql   # only if 2a said so
aws s3 cp s3://<BUCKET_NAME>/deploy/migrate_v3.sql ~/migrate_v3.sql
aws s3 cp s3://<BUCKET_NAME>/deploy/migrate_v4.sql ~/migrate_v4.sql
mysql -h <RDS_ENDPOINT> -u <DB_USER> -p tc_events < ~/migrate_v2.sql
mysql -h <RDS_ENDPOINT> -u <DB_USER> -p tc_events < ~/migrate_v3.sql
mysql -h <RDS_ENDPOINT> -u <DB_USER> -p tc_events < ~/migrate_v4.sql
```

`migrate_v4.sql` also converts anyone who was sitting in a council as a plain
`member` into a `council_member`, so `user_id` values and all existing data are
preserved.

**2d. Verify**

```bash
mysql -h <RDS_ENDPOINT> -u <DB_USER> -p -e "SHOW TABLES;" tc_events   # registration_requests present
```

### Step 3 — Build and upload the code

```powershell
cd deploy
.\build-and-upload.ps1 -BucketName <BUCKET_NAME>
```

This rebuilds **both** apps and bundles `backend/dist` + `frontend/dist`, so it
covers UI changes too. It uses `npm ci`, so the lockfiles must be committed.

An app-only change needs **no SSM, IAM, S3-bucket, or Lambda changes** — no new
config keys are read at boot.

### Step 4 — Put the new bundle on the instance

Either approach works:

**Option A — replace the instance** with `user-data.sh` as user data. That script
is idempotent by design: it wipes `/opt/tc-app`, re-extracts the bundle,
reinstalls dependencies, restarts pm2 and re-applies the iptables rule.

**Option B — update the running instance in place.** This mirrors steps 4–7 of
`user-data.sh`:

```bash
sudo aws s3 cp s3://<BUCKET_NAME>/deploy/app.tar.gz /tmp/app.tar.gz --region ap-south-1
sudo find /opt/tc-app -mindepth 1 -delete
sudo tar -xzf /tmp/app.tar.gz -C /opt/tc-app
sudo chown -R ec2-user:ec2-user /opt/tc-app
sudo -u ec2-user bash -lc "cd /opt/tc-app/backend && npm ci --omit=dev"
sudo -u ec2-user bash -lc "pm2 restart tc-backend && pm2 save"
```

The `npm ci` step is not optional: the clean extract leaves `node_modules`
empty, so the app will not boot without it.

### Step 5 — Verify

```bash
curl -s http://localhost:3000/health       # {"status":"ok"}
curl -s http://localhost:3000/health/db    # {"status":"ok","db":"up"}
sudo tail -n 50 /var/log/tc-app/out.log
```

Then in the browser at `http://<INSTANCE_PUBLIC_IP>/`:

- [ ] Sign in as the super admin.
- [ ] **Users → Create User** succeeds. (This was the original bug: the page sent
      a role the API rejects, and the route was gated on a role that no longer
      exists.)
- [ ] **Approvals** loads and lists pending Council Lead requests. A 500 here
      means Step 2 was skipped and `registration_requests` is missing.
- [ ] A Council Lead account sees **My Council Members** and can add one.
- [ ] **Councils** (super admin) lists councils; Delete is refused with an
explanation until the council has no events and no members.
- [ ] A Council Lead can delete an event of their own council, and remove a
      council member from their council.

### Rolling back

`app.tar.gz` is overwritten on every upload, so keep the previous bundle if you
may need to revert — re-upload the old tarball and repeat Step 4. The migrations
are additive: dropping `registration_requests` is the only schema undo, and it
discards pending requests.

## Things that will bite you

- **No secrets live in this folder.** Every value is a placeholder, and the app
  reads real secrets from SSM at boot using the instance role. If you ever find
  yourself pasting a password into `user-data.sh` or `ecosystem.config.js`,
  something has gone wrong.
- **The iptables rule is not reboot-persistent.** User data re-applies it on
  every *new* instance, so Auto Scaling scale-out is fine, but a manual `reboot`
  of an existing instance needs `user-data.sh` re-run (or the rule re-added).
- **`user-data.sh` and `cloudwatch-agent-config.json` are two separate S3
  objects.** If you edit the CloudWatch config, re-run `build-and-upload.ps1` or
  the instance will fetch the stale copy.
- **`build-and-upload.ps1` uses `npm ci`**, which deletes `node_modules` and
  installs strictly from `package-lock.json`. Commit the lockfile after any
  dependency change or the build will fail.
- **The bundle does not include `database/*.sql`** — that is deliberate, since
  RDS is set up once and separately from app deploys. Migration files reach the
  instance over the same S3 hop as `schema.sql`; see *Updating a running
  deployment* above.
