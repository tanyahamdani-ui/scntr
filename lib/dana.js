// Klien kecil untuk API Payment Gateway DANA (Gapura), dipakai oleh Cloudflare Pages
// Functions di folder functions/api/dana. Pakai WebCrypto, jadi tidak butuh node:crypto.
//
// Skema tanda tangan mengikuti SDK resmi dana-id/dana-node:
//   string yang ditandatangani = METHOD:PATH:sha256hex(body):X-TIMESTAMP
//   ditandatangani RSA-SHA256 (PKCS#1 v1.5) dengan private key merchant, hasilnya base64.
//
// Variabel lingkungan (diisi di Cloudflare Pages → Settings → Variables and Secrets):
//   DANA_ENV            "sandbox" atau "production" (bawaan: sandbox)
//   DANA_PARTNER_ID     Client ID / X-PARTNER-ID dari portal DANA
//   DANA_MERCHANT_ID    Merchant ID dari portal DANA
//   DANA_PRIVATE_KEY    isi file private key (PEM), disimpan sebagai Secret
//   DANA_PUBLIC_KEY     public key DANA untuk memeriksa notifikasi (wajib di production)
//   DANA_STORE_ID       External Store ID (opsional, dibutuhkan supaya QRIS muncul)
//   DANA_MCC            kode kategori usaha (bawaan: 5977, toko kosmetik & parfum)

// Harga harus sama dengan VARIANTS di index.html. Total dihitung ulang di server,
// jadi harga yang dikirim browser tidak pernah dipercaya.
export const PRICES = {
  fresh: 99000, clean: 99000, bold: 99000, velour: 99000,
  fresh100: 199000, clean100: 199000, bold100: 199000, velour100: 199000,
};
export const SHIP = 15000;
export const FREE_MIN = 198000;

const BASE = { sandbox: 'https://api.sandbox.dana.id', production: 'https://api.saas.dana.id' };

// Public key DANA untuk notifikasi di sandbox, diambil dari SDK resmi.
const SANDBOX_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnaKVGRbin4Wh4KN35OPh
ytJBjYTz7QZKSZjmHfiHxFmulfT87rta+IvGJ0rCBgg+1EtKk1hX8G5gPGJs1htJ
5jHa3/jCk9l+luzjnuT9UVlwJahvzmFw+IoDoM7hIPjsLtnIe04SgYo0tZBpEmkQ
vUGhmHPqYnUGSSMIpDLJDvbyr8gtwluja1SbRphgDCoYVXq+uUJ5HzPS049aaxTS
nfXh/qXuDoB9EzCrgppLDS2ubmk21+dr7WaO/3RFjnwx5ouv6w+iC1XOJKar3CTk
X6JV1OSST1C9sbPGzMHZ8AGB51BM0mok7davD/5irUk+f0C25OgzkwtxAt80dkDo
/QIDAQAB
-----END PUBLIC KEY-----`;

export function danaEnv(env) {
  return String(env.DANA_ENV || 'sandbox').trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
}

export function isConfigured(env) {
  return !!(env.DANA_PARTNER_ID && env.DANA_MERCHANT_ID && env.DANA_PRIVATE_KEY);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Waktu Jakarta dalam format yang diminta DANA: 2026-09-17T10:00:00+07:00
export function jakartaTime(date = new Date()) {
  const t = new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 19);
  return t + '+07:00';
}

export function computeOrder(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Keranjang kosong');
  const lines = [];
  let subtotal = 0;
  for (const it of items) {
    const price = PRICES[it && it.id];
    const qty = Math.floor(Number(it && it.qty));
    if (!price) throw new Error('Produk tidak dikenal: ' + (it && it.id));
    if (!(qty >= 1 && qty <= 100)) throw new Error('Jumlah tidak valid');
    lines.push({ id: it.id, qty, price });
    subtotal += price * qty;
  }
  const total = subtotal + (subtotal >= FREE_MIN ? 0 : SHIP);
  return { lines, subtotal, total };
}

export function newReference() {
  // Maksimal 25 karakter supaya QRIS tetap bisa dipakai.
  const rand = crypto.getRandomValues(new Uint8Array(4));
  return 'SCN' + Date.now().toString(36).toUpperCase() + [...rand].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ---------- kunci & tanda tangan ----------

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function pemBody(pem) {
  return String(pem).replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
}

// Bungkus kunci PKCS#1 ("BEGIN RSA PRIVATE KEY") jadi PKCS#8, karena WebCrypto hanya menerima PKCS#8.
function pkcs1ToPkcs8(der) {
  const len = n => n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...len(der.length)];
  const inner = [0x02, 0x01, 0x00, ...algo, ...octet];
  const seq = [0x30, ...len(inner.length + der.length)];
  const out = new Uint8Array(seq.length + inner.length + der.length);
  out.set(seq, 0); out.set(inner, seq.length); out.set(der, seq.length + inner.length);
  return out;
}

const keyCache = new Map();
async function privateKey(pem) {
  if (keyCache.has(pem)) return keyCache.get(pem);
  let der = unb64(pemBody(pem));
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) der = pkcs1ToPkcs8(der);
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  keyCache.set(pem, key);
  return key;
}

async function publicKey(pem) {
  return crypto.subtle.importKey('spki', unb64(pemBody(pem)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
}

export async function sign(method, path, body, timestamp, pem) {
  const text = `${method}:${path}:${await sha256Hex(body)}:${timestamp}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await privateKey(pem), enc.encode(text));
  return b64(sig);
}

// Periksa tanda tangan notifikasi dari DANA. Body dicoba apa adanya dan dalam bentuk
// JSON yang diringkas, sama seperti yang dilakukan SDK resmi.
export async function verifyNotification(env, method, path, body, timestamp, signature) {
  if (!timestamp || !signature) return false;
  const pem = danaEnv(env) === 'sandbox' ? SANDBOX_PUBLIC_KEY : env.DANA_PUBLIC_KEY;
  if (!pem) return false;
  const key = await publicKey(pem);
  const forms = new Set([body]);
  try { forms.add(JSON.stringify(JSON.parse(body))); } catch (e) { /* bukan JSON */ }
  for (const form of forms) {
    const text = `${method.toUpperCase()}:${path}:${await sha256Hex(form)}:${timestamp}`;
    try {
      if (await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64(signature), enc.encode(text))) return true;
    } catch (e) { /* tanda tangan rusak */ }
  }
  return false;
}

// ---------- panggilan API ----------

export async function call(env, origin, path, payload) {
  const body = JSON.stringify(payload);
  const timestamp = jakartaTime();
  const partner = env.DANA_PARTNER_ID;
  const headers = {
    'Content-Type': 'application/json',
    'X-TIMESTAMP': timestamp,
    'X-SIGNATURE': await sign('POST', path, body, timestamp, env.DANA_PRIVATE_KEY),
    'ORIGIN': origin,
    'X-PARTNER-ID': partner,
    'X-EXTERNAL-ID': crypto.randomUUID().replace(/-/g, ''),
    'CHANNEL-ID': partner + '-SERVER',
  };
  if (String(env.DANA_DEBUG || '') === 'true') headers['X-Debug-Mode'] = 'true';
  const res = await fetch(BASE[danaEnv(env)] + path, { method: 'POST', headers, body });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { responseCode: String(res.status), responseMessage: text.slice(0, 300) }; }
  return data;
}

export const PATHS = {
  createOrder: '/payment-gateway/v1.0/debit/payment-host-to-host.htm',
  queryPayment: '/payment-gateway/v1.0/debit/status.htm',
};

export const STATUS = {
  '00': 'paid', '01': 'pending', '02': 'processing', '05': 'cancelled', '07': 'not_found',
};
