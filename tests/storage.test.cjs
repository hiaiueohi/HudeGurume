const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {createAddressBookStore} = require('../address-book-store.cjs');
const base = () => ({records:[{id:'one', name:'テスト 太郎', address:'東京都千代田区1-2', zip:'123-4567', honorific:'様'}], sender:{name:'差出人 花子'}, offsetX:1, offsetY:-2});
const folder = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'atena-store-test-')), 'Documents', '宛名はがき');
test('migrate the entire legacy address book and reopen the file without duplicates', () => {
  const store = createAddressBookStore(folder());
  const legacy = JSON.stringify(base());
  const result = store.load(legacy);
  assert.equal(result.migrated, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(store.info.filePath, 'utf8')), base());
  const next = createAddressBookStore(store.info.folder).load(JSON.stringify({...base(), records:[]}));
  assert.equal(next.migrated, false);
  assert.deepEqual(next.state, base());
  assert.equal(legacy, JSON.stringify(base()));
});
test('save both individually entered and imported records and keep the previous version', () => {
  const store = createAddressBookStore(folder());
  store.load(JSON.stringify(base()));
  const next = {...base(), records:[...base().records, {id:'csv', name:'CSV 花子', address:'大阪府大阪市3-4'}]};
  store.save(next);
  assert.deepEqual(JSON.parse(fs.readFileSync(store.info.backupPath, 'utf8')), base());
  assert.deepEqual(createAddressBookStore(store.info.folder).load().state, next);
});
test('a corrupt primary file is preserved and ordinary saves are blocked', () => {
  const store = createAddressBookStore(folder());
  store.load(JSON.stringify(base()));
  fs.writeFileSync(store.info.filePath, '{broken');
  const reopened = createAddressBookStore(store.info.folder);
  assert.throws(() => reopened.load(), SyntaxError);
  assert.throws(() => reopened.save(base()), /停止/);
  assert.equal(fs.readFileSync(store.info.filePath, 'utf8'), '{broken');
  reopened.save(base(), {recover:true});
  const archived = fs.readdirSync(store.info.folder).find(name => name.startsWith('住所録.recovery-'));
  assert.equal(fs.readFileSync(path.join(store.info.folder, archived), 'utf8'), '{broken');
  assert.deepEqual(reopened.load().state, base());
});
test('invalid data never overwrites the saved address book', () => {
  const store = createAddressBookStore(folder());
  store.load(JSON.stringify(base()));
  const original = fs.readFileSync(store.info.filePath, 'utf8');
  assert.throws(() => store.save({records:[{}], sender:{}}));
  assert.equal(fs.readFileSync(store.info.filePath, 'utf8'), original);
});
test('a failed replacement keeps the old file and cleans the temporary file', () => {
  const directory = folder();
  const store = createAddressBookStore(directory);
  store.load(JSON.stringify(base()));
  const io = new Proxy(fs, {get(target, key) {
    if (key === 'renameSync') return (from, to) => {
      if (to === store.info.filePath) throw Object.assign(Error('Access denied'), {code:'EACCES'});
      return fs.renameSync(from, to);
    };
    return target[key];
  }});
  const failing = createAddressBookStore(directory, io);
  failing.load();
  assert.throws(() => failing.save({...base(), records:[]}), /Access denied/);
  assert.deepEqual(createAddressBookStore(directory).load().state, base());
  assert.equal(fs.readdirSync(directory).some(name => name.endsWith('.tmp')), false);
});
test('a missing primary file with a backup does not silently create an empty address book', () => {
  const store = createAddressBookStore(folder());
  store.load(JSON.stringify(base()));
  store.save({...base(), offsetX:2});
  fs.unlinkSync(store.info.filePath);
  assert.throws(() => createAddressBookStore(store.info.folder).load(), /backup/);
  assert.equal(fs.existsSync(store.info.filePath), false);
});
test('an unreadable or invalid legacy address book is not replaced with an empty file', () => {
  const store = createAddressBookStore(folder());
  assert.throws(() => store.load('{broken'), SyntaxError);
  assert.throws(() => store.load(null, true), /移行を停止/);
  assert.equal(fs.existsSync(store.info.filePath), false);
});
