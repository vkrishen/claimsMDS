/* QuickClaims: minimal client-side expense logger (no server) */
(function() {
  const el = id => document.getElementById(id);

  const monthLabel = el('monthLabel');
  const statCount = el('statCount');
  const statTotal = el('statTotal');
  const statUnlinked = el('statUnlinked');
  const list = el('list');

  const dateInput = el('date');
  const amountInput = el('amount');
  const merchantInput = el('merchant');
  const categoryInput = el('category');
  const noteInput = el('note');
  const receiptInput = el('receipt');

  const addBtn = el('addBtn');
  const scanBtn = el('scanBtn');
  const exportCsvBtn = el('exportCsvBtn');
  const exportZipBtn = el('exportZipBtn');
  const clearMonthBtn = el('clearMonthBtn');

  const prevMonthBtn = el('prevMonthBtn');
  const thisMonthBtn = el('thisMonthBtn');
  const nextMonthBtn = el('nextMonthBtn');

  let current = new Date();
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    installBtn.style.display = 'inline-block';
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBtn.style.display = 'none';
      }
    });
  });

  // Helpers
  function ymKey(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
  function getStoreKey() { return 'quickclaims-' + ymKey(current); }
  function formatCurrency(n) { return (Math.round(n*100)/100).toFixed(2); }
  function monthName(d) {
    return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  function readEntries() {
    const raw = localStorage.getItem(getStoreKey());
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  }
  function saveEntries(items) {
    localStorage.setItem(getStoreKey(), JSON.stringify(items));
  }

  function refresh() {
    monthLabel.textContent = monthName(current);
    const items = readEntries();
    list.innerHTML = '';
    let total = 0, unlinked = 0;

    items.forEach((x, i) => {
      total += Number(x.amount || 0);
      if (!x.imageDataUrl) unlinked++;

      const div = document.createElement('div');
      div.className = 'receipt';
      div.innerHTML = `
        <div class="grid" style="flex:1">
          <div>
            <div><strong>${x.merchant || '(no merchant)'}</strong></div>
            <div class="muted">${x.date || ''} • <span class="pill">${x.category || 'Other'}</span></div>
            <div class="muted">${x.note ? x.note : ''}</div>
            ${x.imageName ? `<div class="muted">Image: ${x.imageName}</div>` : ''}
          </div>
          <div class="right"><strong>${formatCurrency(Number(x.amount||0))}</strong></div>
        </div>
        ${x.imageDataUrl ? `<img src="${x.imageDataUrl}" alt="receipt">` : '<div class="muted">No image</div>'}
      `;
      // actions per row
      const actions = document.createElement('div');
      actions.style = 'display:flex; gap:6px;';
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.onclick = () => {
        const items = readEntries();
        items.splice(i,1);
        saveEntries(items);
        refresh();
      };
      const linkBtn = document.createElement('button');
      linkBtn.textContent = 'Replace Image';
      linkBtn.onclick = async () => {
        const file = await pickImage();
        if (!file) return;
        const dataUrl = await fileToDataURL(file);
        const items = readEntries();
        items[i].imageDataUrl = dataUrl;
        items[i].imageName = file.name;
        saveEntries(items);
        refresh();
      };
      actions.appendChild(delBtn);
      actions.appendChild(linkBtn);
      div.appendChild(actions);
      list.appendChild(div);
    });

    statCount.textContent = String(items.length);
    statTotal.textContent = formatCurrency(total);
    statUnlinked.textContent = String(unlinked);
  }

  function pickImage() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Add Receipt
  addBtn.addEventListener('click', async () => {
    const date = dateInput.value || new Date().toISOString().slice(0,10);
    const amount = amountInput.value;
    const merchant = merchantInput.value.trim();
    const category = categoryInput.value;
    const note = noteInput.value.trim();

    let imageDataUrl = null, imageName=null;
    if (receiptInput.files && receiptInput.files[0]) {
      imageName = receiptInput.files[0].name;
      imageDataUrl = await fileToDataURL(receiptInput.files[0]);
    }

    const items = readEntries();
    items.push({ date, amount, merchant, category, note, imageDataUrl, imageName });
    saveEntries(items);
    dateInput.value = '';
    amountInput.value = '';
    merchantInput.value = '';
    noteInput.value = '';
    receiptInput.value = '';
    refresh();
  });

  scanBtn.addEventListener('click', async () => {
    const f = await pickImage();
    if (!f) return;
    receiptInput.files = new DataTransfer().files; // no-op, UX only
    const dataUrl = await fileToDataURL(f);
    const date = dateInput.value || new Date().toISOString().slice(0,10);
    const amount = amountInput.value;
    const merchant = merchantInput.value.trim();
    const category = categoryInput.value;
    const note = noteInput.value.trim();

    const items = readEntries();
    items.push({ date, amount, merchant, category, note, imageDataUrl: dataUrl, imageName: f.name });
    saveEntries(items);
    refresh();
  });

  // Export CSV
  function toCSV(items) {
    const header = ['Date','Merchant','Amount','Category','Notes','ReceiptLink'];
    const lines = [header.join(',')];
    items.forEach(x => {
      const link = x.imageName ? ('receipts/' + x.imageName) : '';
      const row = [
        (x.date||''),
        csvEscape(x.merchant||''),
        (x.amount||''),
        csvEscape(x.category||''),
        csvEscape(x.note||''),
        csvEscape(link)
      ].join(',');
      lines.push(row);
    });
    return lines.join('\n');
  }
  function csvEscape(v) {
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g,'""') + '"';
    }
    return s;
  }

  exportCsvBtn.addEventListener('click', () => {
    const items = readEntries();
    const csv = toCSV(items);
    downloadText(csv, 'claims.csv');
  });

  // Export ZIP with images + CSV
  exportZipBtn.addEventListener('click', async () => {
    const items = readEntries();
    const zip = new JSZip();
    const folder = zip.folder('receipts');
    const csv = toCSV(items);
    zip.file('claims.csv', csv);
    // images
    for (const x of items) {
      if (x.imageDataUrl && x.imageName) {
        const base64 = x.imageDataUrl.split(',')[1] || '';
        folder.file(x.imageName, base64, { base64: true });
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `claims_${ymKey(current)}.zip`);
  });

  clearMonthBtn.addEventListener('click', () => {
    if (!confirm('This will permanently remove all entries for this month. Continue?')) return;
    localStorage.removeItem(getStoreKey());
    refresh();
  });

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, filename);
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Month navigation
  function shiftMonth(delta) {
    current.setMonth(current.getMonth() + delta);
    refresh();
  }
  prevMonthBtn.addEventListener('click', () => shiftMonth(-1));
  thisMonthBtn.addEventListener('click', () => { current = new Date(); refresh(); });
  nextMonthBtn.addEventListener('click', () => shiftMonth(1));

  // Init defaults
  (function init() {
    const now = new Date();
    document.getElementById('date').value = now.toISOString().slice(0,10);
    refresh();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(()=>{});
    }
  })();
})();
