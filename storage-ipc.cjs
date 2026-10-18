const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {createAddressBookStore} = require('./address-book-store.cjs');

function registerStorage({ipcMain, shell, folder, getWindow}) {
  const store = createAddressBookStore(folder);
  const library = require('./design-library.cjs').createDesignLibrary(folder);
  const trustedURL = pathToFileURL(path.join(__dirname, 'index.html')).href;
  function allowed(event) {
    const window = getWindow();
    return window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === trustedURL;
  }
  for (const operation of ['load', 'save', 'restore']) {
    ipcMain.on('address-book:' + operation, (event, payload) => {
      try {
        if (!allowed(event)) throw Error('住所録へのアクセスを許可できません。');
        let result;
        if (operation === 'load') result = store.load(payload?.legacyText, payload?.legacyUnavailable);
        else result = {state:store.save(payload, {recover:operation === 'restore'}), info:store.info};
        event.returnValue = {ok:true, ...result};
      } catch (error) {
        event.returnValue = {ok:false, error:error.message, info:store.info};
      }
    });
  }
  ipcMain.handle('address-book:open-folder', async event => {
    if (!allowed(event)) return {ok:false, error:'保存先を開けません。'};
    const error = await shell.openPath(folder);
    return error ? {ok:false, error} : {ok:true};
  });
  for (const operation of ['list','load-project','save-project','save-image']) {
    ipcMain.on('nenga-design:'+operation, (event,payload) => {
      try {
        if (!allowed(event)) throw Error('デザインへのアクセスを許可できません。');
        let result;
        if (operation === 'list') result=library.list();
        if (operation === 'load-project') result={project:library.loadProject()};
        if (operation === 'save-project') result={project:library.saveProject(payload)};
        if (operation === 'save-image') result=library.saveImage(payload?.dataUrl,payload?.designId);
        event.returnValue={ok:true,...result};
      } catch(error) { event.returnValue={ok:false,error:error.message}; }
    });
  }
  ipcMain.handle('nenga-design:open-folder', async event => {
    if(!allowed(event))return {ok:false,error:'保存先を開けません。'};
    try { library.ensure(); const error=await shell.openPath(library.info.folder);return error?{ok:false,error}:{ok:true}; }
    catch(error){return {ok:false,error:error.message};}
  });
  return store;
}
module.exports = {registerStorage};
