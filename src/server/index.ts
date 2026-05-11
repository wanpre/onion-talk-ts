import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { initDb, createOrJoinRoom, getRoomPasswordHash } from './db.js';
import { sanitizeInput, validateRoomName, type Client, type Message, type WSWebSocket } from './types.js';
import crypto from 'node:crypto';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const db = initDb();
const rateLimiter = new RateLimiterMemory({ points: 10, duration: 1 });

const clients = new Map<WSWebSocket, Client>();
const roomUsers = new Map<string, number>();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('dist/public'));

// 创建房间
app.post('/create-room', async (req, res) => {
  try {
    await rateLimiter.consume(req.ip!);
    const { name, password } = req.body;
    if (!validateRoomName(name) || !password) {
      return res.status(400).json({ error: 'Invalid room name or password' });
    }
    const success = await createOrJoinRoom(sanitizeInput(name), password);
    res.status(success ? 201 : 200).json({ success });
  } catch (e) {
    res.status(429).json({ error: 'Too many requests' });
  }
});

// 加入房间
app.post('/join-room', async (req, res) => {
  try {
    await rateLimiter.consume(req.ip!);
    const { name, password } = req.body;
    if (!validateRoomName(name) || !password) {
      return res.status(400).json({ error: 'Invalid room name or password' });
    }
    const storedHash = getRoomPasswordHash(sanitizeInput(name));
    if (!storedHash) return res.status(404).json({ error: 'Room not found' });

    const hash = crypto.pbkdf2Sync(password, name, 10000, 64, 'sha512').toString('hex');
    res.status(storedHash === hash ? 200 : 401).json({ success: storedHash === hash });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// WebSocket 处理
wss.on('connection', (ws: WSWebSocket) => {
  const client: Client = { ws, username: '', room: '' };
  clients.set(ws, client);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as Message;
      msg.username = sanitizeInput(msg.username);
      msg.room = sanitizeInput(msg.room);

      if (!validateRoomName(msg.room)) return;

      if (msg.type === 'join') {
        if (client.room) {
          decrementRoomUsers(client.room);
        }
        client.username = msg.username;
        client.room = msg.room;
        incrementRoomUsers(msg.room);
      } else if (msg.type === 'typing' || msg.type === 'message') {
        broadcast(msg);
      }
    } catch (e) {
      // 忽略无效消息
    }
  });

  ws.on('close', () => {
    const c = clients.get(ws);
    if (c?.room) decrementRoomUsers(c.room);
    clients.delete(ws);
  });
});

function incrementRoomUsers(room: string) {
  roomUsers.set(room, (roomUsers.get(room) || 0) + 1);
}

function decrementRoomUsers(room: string) {
  const count = (roomUsers.get(room) || 0) - 1;
  if (count <= 0) {
    roomUsers.delete(room);
    const stmt = db.prepare('DELETE FROM rooms WHERE name = ?');
    stmt.run(room);
  } else {
    roomUsers.set(room, count);
  }
}

function broadcast(msg: Message) {
  for (const [ws, client] of clients) {
    if (client.room === msg.room && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

server.listen(8080, () => {
  console.log('OnionTalk-TS server running on http://localhost:8080');
});
