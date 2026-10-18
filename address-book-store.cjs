const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {validateState} = require('./src/core.js');

function createAddressBookStore(folder, io = fs) {
  const filePath = path.join(folder, '住所録.json');
  const backupPath = path.join(folder, '住所録.backup.json');
  const info = {folder, filePath, backupPath};
  let loaded = false;
  function read(file) {
    return validateState(JSON.parse(io.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
  }
  function atomicWrite(file, text) {
    const temporary = file + '.' + randomUUID() + '.tmp';
    let descriptor;
    try {
      descriptor = io.openSync(temporary, 'wx');
      io.writeFileSync(descriptor, text, 'utf8');
      io.fsyncSync(descriptor);
      io.closeSync(descriptor); descriptor = undefined;
      io.renameSync(temporary, file);
    } finally {
      if (descriptor !== undefined) io.closeSync(descriptor);
      if (io.existsSync(temporary)) io.unlinkSync(temporary);
    }
  }
  function save(data, {recover = false} = {}) {
    if (!loaded && !recover) throw Error('住所録を読み込めていないため保存を停止しています。バックアップから復元してください。');
    const next = validateState(data);
    io.mkdirSync(folder, {recursive:true});
    if (io.existsSync(filePath)) {
      const previousText = io.readFileSync(filePath, 'utf8');
      let previousValid = true;
      try { validateState(JSON.parse(previousText.replace(/^\uFEFF/, ''))); }
      catch (error) { previousValid = false; }
      if (!previousValid && !recover) throw Error('住所録ファイルを読み込めません。上書きを停止しました。バックアップから復元してください。');
      if (previousValid) atomicWrite(backupPath, previousText);
      else atomicWrite(path.join(folder, '住所録.recovery-' + Date.now() + '-' + randomUUID() + '.json'), previousText);
    }
    atomicWrite(filePath, JSON.stringify(next, null, 2) + '\n');
    loaded = true;
    return next;
  }
  function load(legacyText = null, legacyUnavailable = false) {
    if (io.existsSync(filePath)) {
      const state = read(filePath);
      loaded = true;
      return {state, info, migrated:false};
    }
    if (io.existsSync(backupPath)) throw Error('住所録.jsonが見つかりません。住所録.backup.jsonから復元してください。');
    if (legacyUnavailable) throw Error('以前の住所録を確認できないため、移行を停止しています。アプリを閉じて起動し直してください。');
    const state = legacyText ? validateState(JSON.parse(legacyText)) : {records:[], sender:{}, offsetX:0, offsetY:0};
    loaded = true;
    try { save(state); } catch (error) { loaded = false; throw error; }
    return {state, info, migrated:Boolean(legacyText)};
  }
  return {info, load, save};
}
module.exports = {createAddressBookStore};
