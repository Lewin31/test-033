import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const socialState = {
  onlineCount: 0,
  chatMessages: []
};

const sseClients = new Set();

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function broadcast(event, payload) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) client.write(chunk);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 100_000) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const pathname = req.url?.split('?')[0] || '/';

  if (req.method === 'GET' && pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    socialState.onlineCount += 1;
    sseClients.add(res);

    res.write(`event: snapshot\ndata: ${JSON.stringify({
      onlineCount: socialState.onlineCount,
      chatMessages: socialState.chatMessages.slice(-20)
    })}\n\n`);
    broadcast('presence', { onlineCount: socialState.onlineCount });

    req.on('close', () => {
      sseClients.delete(res);
      socialState.onlineCount = Math.max(0, socialState.onlineCount - 1);
      broadcast('presence', { onlineCount: socialState.onlineCount });
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/chat') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw || '{}');
      const text = String(payload.text || '').trim().slice(0, 180);
      const author = String(payload.author || 'Игрок').trim().slice(0, 30) || 'Игрок';

      if (!text) {
        sendJson(res, 400, { error: 'Message is empty' });
        return;
      }

      const message = {
        id: crypto.randomUUID(),
        author,
        text,
        createdAt: new Date().toISOString()
      };

      socialState.chatMessages = [...socialState.chatMessages.slice(-19), message];
      broadcast('chat_message', { message });
      sendJson(res, 200, { ok: true });
    } catch {
      sendJson(res, 400, { error: 'Bad request' });
    }
    return;
  }

  const urlPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(urlPath).replace(/^\/+/, '');
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Life Sim listening on http://localhost:${port}`);
});
