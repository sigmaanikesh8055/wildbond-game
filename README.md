# WILDBOND Online Service Starter

This folder is a deployable backend starting point, not a live hosted service. It provides email/password account endpoints, JWT sessions, WebSocket presence and position updates, matchmaking queue pairing, and database-transaction creature-trade ownership swaps.

## Run locally

1. Install Node.js 20+ and PostgreSQL 15+.
2. Create a database and run `psql "$DATABASE_URL" -f schema.sql`.
3. Copy `.env.example` to `.env`; set `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, and `CLIENT_ORIGIN`.
4. Run `npm install`, then `npm start`.
5. Check `GET /health`.

## HTTP API

- `POST /auth/register` — `{ username, email, password }`; password is hashed with bcrypt.
- `POST /auth/login` — `{ email, password }`; returns a short-lived signed bearer token.
- `GET /me` — bearer token required.
- `GET /leaderboard` — public ratings list.
- `GET /health` — service health.

## WebSocket

Connect to `/` with `?token=<JWT>`. Messages use JSON `{ type, ... }`. Supported message types: `player:move`, `match:queue`, `match:cancel`, `match:action`, `trade:request`, `trade:accept`, and `trade:cancel`. Creature trades lock the trade and both creature rows in a SQL transaction, re-check ownership, and swap both owners atomically.

## Critical limitations before public launch

- The current game client is not yet wired to these HTTP/WebSocket endpoints. Local saves and local trading remain the active in-game systems.
- Matchmaking currently pairs queued sockets and relays bounded action intents; it does **not** run an authoritative battle simulation. Do not award ranked wins or ratings from client-reported results. Implement the server-side battle state machine, cooldown validation, hit validation, disconnect/reconnect handling, anti-cheat checks and result persistence before enabling ranked PvP.
- Add email verification, password reset, rate limiting, account deletion/export, moderation/reporting, abuse monitoring, backups, TLS, origin allow-listing and operational alerting before public launch.
- Never commit `.env`, production credentials or database backups.
- For a real launch, use a managed PostgreSQL service and a persistent Node host; static hosting alone cannot run this service.

This separation is deliberate: a WebSocket relay alone is not secure competitive multiplayer.
