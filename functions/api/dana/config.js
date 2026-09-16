// GET /api/dana/config — memberi tahu halaman apakah pembayaran DANA sudah aktif.
import { isConfigured, danaEnv, json } from '../../../lib/dana.js';

export function onRequestGet({ env }) {
  return json({ enabled: isConfigured(env), env: danaEnv(env) });
}
