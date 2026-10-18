const {app,BrowserWindow}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const testRoot=path.resolve(__dirname,'../.runtime/startup-test');
fs.mkdirSync(testRoot,{recursive:true});
app.setPath('userData',testRoot);
if(!process.argv.includes('--second')){
  const resultPath=path.join(testRoot,'result.json');
  let second;
  const fail=error=>{fs.writeFileSync(resultPath,JSON.stringify({ok:false,error:String(error)}));console.error(error);app.exit(1);};
  const timer=setTimeout(()=>fail('Startup test timed out'),20000);
  let loaded=false,receivedSecond=false,finished=false;
  let secondExited=false;
  const finish=()=>{
    if(finished||!loaded||!receivedSecond||!secondExited)return;
    try{
      const windows=BrowserWindow.getAllWindows();
      if(windows.length!==1||!windows[0].isVisible())throw Error('Expected one visible window');
      finished=true;
      fs.writeFileSync(resultPath,JSON.stringify({ok:true,windows:windows.length,visible:windows[0].isVisible(),cache:app.commandLine.getSwitchValue('disk-cache-dir'),gpuDiskCacheDisabled:app.commandLine.hasSwitch('disable-gpu-shader-disk-cache')}));
      clearTimeout(timer);
      console.log('Visible startup and duplicate launch passed');
      app.quit();
    }catch(error){fail(error);}
  };
  app.on('second-instance',()=>{receivedSecond=true;setTimeout(finish,100);});
  app.on('browser-window-created',(_event,win)=>{
    win.webContents.once('did-finish-load',()=>setTimeout(()=>{
      loaded=true;
      const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
      second=spawn(process.execPath,[__filename,'--second'],{env,windowsHide:true,stdio:'ignore'});
      second.once('error',fail);
      second.once('exit',code=>{if(code!==0)return fail('Second instance exited with '+code);secondExited=true;finish();});
    },300));
  });
  app.once('quit',()=>clearTimeout(timer));
}
require('../desktop.cjs');
