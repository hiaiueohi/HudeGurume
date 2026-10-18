const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {randomUUID} = require('node:crypto');
const catalog = require('./src/design-catalog.js');
const Layout = require('./src/design-layout.js');

function defaultProject() {
  return {year:catalog.year, designId:catalog.items[0].id, headline:catalog.items[0].headline,
    message:'旧年中は大変お世話になりました\n本年もどうぞよろしくお願いいたします',
    dateText:'2027年 元旦', showSender:false, headlineSize:22, messageSize:9, layout:Layout.empty()};
}
function validateProject(input) {
  if (!input || input.year !== catalog.year || !catalog.items.some(item => item.id === input.designId)) throw Error('対応していないデザインです。');
  for (const [field, max] of [['headline',40],['message',150],['dateText',30]]) {
    if (typeof input[field] !== 'string' || input[field].length > max) throw Error('文面が長すぎるか、形式が不正です。');
  }
  if (input.headline.split(/\r?\n/).length > 2 || input.message.split(/\r?\n/).length > 3) throw Error('見出しは2行、あいさつ文は3行までにしてください。');
  const headlineSize = Number(input.headlineSize), messageSize = Number(input.messageSize);
  if(input.senderText!==undefined&&(typeof input.senderText!=='string'||input.senderText.length>300))throw Error('差出人の文面は300文字までにしてください。');
  if (!Number.isFinite(headlineSize) || headlineSize < 10 || headlineSize > 26 || !Number.isFinite(messageSize) || messageSize < 7 || messageSize > 11) throw Error('文字サイズを確認してください。');
  return {year:catalog.year, designId:input.designId, headline:input.headline, message:input.message,
    dateText:input.dateText, showSender:Boolean(input.showSender), headlineSize, messageSize, layout:Layout.validate(input.layout),...(input.senderText!==undefined?{senderText:input.senderText}:{})};
}
function createDesignLibrary(addressFolder) {
  const folder = path.join(addressFolder, '年賀状デザイン', catalog.folderName);
  const projectPath = path.join(folder, '選択中のデザイン.json');
  const exportsFolder = path.join(folder, '作成した年賀状');
  const info = {folder, projectPath, exportsFolder};
  function ensure() {
    fs.mkdirSync(folder, {recursive:true});
    fs.mkdirSync(exportsFolder, {recursive:true});
    for (const item of catalog.items) {
      for (const [source, suffix] of [[item.image,'_背景.png'], [item.sample,'_完成見本.png']]) {
        const destination = path.join(folder, item.filename + suffix);
        if (!fs.existsSync(destination)) fs.copyFileSync(path.join(__dirname, source), destination, fs.constants.COPYFILE_EXCL);
      }
    }
    const catalogPath = path.join(folder, 'デザイン一覧.json');
    const promptsPath = path.join(folder, '生成プロンプト.md');
    if (!fs.existsSync(promptsPath)) fs.copyFileSync(path.join(__dirname,'assets','designs','2027','生成プロンプト.md'),promptsPath,fs.constants.COPYFILE_EXCL);
    if (!fs.existsSync(catalogPath)) fs.writeFileSync(catalogPath, JSON.stringify({year:catalog.year,zodiac:catalog.zodiac,animal:catalog.animal,designs:catalog.items.map(({id,name,category,filename}) => ({id,name,category,background:filename+'_背景.png',sample:filename+'_完成見本.png'}))},null,2), {encoding:'utf8',flag:'wx'});
    const readme = path.join(folder, 'はじめに.txt');
    if (!fs.existsSync(readme)) fs.writeFileSync(readme,
      '2027年・未（ひつじ）の年賀状デザイン\r\n\r\n宛名はがき オリジナルデザイン6種類です。\r\n「完成見本」は標準の文面を重ねた画像、「背景」は文字のない絵柄です。\r\nアプリの「年賀状デザイン（うら面）」で選ぶと、見出し・あいさつ文を変えながら仕上がりを確認できます。\r\n選択した内容は「選択中のデザイン.json」、画像保存した完成品は「作成した年賀状」に保存します。\r\n既存の画像はアプリ起動で上書きしません。\r\n\r\n図案：画像生成ツールによるオリジナル。筆ぐるめの画像・ロゴ・素材は含みません。\r\n参考にした操作の分類：https://fudegurume.jp/fgw/katsuyou/howto/searchlayout.html\r\n', {encoding:'utf8',flag:'wx'});
    return info;
  }
  function list() {
    ensure();
    return {catalog:{...catalog,items:catalog.items.map(item => ({...item,image:pathToFileURL(path.join(folder,item.filename+'_背景.png')).href,sample:pathToFileURL(path.join(folder,item.filename+'_完成見本.png')).href}))},info};
  }
  function loadProject() {
    ensure();
    return fs.existsSync(projectPath) ? validateProject(JSON.parse(fs.readFileSync(projectPath,'utf8').replace(/^\uFEFF/,''))) : defaultProject();
  }
  function saveProject(input) {
    const project = validateProject(input);
    ensure();
    const temporary = projectPath + '.' + randomUUID() + '.tmp';
    try { fs.writeFileSync(temporary, JSON.stringify(project,null,2)+'\n', {encoding:'utf8',flag:'wx'}); fs.renameSync(temporary,projectPath); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    return project;
  }
  function saveImage(dataUrl, designId) {
    const item = catalog.items.find(item => item.id === designId);
    if (!item || typeof dataUrl !== 'string' || dataUrl.length > 30000000 || !dataUrl.startsWith('data:image/png;base64,')) throw Error('保存する画像の形式が不正です。');
    const data = Buffer.from(dataUrl.slice('data:image/png;base64,'.length),'base64');
    if (data.length < 24 || !data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw Error('PNG画像を読み込めません。');
    ensure();
    const now = new Date();
    const stamp = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now).replace(/[-: ]/g,'');
    const filePath = path.join(exportsFolder, '2027年_'+item.name+'_'+stamp+'_'+randomUUID().slice(0,6)+'.png');
    fs.writeFileSync(filePath, data, {flag:'wx'});
    return {filePath,folder:exportsFolder};
  }
  return {info,ensure,list,loadProject,saveProject,saveImage};
}
module.exports = {createDesignLibrary,defaultProject,validateProject};
