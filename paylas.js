#!/usr/bin/env node
/**
 * paylas.js — Balsis otomatik Instagram / Facebook paylasimi
 *
 * Gorseller GitHub'da duruyor ve herkese acik HTTPS adresleri var,
 * o yuzden yukleme adimi yok. Script sadece Meta'ya "su adresteki
 * gorseli paylas" diyor.
 *
 *   node paylas.js sirada        plan.json'da zamani gelmis isi yapar
 *   node paylas.js test          token ve gorsel adreslerini kontrol eder
 *   node paylas.js story gun-03  belirli bir storyi hemen paylasir
 *   node paylas.js post  gun-03
 */

const fs = require('fs');
const path = require('path');

const KOK = __dirname;
const env = oku(path.join(KOK, '.env'));
const GV = env.GRAPH_VERSION || 'v21.0';

function oku(yol) {
  if (!fs.existsSync(yol)) {
    console.error(`.env bulunamadi: ${yol}\n.env.example dosyasini .env olarak kopyalayip doldurun.`);
    process.exit(1);
  }
  const o = {};
  for (const s of fs.readFileSync(yol, 'utf8').split('\n')) {
    const t = s.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) o[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return o;
}

function log(m) {
  const t = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  console.log(`[${t}] ${m}`);
  try { fs.appendFileSync(path.join(KOK, 'gunluk.log'), `[${t}] ${m}\n`); } catch (_) {}
}

async function cagir(yol, govde, yontem = 'POST', token) {
  const url = new URL(`https://graph.facebook.com/${GV}/${yol}`);
  const p = new URLSearchParams({ ...govde, access_token: token || env.IG_ACCESS_TOKEN });
  const ayar = { method: yontem };
  if (yontem === 'POST') ayar.body = p;
  else for (const [k, v] of p) url.searchParams.set(k, v);
  const c = await fetch(url, ayar);
  const j = await c.json();
  if (j.error) throw new Error(`${j.error.code}/${j.error.error_subcode || '-'} ${j.error.message}`);
  return j;
}

async function hazirBekle(id) {
  for (let i = 0; i < 20; i++) {
    const d = await cagir(id, { fields: 'status_code,status' }, 'GET');
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR') throw new Error(`Meta isleyemedi: ${d.status || ''}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error('Gorsel 60 sn icinde hazir olmadi');
}

async function instagram({ tip, gorsel, metin }) {
  const govde = { image_url: gorsel };
  if (tip === 'story') govde.media_type = 'STORIES';
  else if (metin) govde.caption = metin;
  const kap = await cagir(`${env.IG_USER_ID}/media`, govde);
  await hazirBekle(kap.id);
  return (await cagir(`${env.IG_USER_ID}/media_publish`, { creation_id: kap.id })).id;
}

async function facebook({ tip, gorsel, metin }) {
  if (!env.FB_PAGE_ID || !env.FB_PAGE_TOKEN) return null;
  const t = env.FB_PAGE_TOKEN;
  if (tip === 'story') {
    const f = await cagir(`${env.FB_PAGE_ID}/photos`, { url: gorsel, published: 'false' }, 'POST', t);
    const s = await cagir(`${env.FB_PAGE_ID}/photo_stories`, { photo_id: f.id }, 'POST', t);
    return s.post_id || s.id;
  }
  const s = await cagir(`${env.FB_PAGE_ID}/photos`,
    { url: gorsel, published: 'true', ...(metin ? { message: metin } : {}) }, 'POST', t);
  return s.post_id || s.id;
}

async function gorselAcilirMi(url) {
  const c = await fetch(url, { method: 'HEAD' });
  if (!c.ok) throw new Error(`Gorsel acilmadi (${c.status}): ${url}`);
  const tur = c.headers.get('content-type') || '';
  if (!tur.startsWith('image/')) throw new Error(`Gorsel degil (${tur}): ${url}`);
}

async function isYap(is) {
  log(`${is.tip.toUpperCase()} ${is.klasor}`);
  await gorselAcilirMi(is.gorsel);
  let ig = null, fb = null;
  try { ig = await instagram(is); log(`  instagram ok: ${ig}`); }
  catch (e) { log(`  instagram HATA: ${e.message}`); }
  try { fb = await facebook(is); if (fb) log(`  facebook ok: ${fb}`); }
  catch (e) { log(`  facebook HATA: ${e.message}`); }
  if (!ig && !fb) throw new Error('Hicbir platformda paylasilamadi');
  return { ig, fb };
}

async function main() {
  const [komut, arg] = process.argv.slice(2);
  const planYolu = path.join(KOK, 'plan.json');
  const plan = JSON.parse(fs.readFileSync(planYolu, 'utf8'));

  if (komut === 'test') {
    const me = await cagir(env.IG_USER_ID, { fields: 'username,media_count' }, 'GET');
    console.log(`Instagram ok — @${me.username} (${me.media_count} gonderi)`);
    if (env.FB_PAGE_ID && env.FB_PAGE_TOKEN) {
      try {
        const s = await cagir(env.FB_PAGE_ID, { fields: 'name' }, 'GET', env.FB_PAGE_TOKEN);
        console.log(`Facebook ok — ${s.name}`);
      } catch (e) { console.log(`Facebook HATA: ${e.message}`); }
    }
    let kotu = 0;
    for (const p of plan) { try { await gorselAcilirMi(p.gorsel); } catch (e) { kotu++; console.log('  ' + e.message); } }
    console.log(kotu ? `${kotu} gorsel acilmadi` : `${plan.length} gorselin hepsi aciliyor`);
    return;
  }

  if (komut === 'post' || komut === 'story') {
    const is = plan.find(p => p.tip === komut && p.klasor.includes(arg || ''));
    if (!is) throw new Error(`Bulunamadi: ${komut} ${arg}`);
    await isYap(is);
    return;
  }

  // sirada
  const simdi = new Date();
  const bugun = simdi.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
  const saat = simdi.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
  const is = plan.find(p => !p.yapildi && p.tarih === bugun && p.saat <= saat);
  if (!is) { log(`sirada is yok (${bugun} ${saat})`); return; }
  const s = await isYap(is);
  is.yapildi = new Date().toISOString();
  is.ig_id = s.ig; is.fb_id = s.fb;
  fs.writeFileSync(planYolu, JSON.stringify(plan, null, 2));
}

main().catch(e => { log(`HATA: ${e.message}`); process.exit(1); });
