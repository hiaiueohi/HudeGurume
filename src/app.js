const C = PostcardCore;
const $ = selector => document.querySelector(selector);
const KEY = 'atena-postcard-v1';
let state = {records: [], sender: {}, offsetX: 0, offsetY: 0};
let active = null;
let selected = new Set();
let importFile = null, pendingImport = [], importToken = 0;

function setStatus(message, error = false) {
  for (const node of [$('#status'), document.querySelector('dialog[open] .dialog-message')].filter(Boolean)) {
    node.textContent = message;
    node.hidden = !message;
    node.classList.toggle('error', error);
  }
}
function validate(s) {
  if (!s || !Array.isArray(s.records) || !s.sender || typeof s.sender !== 'object') throw Error('住所録データの形式が不正です');
  const fields = ['id', 'name', 'honorific', 'joint', 'zip', 'address', 'building'];
  const ids = new Set();
  for (const r of s.records) {
    if (!r || fields.some(k => r[k] !== undefined && typeof r[k] !== 'string') || !r.id || !r.name || !r.address || ids.has(r.id)) throw Error('住所録に不正な項目があります');
    ids.add(r.id);
  }
  for (const k of ['name', 'zip', 'address', 'building']) if (s.sender[k] !== undefined && typeof s.sender[k] !== 'string') throw Error('差出人が不正です');
  return {records: s.records, sender: s.sender, offsetX: Number.isFinite(s.offsetX) ? Math.max(-15, Math.min(15, s.offsetX)) : 0, offsetY: Number.isFinite(s.offsetY) ? Math.max(-15, Math.min(15, s.offsetY)) : 0};
}
try {
  const saved = localStorage.getItem(KEY);
  if (saved) state = validate(JSON.parse(saved));
} catch (error) {
  setStatus('保存データを読み込めませんでした。バックアップから復元してください。', true);
}
function commit(next, message) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    state = next;
    if (message) setStatus(message);
    return true;
  } catch (error) {
    setStatus('端末への保存に失敗しました。住所録の保存・復元からバックアップを保存してください。', true);
    return false;
  }
}
function values(form) { return Object.fromEntries(new FormData(form)); }
function fill(form, data) {
  form.reset();
  for (const [k, v] of Object.entries(data)) if (form.elements[k]) form.elements[k].value = v;
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function showDialog(id) {
  const dialog = $('#' + id);
  const message = dialog.querySelector('.dialog-message');
  if (message) message.hidden = true;
  dialog.showModal();
}
for (const button of document.querySelectorAll('[data-close]')) {
  button.onclick = () => $('#' + button.dataset.close).close();
}
function filteredRecords() {
  const query = $('#search').value.trim();
  return state.records.filter(r => [r.name, r.address, r.building, r.zip].join(' ').includes(query));
}
function updateSelection() {
  const count = state.records.filter(r => selected.has(r.id)).length;
  $('#selectionCount').textContent = '印刷対象 ' + count + '人';
  $('#printCount').textContent = count;
  $('#print').disabled = count === 0;
  $('#print').textContent = count ? '選択した ' + count + ' 人の宛名を印刷' : '印刷する人を選んでください';
  $('#clearSelection').disabled = count === 0;
  const visible = filteredRecords();
  const checked = visible.filter(r => selected.has(r.id)).length;
  $('#selectAll').checked = visible.length > 0 && checked === visible.length;
  $('#selectAll').indeterminate = checked > 0 && checked < visible.length;
  $('#selectAll').disabled = visible.length === 0;
  $('#selectAllLabel').textContent = $('#search').value.trim() ? '検索結果をすべて選択' : 'すべて選択';
  updatePreviewLabels();
}
function renderList() {
  const visible = filteredRecords();
  $('#list').replaceChildren();
  $('#totalCount').textContent = state.records.length + '人';
  $('#emptyState').hidden = state.records.length > 0;
  $('#noResults').hidden = !state.records.length || visible.length > 0;
  $('#visibleCount').textContent = visible.length + ' / ' + state.records.length + '人を表示 ・ この端末に保存';
  for (const r of visible) {
    const row = el('tr', 'entry' + (r.id === active ? ' active' : ''));
    const checkCell = el('td');
    const check = el('input');
    check.type = 'checkbox';
    check.checked = selected.has(r.id);
    check.setAttribute('aria-label', r.name + 'を印刷対象にする');
    check.onchange = () => { check.checked ? selected.add(r.id) : selected.delete(r.id); updateSelection(); };
    checkCell.append(check);
    const nameCell = el('td');
    const name = el('button', 'person-button', r.name);
    name.onclick = () => choose(r.id);
    if (r.id === active) name.setAttribute('aria-current', 'true');
    nameCell.append(name);
    if (r.joint) nameCell.append(el('span', 'name-caption', '連名あり'));
    const addressCell = el('td', 'row-address');
    addressCell.append(el('span', 'row-zip', r.zip ? '〒 ' + r.zip : '郵便番号未入力'), el('span', '', [r.address, r.building].filter(Boolean).join(' ')));
    const editCell = el('td');
    const edit = el('button', 'edit-button', '編集');
    edit.setAttribute('aria-label', r.name + 'の宛先を編集');
    edit.onclick = () => openEditor(r.id);
    editCell.append(edit);
    row.append(checkCell, nameCell, addressCell, editCell);
    $('#list').append(row);
  }
  updateSelection();
}
function choose(id) { active = id; renderList(); preview(); }
function openEditor(id = null) {
  const record = state.records.find(r => r.id === id);
  fill($('#recipient'), record || {honorific: '様'});
  $('#editorTitle').textContent = record ? '宛先を編集' : '1人ずつ追加';
  $('#editorHint').textContent = record ? '変更すると、住所録と宛名プレビューに反映されます。' : '保存すると、CSVで追加した宛先と同じ住所録に並びます。';
  $('#saveRecipient').textContent = record ? '変更を保存' : '住所録に追加';
  $('#delete').hidden = !record;
  showDialog('recipientDialog');
  $('#recipient').elements.name.focus();
}
function card(r) {
  const page = el('div', 'card'), content = el('div', 'content');
  content.style.setProperty('--x', state.offsetX + 'mm');
  content.style.setProperty('--y', state.offsetY + 'mm');
  page.append(content);
  const postal = el('div', 'postal');
  for (const digit of C.zipDigits(r.zip).padEnd(7, ' ').slice(0, 7)) postal.append(el('span', '', digit));
  content.append(postal);
  const address = el('div', 'address', C.verticalAddress(r.address));
  if ((r.address || '').length > 30) address.style.fontSize = '11pt';
  content.append(address, el('div', 'address building', C.verticalAddress(r.building)));
  const names = el('div', 'names');
  const people = [r.name, ...(r.joint || '').split(/\r?\n/).filter(s => s.trim())];
  for (const name of people) {
    const text = name.trim() + (r.honorific ? '　' + r.honorific : '');
    names.append(el('div', 'person' + (text.length > 13 || people.length > 2 ? ' small' : ''), text));
  }
  content.append(names);
  if ($('#newyear').checked) content.append(el('div', 'newyear', '年賀'));
  const s = state.sender, sender = el('div', 'sender');
  sender.append(el('div', '', C.verticalAddress(s.address)), el('div', '', C.verticalAddress(s.building)), el('div', 'sender-name', s.name || ''));
  content.append(sender, el('div', 'senderzip', s.zip ? '〒 ' + s.zip : ''));
  return page;
}
function updatePreviewLabels() {
  const r = state.records.find(r => r.id === active);
  $('#previewBadge').textContent = r ? (selected.has(r.id) ? '印刷対象' : '確認のみ') : '記入例';
  $('#previewCaption').textContent = r ? r.name + (r.honorific ? ' ' + r.honorific : '') : '宛先を追加すると、ここに表示されます。';
  $('#editActive').disabled = !r;
}
function preview() {
  const r = state.records.find(r => r.id === active) || {name: '山田 太郎', honorific: '様', zip: '1234567', address: '東京都千代田区丸の内1-2-3', building: 'サンプルマンション101号室'};
  $('#preview').replaceChildren(card(r));
  updatePreviewLabels();
}
$('#recipient').onsubmit = event => {
  event.preventDefault();
  const r = values(event.target);
  for (const k of Object.keys(r)) r[k] = r[k].trim();
  if (!r.name || !r.address) return setStatus('氏名と住所を入力してください。', true);
  if (r.zip && !C.validZip(r.zip)) return setStatus('郵便番号は7桁で入力してください。', true);
  const existing = state.records.find(x => x.id === r.id);
  r.id = r.id || crypto.randomUUID();
  const records = existing ? state.records.map(x => x.id === r.id ? r : x) : [...state.records, r];
  if (!commit({...state, records}, existing ? r.name + 'さんの宛先を更新しました。' : r.name + 'さんを住所録に追加しました。現在 ' + records.length + '人です。')) return;
  if (!existing) selected.add(r.id);
  $('#search').value = '';
  $('#recipientDialog').close();
  choose(r.id);
};
$('#add').onclick = () => openEditor();
$('#editActive').onclick = () => openEditor(active);
$('#search').oninput = renderList;
$('#selectAll').onchange = event => {
  for (const r of filteredRecords()) event.target.checked ? selected.add(r.id) : selected.delete(r.id);
  renderList();
};
$('#clearSelection').onclick = () => { selected.clear(); renderList(); };
$('#delete').onclick = () => {
  const id = $('#recipient').elements.id.value;
  const r = state.records.find(r => r.id === id);
  if (!r || !confirm(r.name + 'さんを住所録から削除しますか？')) return;
  if (!commit({...state, records: state.records.filter(r => r.id !== id)}, r.name + 'さんを削除しました。')) return;
  selected.delete(id);
  $('#recipientDialog').close();
  choose(active === id ? state.records[0]?.id || null : active);
};
$('#openSender').onclick = () => { fill($('#sender'), state.sender); showDialog('senderDialog'); };
$('#sender').onsubmit = event => {
  event.preventDefault();
  const sender = values(event.target);
  for (const k of Object.keys(sender)) sender[k] = sender[k].trim();
  if (sender.zip && !C.validZip(sender.zip)) return setStatus('差出人の郵便番号は7桁で入力してください。', true);
  if (!commit({...state, sender}, '差出人を保存しました。すべての宛名に反映されます。')) return;
  $('#senderDialog').close();
  updateSenderButton();
  preview();
};
function updateSenderButton() { $('#openSender').textContent = state.sender.name ? '差出人：' + state.sender.name : '差出人を設定'; }
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], {type})), a = el('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#export').onclick = () => { download('住所録.csv', C.toCSV(state.records), 'text/csv;charset=utf-8'); $('.data-menu').open = false; };
$('#backup').onclick = () => { download('宛名はがき-backup.json', JSON.stringify(state, null, 2), 'application/json'); $('.data-menu').open = false; };
$('#restoreButton').onclick = () => { $('.data-menu').open = false; $('#restore').click(); };
$('#sampleCSV').onclick = () => download('住所録の見本.csv', C.toCSV([{name:'山田 太郎', honorific:'様', joint:'', zip:'123-4567', address:'東京都千代田区丸の内1-2-3', building:'○○マンション101号室'}]), 'text/csv;charset=utf-8');
$('#openImport').onclick = () => {
  importToken++;
  importFile = null; pendingImport = [];
  $('#import').value = '';
  $('#csvEncoding').value = 'utf-8';
  $('#importFilename').textContent = 'ファイルはまだ選ばれていません';
  $('#applyImport').textContent = '住所録に追加する';
  $('#importReview').hidden = true; $('#applyImport').disabled = true;
  showDialog('importDialog');
};
$('#importDialog').addEventListener('close', () => {
  if (!$('#importDialog').open) { importToken++; pendingImport = []; }
});
$('#chooseCSV').onclick = () => $('#import').click();
async function readImport() {
  const token = ++importToken;
  pendingImport = [];
  $('#applyImport').textContent = '住所録に追加する';
  $('#applyImport').disabled = true;
  $('#importReview').hidden = true;
  if (!importFile) return;
  $('#importFilename').textContent = importFile.name;
  const message = $('#importDialog .dialog-message');
  message.hidden = true;
  try {
    const text = new TextDecoder($('#csvEncoding').value, {fatal:true}).decode(await importFile.arrayBuffer());
    const records = C.fromCSV(text);
    if (token !== importToken) return;
    if (!records.length) throw Error('追加できる宛先がありません。見出しの下に氏名・住所を入力してください。');
    pendingImport = records;
    $('#importBefore').textContent = state.records.length;
    $('#importAdded').textContent = records.length;
    $('#importAfter').textContent = state.records.length + records.length;
    $('#importPreview').replaceChildren();
    for (const r of records.slice(0, 5)) {
      const p = el('p', '', r.name + (r.honorific ? ' ' + r.honorific : ''));
      p.append(el('small', '', [r.zip, r.address, r.building].filter(Boolean).join(' ')));
      $('#importPreview').append(p);
    }
    if (records.length > 5) $('#importPreview').append(el('p', '', 'ほか ' + (records.length - 5) + '人'));
    $('#importReview').hidden = false;
    $('#applyImport').disabled = false;
    $('#applyImport').textContent = records.length + '人を住所録に追加';
  } catch (error) {
    if (token !== importToken) return;
    setStatus(error instanceof TypeError ? '文字コードが合いません。「文字コード」を変更してお試しください。' : error.message, true);
  }
}
$('#import').onchange = event => { if (event.target.files[0]) { importFile = event.target.files[0]; readImport(); } };
$('#csvEncoding').onchange = readImport;
$('#applyImport').onclick = () => {
  if (!pendingImport.length) return;
  const added = pendingImport.map(r => ({...r, id: crypto.randomUUID()}));
  const records = [...state.records, ...added];
  if (!commit({...state, records}, 'CSVから ' + added.length + '人を追加しました。個別登録の宛先と合わせて、住所録は ' + records.length + '人です。')) return;
  added.forEach(r => selected.add(r.id));
  $('#search').value = '';
  $('#importDialog').close();
  choose(added[0].id);
};
$('#restore').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    const data = validate(JSON.parse(await file.text()));
    if (!confirm('現在の住所録と差出人をバックアップの内容で置き換えますか？')) return;
    if (!commit(data, 'バックアップから ' + data.records.length + '人の住所録を復元しました。')) return;
    selected = new Set(state.records.map(r => r.id));
    $('#search').value = '';
    init();
  } catch (error) { setStatus('復元できません：' + error.message, true); }
  finally { event.target.value = ''; }
};
for (const key of ['offsetX', 'offsetY']) $('#' + key).oninput = event => {
  const value = Number(event.target.value);
  if (!event.target.value || !Number.isFinite(value) || Math.abs(value) > 15) return;
  if (commit({...state, [key]:value})) preview();
};
$('#newyear').onchange = preview;
$('#print').onclick = () => {
  const records = state.records.filter(r => selected.has(r.id));
  if (!records.length) return setStatus('印刷する宛先にチェックを付けてください。', true);
  const invalid = records.find(r => r.zip && !C.validZip(r.zip));
  if (invalid) return setStatus(invalid.name + 'さんの郵便番号を確認してください。', true);
  $('#printArea').replaceChildren(...records.map(card));
  window.print();
};
function init() {
  fill($('#sender'), state.sender);
  $('#offsetX').value = state.offsetX; $('#offsetY').value = state.offsetY;
  updateSenderButton();
  choose(state.records[0]?.id || null);
}
selected = new Set(state.records.map(r => r.id));
init();
