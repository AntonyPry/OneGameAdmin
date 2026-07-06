# Production Deployment

Observed production layout on 2026-07-06:

- repository path: `/opt/OneGameAdmin`
- client app: `/opt/OneGameAdmin/client`
- server app: `/opt/OneGameAdmin/server`
- PM2 process: `index`
- PM2 script: `/opt/OneGameAdmin/server/index.js`
- PM2 cwd: `/opt/OneGameAdmin/server`
- deployed branch: `main`

## Runtime Model

The backend is the PM2-managed Node process. The frontend is a Vite build from
`client/` and should be served by the production web server or hosting layer.

The new client reads the backend URL from `VITE_BACKEND_URL` at build time.
The old `REACT_APP_BACKEND_URL` variable is not used by the Vite client.

## Required Server Environment

Required backend environment variables:

- `BACKEND_PORT`
- `CLIENT_URL`
- `DB_HOST`
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `JWT_SECRET`
- `SMARTSHELL_MANAGER_LOGIN`
- `SMARTSHELL_MANAGER_PASSWORD`

Optional backend environment variables:

- `JWT_EXPIRES_IN`
- `AUTH_PUBLIC_REGISTER_ENABLED`
- `AUTH_REGISTER_TOKEN`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `BOOTSTRAP_ADMIN_FIRST_NAME`
- `BOOTSTRAP_ADMIN_LAST_NAME`

`CLIENT_URL` is a comma-separated allowlist of browser origins allowed by CORS.
For the public site it must include the actual frontend origin, for example the
domain used in the browser. If the site is also opened by IP, include that
origin too.

Required client build-time environment:

- `VITE_BACKEND_URL`

For the current single-domain deployment this usually points at the public API
origin, for example the same HTTPS origin that serves `/api`.

Do not commit `.env` files or real credential values.

Template files are committed as:

- `server/.env.example`
- `client/.env.example`

Copy them to `.env` on the target server and replace every `CHANGE_ME` value
there. Keep real values only on the server.

## Fresh Server Bootstrap

The SaaS stabilization release uses MySQL. If the target server did not have a
database for this project before, install and initialize MySQL before running
migrations.

Install MySQL on Ubuntu/Debian:

```bash
apt update
apt install -y mysql-server
systemctl enable --now mysql
```

Create the application database and MySQL user. Use a strong password and put
the same value into `server/.env` as `DB_PASS`.

```bash
mysql -u root
```

```sql
CREATE DATABASE onegame_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'onegame_admin'@'localhost' IDENTIFIED BY 'CHANGE_ME_DB_PASSWORD';
GRANT ALL PRIVILEGES ON onegame_admin.* TO 'onegame_admin'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Create backend env:

```bash
cd /opt/OneGameAdmin/server
cp .env.example .env
nano .env
```

Minimum backend values:

```env
NODE_ENV=production
BACKEND_PORT=5000
CLIENT_URL=https://onegameadmin.ru,https://149.154.70.137
DB_HOST=localhost
DB_NAME=onegame_admin
DB_USER=onegame_admin
DB_PASS=CHANGE_ME_DB_PASSWORD
JWT_SECRET=CHANGE_ME_LONG_RANDOM_VALUE
SMARTSHELL_MANAGER_LOGIN=CHANGE_ME
SMARTSHELL_MANAGER_PASSWORD=CHANGE_ME
```

Create client env before building:

```bash
cd /opt/OneGameAdmin/client
cp .env.example .env
nano .env
```

Minimum client value:

```env
VITE_BACKEND_URL=https://onegameadmin.ru
```

Run migrations and seed the initial club:

```bash
cd /opt/OneGameAdmin/server
npx sequelize-cli db:migrate
npm run bootstrap:current-club
```

`bootstrap:current-club` is idempotent: it creates or updates the current club
by `CURRENT_CLUB_SMARTSHELL_ID`. Defaults match the current club:

```env
CURRENT_CLUB_SMARTSHELL_ID=6816
CURRENT_CLUB_NAME=Основной клуб
CURRENT_CLUB_ADDRESS=г. Москва, ул. Ленина, д. 1
CURRENT_CLUB_OPENING_DATE=2024-12-01T00:00:00Z
```

Use `CURRENT_CLUB_SETTINGS_JSON` only for a JSON object with deliberate
settings overrides. Secrets must not go there.

To create the first platform administrator, set
`BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in `server/.env`, then
run:

```bash
cd /opt/OneGameAdmin/server
npx sequelize-cli db:seed --seed 20260404095705-bootstrap-platform-admin.js
```

After that, use the platform admin UI to create club users and memberships.

## Deploy Checklist

From `/opt/OneGameAdmin` on the target server:

```bash
git checkout main
git pull
```

Install/update dependencies when package files changed:

```bash
cd /opt/OneGameAdmin/server
npm install

cd /opt/OneGameAdmin/client
npm install
```

Run database migrations from the server package:

```bash
cd /opt/OneGameAdmin/server
npx sequelize-cli db:migrate
```

Build the client with the production backend URL configured:

```bash
cd /opt/OneGameAdmin/client
npm run build
```

Restart the PM2 backend process:

```bash
pm2 restart index
pm2 status
pm2 logs index --lines 100
```

## Smoke Checks

After deploy:

- open the public frontend URL in a browser;
- login as a demo or real user;
- check `/api/auth/me` through the browser session;
- verify CORS has no browser console errors;
- check admin panel, plans, exports, club settings, platform users;
- verify Smartshell-dependent screens either load real data or show the
  expected integration error state;
- verify `pm2 logs index --lines 100` has no startup crashes.

## Current PM2 Notes

The existing PM2 process is named `index`. If the process is recreated, keep the
cwd as `/opt/OneGameAdmin/server` and the script as
`/opt/OneGameAdmin/server/index.js`, then save the PM2 process list if the
server relies on PM2 startup restore.
