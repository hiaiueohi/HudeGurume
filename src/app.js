const C = PostcardCore;
const $ = selector => document.querySelector(selector);
const KEY = 'atena-postcard-v1';
const nativeStorage = window.addressBookStorage;
let storageReady = !nativeStorage, storageInfo = null;
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
  return C.validateState(s);
}
try {
  let saved = null, legacyUnavailable = false;
  try { saved = localStorage.getItem(KEY); } catch (error) { legacyUnavailable = true; }
  if (nativeStorage) {
    const result = nativeStorage.load(saved, legacyUnavailable);
    storageInfo = result.info;
    if (!result.ok) throw Error(result.error);
    state = validate(result.state);
    storageReady = true;
    if (result.migrated) setStatus('これまでの住所録を、ドキュメント内の「宛名はがき」フォルダーへ移行しました。');
  } else {
    if (legacyUnavailable) throw Error('ブラウザー内の保存領域を読み込めません。');
    if (saved) state = validate(JSON.parse(saved));
  }
} catch (error) {
  setStatus('住所録を読み込めませんでした。' + error.message + ' 保存先を確認するか、バックアップから復元してください。', true);
}
function commit(next, message, {recover = false} = {}) {
  try {
    next = validate(next);
    if (nativeStorage) {
      if (!storageReady && !recover) throw Error('読み込みに失敗しているため、上書きを停止しています。バックアップから復元してください。');
      const result = recover ? nativeStorage.restore(next) : nativeStorage.save(next);
      if (!result.ok) throw Error(result.error);
      storageInfo = result.info;
      state = validate(result.state);
      storageReady = true;
    } else {
      localStorage.setItem(KEY, JSON.stringify(next));
      state = next;
    }
    updateStorageLabel();
    if (message) setStatus(message);
    return true;
  } catch (error) {
    setStatus('住所録を保存できませんでした。' + error.message, true);
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
  $('#visibleCount').textContent = visible.length + ' / ' + state.records.length + '人を表示 ・ 変更を自動保存';
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
  return FrontRenderer.card(r,state,$('#newyear').checked);
}
function openFrontLayoutEditor(){
  const record=state.records.find(r=>r.id===active);if(!record)return;
  const sender=record.senderOverride||state.sender;
  const content={...record,senderName:sender.name||'',senderAddress:sender.address||'',senderBuilding:sender.building||'',senderZip:sender.zip||'',yearLabel:record.yearLabel??'年賀'};
  const makeRecord=text=>({...record,name:text.name,honorific:text.honorific,joint:text.joint,zip:text.zip,address:text.address,building:text.building,yearLabel:text.yearLabel,senderOverride:{name:text.senderName,address:text.senderAddress,building:text.senderBuilding,zip:text.senderZip}});
  DesignLayoutEditor.open({model:FrontLayout,item:{id:record.id,name:record.name+'さんの宛名面'},layout:state.frontLayout,content,
    oneLabel:'この宛先だけ',allLabel:'住所録の全員',
    textNote:'氏名・住所・差出人の文字はこの宛先だけに保存します。全員の差出人は画面上部で設定できます。',
    oneHint:'配置・文字の向き・大きさを、この宛先だけに適用します。',allHint:'変更した項目の配置・文字の向き・大きさを、全員に適用します。宛先の文字は各人のままです。',
    fields:key=>({names:[{key:'name',label:'宛先の氏名',maxLength:80},{key:'honorific',label:'敬称',maxLength:10},{key:'joint',label:'連名（1行に1名）',rows:3,maxLength:240}],address:[{key:'address',label:'住所',rows:3}],building:[{key:'building',label:'建物名・部屋番号',rows:2}],postal:[{key:'zip',label:'郵便番号',maxLength:10}],sender:[{key:'senderName',label:'差出人の氏名',maxLength:80},{key:'senderAddress',label:'差出人の住所',rows:3},{key:'senderBuilding',label:'差出人の建物名',rows:2}],senderzip:[{key:'senderZip',label:'差出人の郵便番号',maxLength:10}],newyear:[{key:'yearLabel',label:'表示する文字',maxLength:20}]})[key]||[],
    render:(layout,text)=>FrontRenderer.card(makeRecord(text),{...state,frontLayout:layout},$('#newyear').checked),
    applyPositions:(page,layout,text)=>FrontRenderer.applyPositions(page,makeRecord(text),{...state,frontLayout:layout}),
    onApply:(frontLayout,scope,text)=>{
      const r=makeRecord(text);r.name=r.name.trim();r.address=r.address.trim();
      if(!r.name||!r.address)return {ok:false,error:'宛先の氏名と住所を入力してください。'};
      if((r.zip&&!C.validZip(r.zip))||(r.senderOverride.zip&&!C.validZip(r.senderOverride.zip)))return {ok:false,error:'郵便番号は7桁で入力してください。'};
      // Preserve inheritance from the common sender until this recipient's sender is actually edited.
      if(['name','address','building','zip'].every(k=>r.senderOverride[k]===(sender[k]||''))&&!record.senderOverride)delete r.senderOverride;
      if(!commit({...state,frontLayout,records:state.records.map(x=>x.id===record.id?r:x)},scope==='all'?'変更した配置と文字の書式を全員に適用しました。':'この宛先の編集内容を保存しました。'))return {ok:false,error:'保存できませんでした。住所録の保存先を確認してください。'};
      renderList();preview();return {ok:true};
    }
  });
}
function updatePreviewLabels() {
  const r = state.records.find(r => r.id === active);
  $('#previewBadge').textContent = r ? (selected.has(r.id) ? '印刷対象' : '確認のみ') : '記入例';
  $('#previewCaption').textContent = r ? r.name + (r.honorific ? ' ' + r.honorific : '') : '宛先を追加すると、ここに表示されます。';
  $('#editActive').disabled = !r;
  $('#openFrontLayoutEditor').disabled=!r;
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
  const records = existing ? state.records.map(x => x.id === r.id ? {...x,...r} : x) : [...state.records, r];
  if (!commit({...state, records}, existing ? r.name + 'さんの宛先を更新しました。' : r.name + 'さんを住所録に追加しました。現在 ' + records.length + '人です。')) return;
  if (!existing) selected.add(r.id);
  $('#search').value = '';
  $('#recipientDialog').close();
  choose(r.id);
};
$('#add').onclick = () => openEditor();
$('#editActive').onclick = () => openEditor(active);
$('#openFrontLayoutEditor').onclick=$('#preview').onclick=openFrontLayoutEditor;
$('#preview').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openFrontLayoutEditor();}};
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
function updateSenderButton() { $('#openSender').textContent = state.sender.name ? '差出人：' + state.sender.name : '差出人を設定'; window.PostcardDesignApp?.refresh(); }
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
    if (!commit(data, 'バックアップから ' + data.records.length + '人の住所録を復元しました。', {recover:true})) return;
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
$('#print').onclick = async () => {
  const records = state.records.filter(r => selected.has(r.id));
  if (!records.length) return setStatus('印刷する宛先にチェックを付けてください。', true);
  const invalid = records.find(r => r.zip && !C.validZip(r.zip));
  if (invalid) return setStatus(invalid.name + 'さんの郵便番号を確認してください。', true);
  $('#printArea').replaceChildren(...records.map(card));
  await PostcardPrinting.open({side:'宛名面（おもて）',count:records.length});
};
function init() {
  fill($('#sender'), state.sender);
  $('#offsetX').value = state.offsetX; $('#offsetY').value = state.offsetY;
  updateSenderButton();
  updateStorageLabel();
  choose(state.records[0]?.id || null);
}
function updateStorageLabel() {
  $('#storageLocation').textContent = nativeStorage ? (storageReady ? 'ドキュメント / 宛名はがき（自動保存）' : 'ドキュメント / 宛名はがき（読み込み・保存を確認してください）') : 'ブラウザー内（ドキュメントに保存する場合は「起動.cmd」から開いてください）';
  $('#storageLocation').title = storageInfo?.filePath || '';
  $('#openStorageFolder').hidden = !nativeStorage;
}
$('#openStorageFolder').onclick = async () => {
  try {
    const result = await nativeStorage.openFolder();
    if (!result.ok) throw Error(result.error);
  } catch (error) { setStatus('保存先フォルダーを開けませんでした。' + error.message, true); }
};
selected = new Set(state.records.map(r => r.id));
init();
window.PostcardDesignApp.init({getSender:()=>state.sender});
window.PostcardPrinting.init();
