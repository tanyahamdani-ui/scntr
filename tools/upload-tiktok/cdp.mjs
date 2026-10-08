// Helper CDP langsung ke Chrome :9222 — bypass extension bridge
const PORT = 9222;
const base = `http://127.0.0.1:${PORT}`;

export async function targets() {
  const r = await fetch(`${base}/json/list`);
  return r.json();
}

export async function newTarget(url) {
  const r = await fetch(`${base}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return r.json();
}

export async function closeTarget(id) {
  await fetch(`${base}/json/close/${id}`, { method: 'PUT' });
}

export class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; 
    ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) this.events.push(m);
    });
  }
  static async attach(targetId) {
    const r = await fetch(`${base}/json/list`);
    const list = await r.json();
    const t = list.find(x => x.id === targetId) || list.find(x => x.type === 'page');
    if (!t) throw new Error('target not found');
    const ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws); c.target = t; return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)); } }, 30000);
    });
  }
  close() { try { this.ws.close(); } catch {} }
}

export async function evalJs(cdp, expression, awaitPromise = true) {
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception));
  return r.result.value;
}
