const {app, BrowserWindow, dialog, ipcMain, shell} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
// The executable may be in a read-only installation directory or inside app.asar.
// Keep the existing development profile so legacy browser data can still migrate.
if(app.isPackaged&&!app.commandLine.hasSwitch('user-data-dir'))app.setPath('userData',path.join(app.getPath('appData'),'atena-postcard'));
if(process.platform==='win32')app.setAppUserModelId('jp.atena.postcard');
const logFolder=path.join(app.getPath('userData'),'logs');
const log = message => {try{fs.mkdirSync(logFolder,{recursive:true});fs.appendFileSync(path.join(logFolder,'startup.log'),new Date().toISOString()+' '+message+'\n');}catch(error){console.error('Unable to write startup log:',error.message);}};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let win, splash;
let mainShown = false, launchCancelled = false;
function reportError(error) {
  if (launchCancelled) return;
  log(error.stack || String(error));
  launchCancelled = true;
  if (splash && !splash.isDestroyed()) splash.destroy();
  if (win && !win.isDestroyed()) win.destroy();
  dialog.showErrorBox('宛名はがきを起動できませんでした', error.message || String(error));
  app.exit(1);
}
process.on('uncaughtException', reportError);
if (!app.requestSingleInstanceLock()) {
  log('Existing instance found; activating its window');
  app.quit();
} else {
  // Chromium's cache is separate from the address book in Documents.
  const cacheRoot = path.join(app.getPath('userData'), 'cache');
  fs.mkdirSync(cacheRoot, {recursive: true});
  const cachePath = fs.mkdtempSync(path.join(cacheRoot, 'session-'));
  app.commandLine.appendSwitch('disk-cache-dir', cachePath);
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  log('Cache directory: ' + cachePath);
  function bringToFront() {
    const target = mainShown ? win : splash;
    if (!target || target.isDestroyed()) return;
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
  }
  function prepareWindow(window) {
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
  }
  app.on('second-instance', bringToFront);
  app.on('before-quit', () => { launchCancelled = true; });
  app.whenReady().then(async () => {
    log('Electron ready');
    require('./storage-ipc.cjs').registerStorage({
      ipcMain, shell, folder:path.join(app.getPath('documents'), '宛名はがき'), getWindow:() => win
    });
    require('./printing-ipc.cjs').registerPrinting({ipcMain,getWindow:()=>win});
    const webPreferences = {nodeIntegration: false, contextIsolation: true, sandbox: true};
    splash = new BrowserWindow({
      title: '宛名はがき — 起動中', width: 540, height: 450, show: false,
      frame: false, resizable: false, maximizable: false, fullscreenable: false,
      backgroundColor: '#f9fbfe', webPreferences
    });
    prepareWindow(splash);
    splash.on('closed', () => {
      splash = null;
      if (!mainShown && !launchCancelled) { launchCancelled = true; app.quit(); }
    });
    const splashPainted = new Promise(resolve => splash.once('ready-to-show', resolve));
    await splash.loadFile(path.join(__dirname, 'splash.html'));
    await splashPainted;
    if (launchCancelled || !splash || splash.isDestroyed()) return;
    splash.show();
    splash.focus();
    const shownAt = Date.now();
    log('Splash displayed');
    await splash.webContents.executeJavaScript("window.setLaunchStage('loading')");
    win = new BrowserWindow({
      title: '宛名はがき', show: false, width: 1250, height: 900,
      minWidth: 800, minHeight: 650, backgroundColor: '#f4f7f7', webPreferences:{...webPreferences, preload:path.join(__dirname, 'preload.cjs')}
    });
    prepareWindow(win);
    win.webContents.on('render-process-gone', (_event, details) => {
      log('Renderer exited: ' + JSON.stringify(details));
      if (!launchCancelled) reportError(Error('住所録画面の準備に失敗しました。もう一度起動してください。'));
    });
    win.on('closed', () => { log('Window closed'); win = null; });
    const mainPainted = new Promise(resolve => win.once('ready-to-show', resolve));
    await win.loadFile(path.join(__dirname, 'index.html'));
    await mainPainted;
    await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    await delay(Math.max(0, 1300 - (Date.now() - shownAt)));
    if (launchCancelled || !splash || !win) return;
    await splash.webContents.executeJavaScript("window.setLaunchStage('ready')");
    log('Splash ready');
    await delay(350);
    if (launchCancelled || !splash || !win) return;
    await splash.webContents.executeJavaScript("window.setLaunchStage('leaving')");
    await delay(180);
    if (launchCancelled || !splash || !win) return;
    mainShown = true;
    bringToFront();
    splash.close();
    log('Window displayed; visible=' + win.isVisible());
  }).catch(reportError);
  app.on('window-all-closed', () => app.quit());
}
