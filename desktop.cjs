const {app,BrowserWindow,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const log=message=>fs.appendFileSync(path.join(__dirname,'startup.log'),`${new Date().toISOString()} ${message}\n`);
let win;
process.on('uncaughtException',error=>{log(error.stack);dialog.showErrorBox('Startup error',error.message);app.exit(1);});
if(!app.requestSingleInstanceLock()){
  log('Existing instance found; activating its window');
  app.quit();
}else{
// Keep address book storage in the existing userData directory. Only disposable
// caches receive a new location so a stale or elevated process cannot lock them.
const cacheRoot=path.join(__dirname,'.runtime','cache');
fs.mkdirSync(cacheRoot,{recursive:true});
const cachePath=fs.mkdtempSync(path.join(cacheRoot,'session-'));
app.commandLine.appendSwitch('disk-cache-dir',cachePath);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
log('Cache directory: '+cachePath);
function bringToFront(){
  if(!win)return;
  if(win.isMinimized())win.restore();
  win.show();
  win.focus();
}
app.on('second-instance',bringToFront);
app.whenReady().then(async()=>{
  log('Electron ready');
  win=new BrowserWindow({show:true,width:1250,height:900,minWidth:800,minHeight:650,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('render-process-gone',(_event,details)=>log('Renderer exited: '+JSON.stringify(details)));
  win.on('closed',()=>{log('Window closed');win=null;});
  await win.loadFile(path.join(__dirname,'index.html'));
  bringToFront();
  log('Window displayed; visible='+win.isVisible());
}).catch(error=>{log(error.stack);dialog.showErrorBox('Startup error',error.message);app.exit(1);});
app.on('window-all-closed',()=>app.quit());
}
