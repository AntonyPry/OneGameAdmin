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
