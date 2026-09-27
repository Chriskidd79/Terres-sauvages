// Serveur relais WebSocket pour Terres Sauvages.
// Il ne fait qu'une chose : renvoyer à tout le monde dans le même
// "salon" (room) les messages de position et de chat qu'il reçoit.
// Aucune donnée de jeu n'est stockée ni comprise ici.

const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// Le fichier du jeu doit être dans le même dossier que server.js,
// nommé exactement "terres-sauvages.html".
const GAME_FILE = path.join(__dirname, 'terres-sauvages.html');
let gameHtml = null;
try { gameHtml = fs.readFileSync(GAME_FILE); } catch (e) { console.log('terres-sauvages.html introuvable, le serveur ne servira que le relais.'); }

const server = http.createServer((req, res) => {
  if (gameHtml && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(gameHtml);
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Terres Sauvages — serveur relais OK');
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // roomCode -> Set<ws>

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const roomCode = (url.searchParams.get('room') || 'lobby').slice(0, 24);
  ws.roomCode = roomCode;
  ws.id = Math.random().toString(36).slice(2, 10);

  if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
  const room = rooms.get(roomCode);
  room.add(ws);

  ws.send(JSON.stringify({ type: 'welcome', id: ws.id }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
    if (msg.type !== 'presence' && msg.type !== 'chat') return;
    msg.id = ws.id;
    const payload = JSON.stringify(msg);
    for (const peer of room) {
      if (peer !== ws && peer.readyState === peer.OPEN) peer.send(payload);
    }
  });

  ws.on('close', () => {
    room.delete(ws);
    if (room.size === 0) rooms.delete(roomCode);
    const payload = JSON.stringify({ type: 'leave', id: ws.id });
    for (const peer of room) if (peer.readyState === peer.OPEN) peer.send(payload);
  });
});

server.listen(PORT, () => console.log('Relais Terres Sauvages en écoute sur le port ' + PORT));
