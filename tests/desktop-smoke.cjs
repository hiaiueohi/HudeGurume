const {app,BrowserWindow}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'../.runtime');
fs.mkdirSync(root,{recursive:true});
const dataPath=fs.mkdtempSync(path.join(root,'ui-test-'));
app.setPath('userData',dataPath);
app.commandLine.appendSwitch('disk-cache-dir',path.join(dataPath,'cache'));
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const resultPath=path.join(root,'ui-test-result.json');
let win;
const timer=setTimeout(()=>{fs.writeFileSync(resultPath,JSON.stringify({ok:false,error:'Timed out'}));app.exit(1);},25000);
app.whenReady().then(async()=>{
  try{
    win=new BrowserWindow({show:false,width:1250,height:1000,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
    await win.loadFile(path.resolve(__dirname,'../index.html'));
    await win.webContents.executeJavaScript('window.scrollTo(0,0); document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
    await new Promise(resolve=>setTimeout(resolve,150));
    await win.webContents.capturePage().then(img=>fs.writeFileSync(path.join(root,'ui-empty.png'),img.toPNG()));
    const result=await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname,'ui-scenario.js'),'utf8'));
    await win.webContents.executeJavaScript('window.scrollTo(0,0); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await new Promise(resolve=>setTimeout(resolve,150));
    await win.webContents.capturePage().then(img=>fs.writeFileSync(path.join(root,'ui-addressbook.png'),img.toPNG()));
    await win.webContents.executeJavaScript("document.querySelector('#openImport').click()");
    await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await new Promise(resolve=>setTimeout(resolve,150));
    await win.webContents.capturePage().then(img=>fs.writeFileSync(path.join(root,'ui-import.png'),img.toPNG()));
    fs.writeFileSync(resultPath,JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
    clearTimeout(timer);
    app.quit();
  }catch(error){
    const detail=win&&!win.isDestroyed()?await win.webContents.executeJavaScript("({status:document.querySelector('#status').textContent,dialog:document.querySelector('dialog[open]')?.textContent})").catch(()=>null):null;
    fs.writeFileSync(resultPath,JSON.stringify({ok:false,error:error.stack,detail},null,2));
    console.error(error);
    clearTimeout(timer);
    app.exit(1);
  }
});
