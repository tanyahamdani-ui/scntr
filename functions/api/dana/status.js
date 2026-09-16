// GET /api/dana/status?ref=... — cek apakah tagihan sudah dibayar.
import { isConfigured, call, json, PATHS, STATUS } from '../../../lib/dana.js';

export async function onRequestGet({ request, env }) {
  if (!isConfigured(env)) return json({ error: 'Pembayaran DANA belum diaktifkan' }, 503);
  const url = new URL(request.url);
  const ref = (url.searchParams.get('ref') || '').trim();
  if (!/^SCN[A-Z0-9]{6,22}$/.test(ref)) return json({ error: 'Nomor pesanan tidak valid' }, 400);

  let res;
  try {
    res = await call(env, url.origin, PATHS.queryPayment, {
      originalPartnerReferenceNo: ref,
      serviceCode: '54',
      merchantId: env.DANA_MERCHANT_ID,
    });
  } catch (e) { return json({ error: 'DANA tidak bisa dihubungi' }, 502); }

  if (!String(res.responseCode || '').startsWith('200')) {
    return json({ ref, status: 'unknown', code: res.responseCode, message: res.responseMessage });
  }
  return json({
    ref,
    status: STATUS[res.latestTransactionStatus] || 'unknown',
    amount: res.amount && res.amount.value ? Math.round(Number(res.amount.value)) : null,
  });
}
