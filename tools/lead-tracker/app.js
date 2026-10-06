const STATUS_LABELS = {
  new: 'Baru',
  reviewed: 'Ditinjau',
  replied: 'Sudah dibalas manual',
  interested: 'Tertarik / klik',
  ordered: 'Memesan',
  no_response: 'Tidak ada respons',
  dismissed: 'Tidak relevan',
};
const NEXT = {
  new: ['reviewed', 'dismissed'],
  reviewed: ['replied', 'no_response', 'dismissed'],
  replied: ['interested', 'no_response', 'dismissed'],
  interested: ['ordered', 'no_response', 'dismissed'],
  ordered: [],
  no_response: ['reviewed', 'dismissed'],
  dismissed: [],
};
const $ = selector => document.querySelector(selector);
const metrics = $('#metrics');
const list = $('#lead-list');
let leads = [];

async function request(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Permintaan gagal.');
  return body;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak valid' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderMetrics() {
  const cards = [
    ['Total lead', leads.length],
    ['Baru', count('new')],
    ['Ditinjau', count('reviewed')],
    ['Dibalas manual', count('replied')],
    ['Tertarik / klik', count('interested')],
    ['Memesan', count('ordered')],
    ['Tidak ada respons', count('no_response')],
    ['Tidak relevan', count('dismissed')],
  ];
  metrics.replaceChildren(...cards.map(([label, value]) => {
    const card = element('div', 'metric');
    card.append(element('span', '', label), element('strong', '', String(value)));
    return card;
  }));
}

function count(status) {
  return leads.filter(lead => lead.status === status).length;
}

function filteredLeads() {
  const status = $('#filter-status').value;
  const source = $('#filter-source').value;
  const query = $('#filter-text').value.trim().toLowerCase();
  return leads.filter(lead =>
    (!status || lead.status === status) &&
    (!source || lead.source === source) &&
    (!query || `${lead.context} ${lead.url}`.toLowerCase().includes(query)));
}

function transitionSelect(lead) {
  const select = element('select');
  select.setAttribute('aria-label', `Ubah status lead dari ${lead.status}`);
  const current = element('option', '', STATUS_LABELS[lead.status] || lead.status);
  current.value = '';
  current.selected = true;
  select.append(current);
  for (const status of NEXT[lead.status] || []) {
    const option = element('option', '', `→ ${STATUS_LABELS[status]}`);
    option.value = status;
    select.append(option);
  }
  select.addEventListener('change', async () => {
    if (!select.value) return;
    select.disabled = true;
    try {
      const { lead: updated } = await request(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH', body: JSON.stringify({ status: select.value }),
      });
      replaceLead(updated);
      render();
    } catch (error) {
      select.disabled = false;
      announce(error.message, true);
    }
  });
  return select;
}

function leadCard(lead) {
  const card = element('article', 'lead');
  const head = element('div', 'lead-head');
  const heading = element('div');
  heading.append(element('h3', '', lead.source));
  const meta = element('div', 'meta');
  meta.append(element('span', '', `Dicatat ${formatDate(lead.createdAt)}`), element('span', 'pill', STATUS_LABELS[lead.status] || lead.status));
  heading.append(meta);
  const url = element('a', '', lead.url);
  url.href = lead.url;
  url.target = '_blank';
  url.rel = 'noopener noreferrer';
  head.append(heading, url);
  card.append(head, element('p', 'context', lead.context));

  const actions = element('div', 'lead-actions');
  actions.append(transitionSelect(lead));
  const notes = element('textarea');
  notes.maxLength = 2000;
  notes.value = lead.notes || '';
  notes.placeholder = 'Catatan hasil, minat, atau follow-up manual';
  notes.setAttribute('aria-label', 'Catatan outcome');
  const save = element('button', 'btn secondary note-save', 'Simpan catatan');
  save.type = 'button';
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const { lead: updated } = await request(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: 'PATCH', body: JSON.stringify({ notes: notes.value }),
      });
      replaceLead(updated);
      announce('Catatan tersimpan.');
    } catch (error) {
      announce(error.message, true);
    } finally {
      save.disabled = false;
    }
  });
  actions.append(notes, save);
  card.append(actions);
  return card;
}

function render() {
  renderMetrics();
  const visible = filteredLeads();
  if (!visible.length) {
    const empty = element('div', 'empty');
    empty.append(element('strong', '', leads.length ? 'Tidak ada lead yang cocok' : 'Belum ada lead'));
    empty.append(document.createTextNode(leads.length ? 'Ubah filter untuk melihat lead lain.' : 'Tambahkan URL posting publik yang berisi pertanyaan relevan.'));
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...visible.map(leadCard));
}

function replaceLead(updated) {
  leads = leads.map(lead => lead.id === updated.id ? updated : lead);
}

function announce(message, error = false) {
  const output = $('#form-message');
  output.textContent = message;
  output.classList.toggle('error', error);
}

async function refresh() {
  try {
    const { leads: items } = await request('/api/leads');
    leads = items;
    const filter = $('#filter-status');
    const selected = filter.value;
    filter.replaceChildren(new Option('Semua status', ''));
    for (const [key, label] of Object.entries(STATUS_LABELS)) filter.add(new Option(label, key));
    filter.value = selected;
    render();
  } catch (error) {
    list.replaceChildren(element('div', 'empty', `Gagal memuat data: ${error.message}`));
  }
}

$('#lead-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  announce('');
  try {
    const { lead } = await request('/api/leads', {
      method: 'POST',
      body: JSON.stringify({
        source: $('#source').value,
        url: $('#url').value,
        context: $('#context').value,
      }),
    });
    leads.unshift(lead);
    event.currentTarget.reset();
    announce('Lead tersimpan di perangkat ini.');
    render();
  } catch (error) {
    announce(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$('#filter-status').addEventListener('change', render);
$('#filter-source').addEventListener('change', render);
$('#filter-text').addEventListener('input', render);
refresh();
