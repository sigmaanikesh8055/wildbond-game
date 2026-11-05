import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';

const { Pool } = pg;
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing ${key}; copy .env.example to .env and configure it.`);
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined });
const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? false }));
app.use(express.json({ limit: '32kb' }));
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
const online = new Map();
const queues = new Map();
const matches = new Map();
const sign = user => jwt.sign({ sub: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '7d', issuer: 'wildbond-online' });
const authHeader = req => { const raw = req.headers.authorization ?? ''; return raw.startsWith('Bearer ') ? raw.slice(7) : ''; };
function userFromToken(token) { return jwt.verify(token, process.env.JWT_SECRET, { issuer: 'wildbond-online' }); }
const registerSchema = z.object({ username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/), email: z.string().trim().email().max(254), password: z.string().min(10).max(72) });
app.get('/health', (_req, res) => res.json({ ok: true, online: online.size, queued: queues.size }));
app.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Use a 3–20 character username, valid email and password of at least 10 characters.' });
  try {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const { rows } = await pool.query('INSERT INTO accounts(username,email,password_hash) VALUES($1,$2,$3) RETURNING id,username', [parsed.data.username, parsed.data.email.toLowerCase(), hash]);
    await pool.query('INSERT INTO ratings(account_id) VALUES($1)', [rows[0].id]);
    return res.status(201).json({ token: sign(rows[0]), player: { id: rows[0].id, username: rows[0].username } });
  } catch (e) { return res.status(409).json({ error: 'Username or email is already registered.' }); }
});
app.post('/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password || password.length > 72) return res.status(400).json({ error: 'Invalid login details.' });
  const { rows } = await pool.query('SELECT id,username,password_hash FROM accounts WHERE email=$1', [email]);
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: sign(rows[0]), player: { id: rows[0].id, username: rows[0].username } });
});
app.get('/me', async (req, res) => {
  try { const claims = userFromToken(authHeader(req)); const { rows } = await pool.query('SELECT a.id,a.username,COALESCE(r.rating,1000) rating,COALESCE(r.wins,0) wins,COALESCE(r.losses,0) losses FROM accounts a LEFT JOIN ratings r ON r.account_id=a.id WHERE a.id=$1', [claims.sub]); if (!rows[0]) return res.sendStatus(404); res.json(rows[0]); }
  catch { res.sendStatus(401); }
});
app.get('/leaderboard', async (_req, res) => { const { rows } = await pool.query('SELECT a.username,r.rating,r.wins,r.losses FROM ratings r JOIN accounts a ON a.id=r.account_id ORDER BY r.rating DESC LIMIT 50'); res.json(rows); });

server.on('upgrade', (req, socket, head) => {
  try { const url = new URL(req.url, 'http://localhost'); const token = url.searchParams.get('token') ?? ''; const claims = userFromToken(token); req.player = { id: claims.sub, username: claims.username }; wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req)); }
  catch { socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); }
});
function send(ws, type, payload = {}) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, ...payload })); }
function broadcast(type, payload, except) { for (const [id, client] of online) if (id !== except) send(client.ws, type, payload); }
wss.on('connection', (ws, req) => {
  const player = req.player; const old = online.get(player.id); if (old) old.ws.close(4001, 'New session opened');
  const record = { ws, player, x: 0, z: 0, yaw: 0, area: 'Embervale', lastMove: 0, hasPosition: false }; online.set(player.id, record);
  send(ws, 'world:welcome', { player, players: [...online.values()].filter(x => x.player.id !== player.id).map(({ player:p,x,z,yaw,area }) => ({ player:p,x,z,yaw,area })) });
  broadcast('player:joined', { player }, player.id);
  ws.on('message', async raw => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return send(ws, 'error', { message: 'Invalid message.' }); }
    if (msg.type === 'player:move') {
      const now = Date.now(); if (now - record.lastMove < 45) return;
      const x = Number(msg.x), z = Number(msg.z), yaw = Number(msg.yaw); const area = typeof msg.area === 'string' ? msg.area.slice(0,40) : 'Embervale';
      if (![x,z,yaw].every(Number.isFinite) || Math.abs(x)>10000 || Math.abs(z)>10000) return;
      if (record.hasPosition) { const elapsed = Math.max(45, now - record.lastMove) / 1000; const distance = Math.hypot(x-record.x,z-record.z); if (distance > Math.max(0.9, elapsed * 28)) return send(ws,'error',{message:'Movement update rejected by server speed check.'}); }
      record.x=x; record.z=z; record.yaw=yaw; record.area=area; record.lastMove=now; record.hasPosition=true; broadcast('player:moved', { player, x,z,yaw,area }, player.id);
    } else if (msg.type === 'match:queue') {
      const mode = msg.mode === 'ranked' ? 'ranked' : 'casual'; queues.set(player.id, { ws, player, mode, at: Date.now() });
      const rival = [...queues.values()].find(q => q.player.id !== player.id && q.mode === mode);
      if (rival) { queues.delete(player.id); queues.delete(rival.player.id); const matchId = randomUUID(); matches.set(matchId,new Set([player.id,rival.player.id])); send(ws,'match:found',{matchId,opponent:rival.player}); send(rival.ws,'match:found',{matchId,opponent:player}); }
      else send(ws,'match:queued',{mode});
    } else if (msg.type === 'match:cancel') { queues.delete(player.id); send(ws,'match:cancelled'); }
    else if (msg.type === 'match:action' && typeof msg.matchId === 'string' && typeof msg.action === 'string') {
      // This relays bounded input intent only. The authoritative battle simulator must validate damage, cooldowns and results server-side before ranked launch.
      const participants=matches.get(msg.matchId); if(!participants?.has(player.id)) return send(ws,'error',{message:'You are not in this match.'});
      for(const id of participants) if(id!==player.id){const peer=online.get(id);if(peer)send(peer.ws,'match:action',{matchId:msg.matchId,from:player.id,action:msg.action.slice(0,40)});}
    } else if (msg.type === 'trade:accept') {
      const tradeId = typeof msg.tradeId === 'string' ? msg.tradeId : '';
      if (!z.string().uuid().safeParse(tradeId).success) return send(ws,'error',{message:'Invalid trade id.'});
      const tx = await pool.connect();
      try {
        await tx.query('BEGIN');
        const { rows } = await tx.query('SELECT * FROM trades WHERE id=$1 FOR UPDATE',[tradeId]);
        const trade = rows[0];
        if (!trade || trade.to_account !== player.id || trade.status !== 'pending' || new Date(trade.expires_at).getTime() < Date.now()) throw new Error('Trade is not available to this player.');
        const { rows: locked } = await tx.query('SELECT id,owner_id FROM creatures WHERE id = ANY($1::uuid[]) FOR UPDATE',[ [trade.offered_creature,trade.requested_creature] ]);
        if (locked.length !== 2) throw new Error('A creature no longer exists.');
        const ownerById = new Map(locked.map(c=>[c.id,c.owner_id]));
        if (ownerById.get(trade.offered_creature) !== trade.from_account || ownerById.get(trade.requested_creature) !== trade.to_account) throw new Error('Creature ownership changed.');
        await tx.query('UPDATE creatures SET owner_id=$1 WHERE id=$2',[trade.to_account,trade.offered_creature]);
        await tx.query('UPDATE creatures SET owner_id=$1 WHERE id=$2',[trade.from_account,trade.requested_creature]);
        await tx.query("UPDATE trades SET status='accepted' WHERE id=$1",[tradeId]);
        await tx.query('COMMIT');
        send(ws,'trade:completed',{tradeId}); const sender=online.get(trade.from_account); if(sender)send(sender.ws,'trade:completed',{tradeId});
      } catch(e) { await tx.query('ROLLBACK'); send(ws,'error',{message:e.message==='Trade is not available to this player.'?e.message:'Trade could not be completed; ownership was not changed.'}); }
      finally { tx.release(); }
    } else if (msg.type === 'trade:cancel') {
      const tradeId = typeof msg.tradeId === 'string' ? msg.tradeId : '';
      if (!z.string().uuid().safeParse(tradeId).success) return send(ws,'error',{message:'Invalid trade id.'});
      const { rowCount } = await pool.query("UPDATE trades SET status='cancelled' WHERE id=$1 AND from_account=$2 AND status='pending'",[tradeId,player.id]);
      send(ws,rowCount?'trade:cancelled':'error',rowCount?{tradeId}:{message:'Trade cannot be cancelled.'});
    } else if (msg.type === 'trade:request') {
      const schema = z.object({ toPlayerId:z.string().uuid(), offeredCreatureId:z.string().uuid(), requestedCreatureId:z.string().uuid() }).safeParse(msg);
      if (!schema.success || schema.data.toPlayerId === player.id) return send(ws,'error',{message:'Invalid trade request.'});
      try {
        const tx = await pool.connect(); try { await tx.query('BEGIN');
          const {rows: target}=await tx.query('SELECT id FROM accounts WHERE id=$1',[schema.data.toPlayerId]);
          const {rows: offered}=await tx.query('SELECT id FROM creatures WHERE id=$1 AND owner_id=$2 FOR UPDATE',[schema.data.offeredCreatureId,player.id]);
          const {rows: requested}=await tx.query('SELECT id FROM creatures WHERE id=$1 AND owner_id=$2 FOR UPDATE',[schema.data.requestedCreatureId,schema.data.toPlayerId]);
          if(!target[0]||!offered[0]||!requested[0]) throw new Error('Trade ownership validation failed.');
          const {rows:trade}=await tx.query('INSERT INTO trades(from_account,to_account,offered_creature,requested_creature) VALUES($1,$2,$3,$4) RETURNING id',[player.id,schema.data.toPlayerId,schema.data.offeredCreatureId,schema.data.requestedCreatureId]);
          await tx.query('COMMIT'); const peer=online.get(schema.data.toPlayerId); if(peer) send(peer.ws,'trade:offer',{tradeId:trade[0].id,from:player}); send(ws,'trade:created',{tradeId:trade[0].id});
        } catch(e){await tx.query('ROLLBACK');throw e;} finally{tx.release();}
      } catch { send(ws,'error',{message:'Could not create trade. Check both creature owners and try again.'}); }
    }
  });
  ws.on('close', () => { if (online.get(player.id)?.ws === ws) { online.delete(player.id); queues.delete(player.id); for(const [id,ids] of matches){if(ids.has(player.id)){for(const peerId of ids)if(peerId!==player.id){const peer=online.get(peerId);if(peer)send(peer.ws,'match:opponent-disconnected',{matchId:id});}matches.delete(id);}} broadcast('player:left',{player},player.id); } });
});
const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => console.log(`WILDBOND online service listening on ${port}`));
