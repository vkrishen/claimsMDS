
document.getElementById('ocrBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('receipt');
  const ocrKey = document.getElementById('ocrKey').value || 'helloworld';
  if (!fileInput.files.length) return alert('Please select an image');
  const file = fileInput.files[0];
  const form = new FormData();
  form.append('file', file);
  form.append('language', 'eng');
  form.append('apikey', ocrKey);
  const res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
  const data = await res.json();
  const text = data?.ParsedResults?.[0]?.ParsedText;
  alert('OCR Text:\n' + text);
});
