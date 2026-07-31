#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

const ROOT = __dirname;
const PORT = Math.max(1024, Math.min(65535, Number(process.env.PORT || process.argv[2] || 8080)));
const HOST = '0.0.0.0';
const MAX_MESSAGE = 1024 * 1024;
const clients = new Map();
let hostSocket = null;
let nextId = 1;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

function lanAddresses() {
  const list = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family === 'IPv4' && !item.internal) list.push(`http://${item.address}:${PORT}`);
    }
  }
  return [...new Set(list)];
}

function safePath(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  if (decoded === '/') decoded = '/index.html';
  const resolved = path.resolve(ROOT, `.${decoded}`);
  return resolved.startsWith(ROOT + path.sep) || resolved === ROOT ? resolved : null;
}

function sendJsonHttp(res, code, value) {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  if (route === '/favicon.ico') { res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' }); res.end(); return; }
  if (route === '/ws') {
    sendJsonHttp(res, 426, { error: 'WebSocket upgrade required', hint: 'Open this endpoint with WebSocket, not an ordinary HTTP request.' });
    return;
  }
  if (route === '/_lan/info') {
    sendJsonHttp(res, 200, { port: PORT, addresses: lanAddresses(), players: clients.size, hasHost: Boolean(hostSocket) });
    return;
  }
  const filePath = safePath(req.url || '/');
  if (!filePath) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': path.extname(filePath) === '.html' ? 'no-store' : 'public, max-age=3600',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

function acceptKey(key) {
  return crypto.createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}

function encodeFrame(text, opcode = 0x1) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2); header[1] = payload.length;
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, payload]);
}

function socketSend(socket, value) {
  if (!socket || socket.destroyed || !socket.writable) return;
  try { socket.write(encodeFrame(JSON.stringify(value))); } catch { /* disconnected */ }
}

function closeSocket(socket, code = 1000, reason = '') {
  if (!socket || socket.destroyed) return;
  const reasonBuf = Buffer.from(reason.slice(0, 120));
  const payload = Buffer.alloc(2 + reasonBuf.length);
  payload.writeUInt16BE(code, 0); reasonBuf.copy(payload, 2);
  try { socket.write(Buffer.concat([Buffer.from([0x88, payload.length]), payload])); } catch { /* ignored */ }
  socket.end();
}

function publicPeer(meta) { return { id: meta.id, name: meta.name, role: meta.role }; }

function routeMessage(socket, message) {
  const meta = clients.get(socket);
  if (!meta || !message || typeof message.type !== 'string') return;
  const now = Date.now();
  if (now - meta.rateWindow > 1000) { meta.rateWindow = now; meta.rateCount = 0; }
  if (++meta.rateCount > 240) { closeSocket(socket, 1008, 'Rate limit'); return; }

  if (message.type === 'hello') {
    if (meta.ready) return;
    const role = message.role === 'host' ? 'host' : 'client';
    const name = String(message.name || `玩家${meta.id}`).trim().slice(0, 20) || `玩家${meta.id}`;
    if (role === 'host') {
      if (hostSocket && hostSocket !== socket) {
        socketSend(socket, { type: 'error', code: 'HOST_EXISTS', message: '此服务已经有一个主机房间。' });
        return;
      }
      hostSocket = socket;
      Object.assign(meta, { ready: true, role, name });
      socketSend(socket, { type: 'roleAccepted', id: meta.id, role, peers: [...clients.values()].filter(p => p.ready && p.role === 'client').map(publicPeer) });
      console.log(`[LAN] 主机浏览器已连接：${name} (${meta.id})`);
    } else {
      if (!hostSocket || !clients.get(hostSocket)?.ready) {
        socketSend(socket, { type: 'error', code: 'NO_HOST', message: '尚未有人创建房间，请先让主机点击“创建房间”。' });
        return;
      }
      Object.assign(meta, { ready: true, role, name });
      socketSend(socket, { type: 'roleAccepted', id: meta.id, role });
      socketSend(hostSocket, { type: 'peerJoin', peer: publicPeer(meta) });
      console.log(`[LAN] 客户端加入：${name} (${meta.id})`);
    }
    return;
  }

  if (!meta.ready) return;
  if (message.type === 'ping') { socketSend(socket, { type: 'pong', time: message.time || Date.now() }); return; }

  const packet = { ...message, from: meta.id, fromName: meta.name };
  delete packet.to;
  delete packet.broadcast;

  if (meta.role === 'host') {
    if (typeof message.to === 'string') {
      const target = [...clients.entries()].find(([, info]) => info.id === message.to && info.ready)?.[0];
      if (target) socketSend(target, packet);
    } else if (message.broadcast) {
      for (const [peerSocket, peer] of clients) {
        if (peerSocket !== socket && peer.ready && peer.role === 'client') socketSend(peerSocket, packet);
      }
    }
  } else if (hostSocket) {
    socketSend(hostSocket, packet);
  }
}

function parseFrames(socket, chunk) {
  const meta = clients.get(socket);
  if (!meta) return;
  meta.buffer = Buffer.concat([meta.buffer, chunk]);
  while (meta.buffer.length >= 2) {
    const b0 = meta.buffer[0], b1 = meta.buffer[1];
    const fin = Boolean(b0 & 0x80), opcode = b0 & 0x0f, masked = Boolean(b1 & 0x80);
    let length = b1 & 0x7f, offset = 2;
    if (!fin) { closeSocket(socket, 1003, 'Fragmentation unsupported'); return; }
    if (length === 126) {
      if (meta.buffer.length < 4) return;
      length = meta.buffer.readUInt16BE(2); offset = 4;
    } else if (length === 127) {
      if (meta.buffer.length < 10) return;
      const long = meta.buffer.readBigUInt64BE(2);
      if (long > BigInt(MAX_MESSAGE)) { closeSocket(socket, 1009, 'Message too large'); return; }
      length = Number(long); offset = 10;
    }
    if (length > MAX_MESSAGE) { closeSocket(socket, 1009, 'Message too large'); return; }
    const maskLength = masked ? 4 : 0;
    if (meta.buffer.length < offset + maskLength + length) return;
    let payload;
    if (masked) {
      const mask = meta.buffer.subarray(offset, offset + 4); offset += 4;
      payload = Buffer.from(meta.buffer.subarray(offset, offset + length));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    } else payload = meta.buffer.subarray(offset, offset + length);
    meta.buffer = meta.buffer.subarray(offset + length);

    if (opcode === 0x8) { closeSocket(socket); return; }
    if (opcode === 0x9) { try { socket.write(encodeFrame(payload.toString(), 0xA)); } catch {} continue; }
    if (opcode !== 0x1) continue;
    try { routeMessage(socket, JSON.parse(payload.toString('utf8'))); } catch { socketSend(socket, { type: 'error', code: 'BAD_JSON', message: '收到无法解析的数据。' }); }
  }
}

function disconnect(socket) {
  const meta = clients.get(socket);
  if (!meta) return;
  clients.delete(socket);
  if (socket === hostSocket) {
    hostSocket = null;
    for (const [peerSocket, peer] of clients) {
      if (peer.ready) {
        socketSend(peerSocket, { type: 'hostClosed', message: '主机已离开房间。' });
        setTimeout(() => closeSocket(peerSocket, 1012, 'Host closed'), 80);
      }
    }
    console.log('[LAN] 主机离开，房间已关闭。');
  } else if (meta.ready && hostSocket) {
    socketSend(hostSocket, { type: 'peerLeave', peer: publicPeer(meta) });
    console.log(`[LAN] 客户端离开：${meta.name} (${meta.id})`);
  }
}

server.on('upgrade', (req, socket, head) => {
  if ((req.url || '').split('?')[0] !== '/ws' || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
    socket.destroy(); return;
  }
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write([
    'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey(key)}`, '\r\n'
  ].join('\r\n'));
  const id = `p${nextId++}`;
  clients.set(socket, { id, name: `玩家${id.slice(1)}`, role: 'pending', ready: false, buffer: Buffer.alloc(0), rateWindow: Date.now(), rateCount: 0 });
  socket.setNoDelay(true);
  socket.on('data', chunk => parseFrames(socket, chunk));
  socket.on('close', () => disconnect(socket));
  socket.on('end', () => disconnect(socket));
  socket.on('error', () => disconnect(socket));
  socketSend(socket, { type: 'serverHello', id, protocol: 1 });
  if (head && head.length) parseFrames(socket, head);
});

server.on('error', error => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`\n[错误] 端口 ${PORT} 已被占用。`);
    console.error('请关闭先前启动的 Python http.server / 旧服务窗口，或运行：node lan-server.js 9000');
  } else console.error('[LAN 服务错误]', error);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const addresses = lanAddresses();
  console.log('');
  console.log('============================================================');
  console.log(' Voxel Survival 局域网轻量服务已启动');
  console.log(` 主机打开：http://localhost:${PORT}`);
  if (addresses.length) {
    console.log(' 把下面任一地址发给同一局域网内的朋友：');
    for (const address of addresses) console.log(`   ${address}`);
  } else console.log(' 未检测到局域网 IPv4 地址，请检查网络连接。');
  console.log(' 保持此窗口开启；按 Ctrl+C 关闭服务。');
  console.log('============================================================');
  console.log('');
  const url = `http://localhost:${PORT}`;
  const command = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(command, () => {});
});
