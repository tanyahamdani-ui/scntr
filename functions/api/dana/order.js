// POST /api/dana/order — membuat tagihan DANA dan mengembalikan alamat halaman bayarnya.
// Body: { items: [{id, qty}], nama, hp }
import { isConfigured, computeOrder, newReference, jakartaTime, call, json, PATHS } from '../../../lib/dana.js';

export async function onRequestPost({ request, env }) {
  if (!isConfigured(env)) return json({ error: 'Pembayaran DANA belum diaktifkan' }, 503);

  let input;
  try { input = await request.json(); } catch (e) { return json({ error: 'Data pesanan tidak terbaca' }, 400); }

  let order;
  try { order = computeOrder(input.items); } catch (e) { return json({ error: e.message }, 400); }

  const site = new URL(request.url).origin;
  const ref = newReference();
  const count = order.lines.reduce((a, l) => a + l.qty, 0);
  const payload = {
    partnerReferenceNo: ref,
    merchantId: env.DANA_MERCHANT_ID,
    amount: { value: order.total.toFixed(2), currency: 'IDR' },
    externalStoreId: env.DANA_STORE_ID || '',
    validUpTo: jakartaTime(new Date(Date.now() + 60 * 60 * 1000)),
    urlParams: [
      { url: `${site}/?bayar=${ref}`, type: 'PAY_RETURN', isDeeplink: 'N' },
      { url: `${site}/api/dana/notify`, type: 'NOTIFICATION', isDeeplink: 'N' },
    ],
    additionalInfo: {
      mcc: env.DANA_MCC || '5977',
      envInfo: { sourcePlatform: 'IPG', terminalType: 'SYSTEM', orderTerminalType: 'WEB' },
      order: {
        orderTitle: `SCNTR · ${count} botol`,
        scenario: 'REDIRECT',
        buyer: {},
      },
    },
  };

  let res;
  try { res = await call(env, site, PATHS.createOrder, payload); }
  catch (e) { return json({ error: 'DANA tidak bisa dihubungi, coba lagi sebentar' }, 502); }

  if (!String(res.responseCode || '').startsWith('200') || !res.webRedirectUrl) {
    console.log('DANA createOrder gagal', res.responseCode, res.responseMessage);
    return json({ error: 'Tagihan DANA gagal dibuat', code: res.responseCode, message: res.responseMessage }, 502);
  }
  return json({ ref, total: order.total, redirectUrl: res.webRedirectUrl });
}
