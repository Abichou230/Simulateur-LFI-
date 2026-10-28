// Serveur du simulateur LFI : sert la page web, calcule impôt et retraite,
// compte les simulations de façon anonyme. Aucune donnée personnelle n'est enregistrée.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || ''; // mot de passe pour voir les statistiques
const CONFIG_PATH = path.join(__dirname, 'config', 'bareme.json');
const STATS_PATH = path.join(__dirname, 'data', 'stats.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// La configuration est relue à chaque demande : modifier bareme.json suffit, sans redémarrer.
function loadConfig() { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }

// ---------- Calculs ----------
function taxPerPart(x, brackets) {
  let t = 0;
  for (let i = 0; i < brackets.length; i++) {
    const lo = brackets[i].seuil;
    const hi = i + 1 < brackets.length ? brackets[i + 1].seuil : Infinity;
    if (x > lo) t += (Math.min(x, hi) - lo) * brackets[i].taux;
  }
  return t;
}
const taxFoyer = (rev, parts, b) => taxPerPart(rev / parts, b) * parts;
const scale = (b, c) => b.map(t => ({ seuil: t.seuil * c, taux: t.taux }));

function num(v, min, max, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

// ---------- Statistiques anonymes ----------
function readStats() {
  try { return JSON.parse(fs.readFileSync(STATS_PATH, 'utf8')); }
  catch { return { impot: 0, retraite: 0, depuis: new Date().toISOString() }; }
}
let stats = readStats();
let dirty = false;
function count(kind) { stats[kind] = (stats[kind] || 0) + 1; dirty = true; }
setInterval(() => {
  if (!dirty) return;
  try { fs.mkdirSync(path.dirname(STATS_PATH), { recursive: true }); fs.writeFileSync(STATS_PATH, JSON.stringify(stats)); dirty = false; }
  catch (e) { console.error('Écriture des statistiques impossible :', e.message); }
}, 30000);

// ---------- Serveur ----------
const hits = new Map(); // limitation : 120 demandes par minute et par adresse
setInterval(() => hits.clear(), 60 * 1000);
function tooMany(req) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const n = (hits.get(ip) || 0) + 1; hits.set(ip, n); return n > 120;
}
function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10000) { reject(new Error('trop gros')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON invalide')); } });
    req.on('error', reject);
  });
}

function apiImpot(body) {
  const c = loadConfig();
  const rev = num(body.revenu, 0, 10000000, 0);
  const parts = num(body.parts, 1, 10, 1);
  const coef = num(body.coefficient, 0.5, 2, c.impot.coefficient_revalorisation_defaut);
  const cur = c.impot.actuel, lfi = scale(c.impot.lfi_reference_2022, coef);
  const impotActuel = taxFoyer(rev, parts, cur), impotLfi = taxFoyer(rev, parts, lfi);
  const xmax = Math.max(120000, Math.ceil((rev * 1.2) / 20000) * 20000), N = 120, courbe = [];
  for (let i = 0; i <= N; i++) { const x = (xmax * i) / N; courbe.push([x, taxFoyer(x, parts, cur), taxFoyer(x, parts, lfi)]); }
  const parPart = rev / parts;
  const detail = b => b.map((t, i) => {
    const lo = t.seuil, hi = i + 1 < b.length ? b[i + 1].seuil : null;
    return { de: lo, a: hi, taux: t.taux, impot: parPart > lo ? (Math.min(parPart, hi === null ? Infinity : hi) - lo) * t.taux : 0, actif: parPart > lo && (hi === null || parPart <= hi) };
  });
  count('impot');
  return { impotActuel, impotLfi, ecart: impotLfi - impotActuel, courbe, xmax, detailActuel: detail(cur), detailLfi: detail(lfi) };
}

function apiRetraite(b) {
  const c = loadConfig().retraite;
  const naissance = num(b.naissance, 1950, 2010, 1975);
  const debut = num(b.debut, 14, 35, 22);
  const trou = num(b.trou, 0, 30, 0);
  const tpa = num(b.trimestresParAn, 1, 4, 4);
  const auto = num(b.tauxPleinAuto, 60, 75, c.age_taux_plein_automatique);
  const sc = (nom, o) => {
    const legal = num(o && o.legal, 55, 70, 64), trim = num(o && o.trimestres, 100, 200, 172);
    const age = Math.min(Math.max(legal, debut + trou + trim / tpa), auto);
    return { nom, ageLegal: legal, trimestres: trim, age, annee: Math.round(naissance + age) };
  };
  count('retraite');
  return { scenarios: [
    sc('Règle actuelle', b.actuelle || { legal: c.actuelle.age_legal, trimestres: c.actuelle.trimestres }),
    sc('Objectif LFI', b.lfi || { legal: c.lfi.age_legal, trimestres: c.lfi.trimestres }),
    sc('Étape LFI intermédiaire', b.etape || { legal: c.lfi_etape.age_legal, trimestres: c.lfi_etape.trimestres })
  ] };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/sante') return send(res, 200, 'ok', 'text/plain');
    if (url.pathname.startsWith('/api/')) {
      if (tooMany(req)) return send(res, 429, { erreur: 'Trop de demandes, réessayez dans une minute.' });
      if (req.method === 'GET' && url.pathname === '/api/config') {
        const c = loadConfig();
        return send(res, 200, { version: c.version, avertissement: c.avertissement, coefficient: c.impot.coefficient_revalorisation_defaut, retraite: c.retraite });
      }
      if (req.method === 'POST' && url.pathname === '/api/impot') return send(res, 200, apiImpot(await readBody(req)));
      if (req.method === 'POST' && url.pathname === '/api/retraite') return send(res, 200, apiRetraite(await readBody(req)));
      if (req.method === 'GET' && url.pathname === '/api/stats') {
        if (!ADMIN_KEY || url.searchParams.get('cle') !== ADMIN_KEY) return send(res, 403, { erreur: 'Accès refusé' });
        return send(res, 200, stats);
      }
      return send(res, 404, { erreur: 'Introuvable' });
    }
    // Fichiers de la page web
    let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, 'Interdit', 'text/plain');
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, 'Page introuvable', 'text/plain');
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  } catch (e) {
    send(res, 400, { erreur: e.message });
  }
});
server.listen(PORT, () => console.log('Simulateur LFI prêt sur le port ' + PORT));
