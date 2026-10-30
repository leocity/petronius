// Minimal static server for local development: `/` redirects to the game.
// Serves only web/, data/ and tools/ (not the private print files or the APK that sit in this folder).
// Listens on this computer only; add --lan to open it to your network (to try the game on a phone: use https or
// localhost-forwarding for GPS, plain http on a LAN address has no geolocation).
// Usage: node tools/serve.mjs [port] [--lan]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const LAN = args.includes('--lan');
const PORT = Number(args.find((a) => /^\d+$/.test(a)) ?? process.env.PORT ?? 5173);
const PUBLIC = ['web', 'data', 'tools'].map((d) => path.join(ROOT, d));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};
const inside = (dir, file) => { const r = path.relative(dir, file); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };

http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('Bad request'); }
  if (url === '/') { res.writeHead(302, { Location: '/web/' }); return res.end(); }
  let file = path.join(ROOT, url);
  if (!PUBLIC.some((dir) => inside(dir, file))) { res.writeHead(404); return res.end('Not found'); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, LAN ? undefined : '127.0.0.1', () => console.log(`Petronius dev server: http://localhost:${PORT}/${LAN ? '  (open to the network)' : ''}`));
