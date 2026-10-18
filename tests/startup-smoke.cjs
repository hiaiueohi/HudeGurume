const {app, BrowserWindow} = require('electron');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../.runtime');
fs.mkdirSync(root, {recursive: true});
const suppliedProfile = process.argv.find(arg => arg.startsWith('--profile='));
const profile = suppliedProfile ? suppliedProfile.slice('--profile='.length) : fs.mkdtempSync(path.join(root, 'startup-test-'));
app.setPath('userData', profile);
const documents = path.join(profile, 'Documents');
fs.mkdirSync(documents, {recursive:true});
app.setPath('documents', documents);
const cancelMode = process.argv.includes('--cancel');
if (!process.argv.includes('--second')) {
  const resultPath = path.join(root, cancelMode ? 'startup-cancel-result.json' : 'startup-result.json');
  let finished = false, splashCount = 0, mainCount = 0, secondCount = 0;
  let sawAnimation = false, sawHiddenMain = false, splashShownAt = 0, readySeen = false;
  let mainShownAt = 0;
  let splashWindow, cancellationChecked = false;
  const fail = error => {
    if (finished) return;
    finished = true;
    fs.writeFileSync(resultPath, JSON.stringify({ok:false, error:String(error)}, null, 2));
    console.error(error);
    app.exit(1);
  };
  const timer = setTimeout(() => fail('Startup test timed out'), 20000);
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const duplicate = () => new Promise((resolve, reject) => {
    const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
    const child = spawn(process.execPath, [__filename, '--second', '--profile=' + profile], {env, windowsHide:true, stdio:'ignore'});
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(Error('Duplicate exited with ' + code)));
  });
  app.on('second-instance', () => { secondCount++; });
  app.on('browser-window-created', (_event, window) => {
    const frame = window.getTitle().includes('起動中') ? 'splash' : 'main';
    if (frame === 'splash') {
      splashCount++;
      splashWindow = window;
      window.once('show', async () => {
        try {
          splashShownAt = Date.now();
          if (cancelMode) {
            await delay(100);
            const hidden = BrowserWindow.getAllWindows().filter(w => w !== window).every(w => !w.isVisible());
            if (!hidden) throw Error('Main window was visible during cancellation');
            cancellationChecked = true;
            await window.webContents.executeJavaScript("document.querySelector('#closeSplash').click()");
            return;
          }
          await delay(400);
          sawAnimation = await window.webContents.executeJavaScript("document.getAnimations().some(a => a.playState === 'running')");
          if (!sawAnimation) throw Error('Splash should have a running animation');
          const image = await window.webContents.capturePage();
          fs.writeFileSync(path.join(root, 'startup-splash.png'), image.toPNG());
          await duplicate();
          await delay(550);
          if (!window.isDestroyed()) {
            fs.writeFileSync(path.join(root, 'startup-splash-later.png'), (await window.webContents.capturePage()).toPNG());
          }
          await delay(250);
          if (!window.isDestroyed()) {
            readySeen = await window.webContents.executeJavaScript("document.body.classList.contains('ready')");
          }
        } catch (error) { fail(error); }
      });
      window.on('closed', () => { splashWindow = null; });
    } else {
      mainCount++;
      window.once('show', () => { mainShownAt = Date.now(); });
      window.webContents.once('did-finish-load', () => {
        sawHiddenMain = !window.isVisible();
        setTimeout(async () => {
        try {
          if (cancelMode) throw Error('Main window appeared after cancellation');
          const elapsed = mainShownAt - splashShownAt;
          if (elapsed < 1700) throw Error('Splash disappeared too early');
          if (BrowserWindow.getAllWindows().length !== 1 || !window.isVisible()) throw Error('Expected only the main window after startup');
          await duplicate();
          if (secondCount !== 2 || splashCount !== 1 || mainCount !== 1 || !sawAnimation || !sawHiddenMain || !readySeen) throw Error('Unexpected splash lifecycle or duplicate launch');
          fs.writeFileSync(path.join(root, 'startup-main.png'), (await window.webContents.capturePage()).toPNG());
          const result = {ok:true, splashCount, mainCount, sawAnimation, sawHiddenMain, readySeen, duplicateLaunches:secondCount, splashDurationMs:elapsed};
          fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
          console.log(JSON.stringify(result));
          finished = true;
          clearTimeout(timer);
          app.quit();
        } catch (error) { fail(error); }
        }, 2300);
      });
    }
  });
  app.on('quit', () => {
    clearTimeout(timer);
    if (cancelMode && cancellationChecked && !finished) {
      finished = true;
      fs.writeFileSync(resultPath, JSON.stringify({ok:true, cancelled:true}, null, 2));
      console.log('Splash cancellation passed');
    }
  });
}
require('../desktop.cjs');
