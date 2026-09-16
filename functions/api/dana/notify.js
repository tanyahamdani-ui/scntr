// POST /api/dana/notify — DANA mengabari di sini begitu pembayaran selesai.
// Tanda tangannya diperiksa dulu; notifikasi palsu ditolak.
import { verifyNotification, json } from '../../../lib/dana.js';

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  const ok = await verifyNotification(
    env, 'POST', new URL(request.url).pathname, body,
    request.headers.get('X-TIMESTAMP'), request.headers.get('X-SIGNATURE'),
  );
  if (!ok) return json({ responseCode: '4015600', responseMessage: 'Unauthorized. Invalid signature' }, 401);

  let data = {};
  try { data = JSON.parse(body); } catch (e) { /* tetap dibalas sukses supaya DANA tidak mengulang */ }
  console.log('DANA notify', data.originalPartnerReferenceNo, data.latestTransactionStatus, data.amount && data.amount.value);
  return json({ responseCode: '2005600', responseMessage: 'Successful' });
}
