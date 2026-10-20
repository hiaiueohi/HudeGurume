const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn,spawnSync}=require('node:child_process');
const {CDPClient}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),exe=path.join(root,'.runtime','windows-build',process.argv.includes('--unpacked')?'win-unpacked':'宛名はがき','宛名はがき.exe');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const port=()=>new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});});
async function endpoint(value,predicate=()=>true){for(let n=0;n<600;n++){try{const items=await (await fetch('http://127.0.0.1:'+value+'/json/list')).json(),found=items.find(predicate);if(found)return found;}catch(error){}await delay(50);}throw Error('Executable debugger did not become ready');}
async function run(){
 if(!fs.existsSync(exe))throw Error('Run npm run build:win first.');
 const out=fs.mkdtempSync(path.join(root,'.runtime','exe-check-')),profile=path.join(out,'profile'),documents=path.join(out,'Documents');fs.mkdirSync(profile);fs.mkdirSync(documents);
 const nodePort=await port(),rendererPort=await port(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 let child,node,renderer,exited=false;const logs=[];const result={ok:false,executable:path.relative(root,exe),outputFolder:path.relative(root,out)};
 try{
  const startedAt=Date.now();child=spawn(exe,['--inspect-brk=127.0.0.1:'+nodePort,'--remote-debugging-port='+rendererPort,'--user-data-dir='+profile],{cwd:out,env,windowsHide:false,stdio:['ignore','pipe','pipe']});
  child.once('exit',code=>{exited=true;result.exitCode=code;});for(const stream of [child.stdout,child.stderr])stream.on('data',data=>logs.push(data.toString()));
  node=await CDPClient.connect((await endpoint(nodePort)).webSocketDebuggerUrl);await node.send('Debugger.enable');
  const paused=node.once('Debugger.paused');await node.send('Runtime.runIfWaitingForDebugger');const pause=await paused;
  const injected=await node.send('Debugger.evaluateOnCallFrame',{callFrameId:pause.callFrames[0].callFrameId,expression:'global.__exeTestElectron=require("electron");global.__exeTestElectron.app.setPath("userData",'+JSON.stringify(profile)+');global.__exeTestElectron.app.setPath("documents",'+JSON.stringify(documents)+');true',returnByValue:true});
  if(injected.exceptionDetails)throw Error('Cannot isolate packaged app test: '+JSON.stringify(injected.exceptionDetails));
  await node.send('Debugger.resume');
  renderer=await CDPClient.connect((await endpoint(rendererPort,item=>item.url.endsWith('/index.html'))).webSocketDebuggerUrl);
  await renderer.evaluate('document.fonts.ready.then(()=>true)');
  let visible=false;for(let n=0;n<100;n++){if(await node.evaluate('global.__exeTestElectron.BrowserWindow.getAllWindows().some(w=>w.getTitle()==="宛名はがき"&&w.isVisible())')){visible=true;break;}await delay(50);}if(!visible)throw Error('Main window did not become visible');result.startupMs=Date.now()-startedAt;
  const runtime=await node.evaluate('({packaged:global.__exeTestElectron.app.isPackaged,version:global.__exeTestElectron.app.getVersion(),path:global.__exeTestElectron.app.getAppPath(),documents:global.__exeTestElectron.app.getPath("documents"),userData:global.__exeTestElectron.app.getPath("userData")})');
  if(!runtime.packaged||!runtime.path.endsWith('app.asar')||runtime.documents!==documents||runtime.userData!==profile)throw Error('Packaged runtime or isolated paths mismatch');
  result.packaged=true;result.asar=true;result.version=runtime.version;
  await node.evaluate('global.__exeTestPrintJobs=[];const wc=global.__exeTestElectron.BrowserWindow.getAllWindows().find(w=>w.getTitle()==="宛名はがき").webContents;wc.getPrintersAsync=async()=>[{name:"Test postcard printer",displayName:"テスト専用",isDefault:true,status:0}];wc.print=(options,callback)=>{global.__exeTestPrintJobs.push(options);callback(true)};true');
  result.addressBook=await renderer.evaluate(fs.readFileSync(path.join(__dirname,'ui-scenario.js'),'utf8'));
  await renderer.send('Emulation.setEmulatedMedia',{media:'print'});
  try{
   result.postalFrames=await renderer.evaluate(fs.readFileSync(path.join(__dirname,'postal-print-scenario.js'),'utf8'));
   const bounds=await renderer.evaluate('(()=>{const r=document.querySelector("#printArea .front-card").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()');
   const printed=await renderer.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:bounds});fs.writeFileSync(path.join(out,'exe-postal-print.png'),Buffer.from(printed.data,'base64'));
  }finally{await renderer.send('Emulation.setEmulatedMedia',{media:''});}
  result.frontEditing=await renderer.evaluate(fs.readFileSync(path.join(__dirname,'front-scenario.js'),'utf8'));
  result.designs=await renderer.evaluate(fs.readFileSync(path.join(__dirname,'design-scenario.js'),'utf8'));
  const screenshot=await renderer.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'exe-designs.png'),Buffer.from(screenshot.data,'base64'));
  const jobs=await node.evaluate('global.__exeTestPrintJobs');if(jobs.length!==3||jobs.some(j=>j.pageSize.width!==100000||j.pageSize.height!==148000))throw Error('Packaged printing bridge failed');result.printing={simulated:true,jobs:jobs.length,postcardSize:true};
  result.usability=await renderer.evaluate(fs.readFileSync(path.join(__dirname,'usability-scenario.js'),'utf8'));
  await renderer.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const reviewScreenshot=await renderer.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'exe-review.png'),Buffer.from(reviewScreenshot.data,'base64'));
  const addressFolder=path.join(documents,'宛名はがき');if(JSON.parse(fs.readFileSync(path.join(addressFolder,'住所録.json'),'utf8')).records.length!==3||!fs.existsSync(path.join(addressFolder,'住所録.backup.json')))throw Error('Packaged address book save failed');
  if(!fs.existsSync(path.join(addressFolder,'年賀状デザイン','2027年_未（ひつじ）','01_和紙と金彩_背景.png')))throw Error('Packaged assets did not install from ASAR');
  result.documentSave=true;result.bundledAssets=true;
  const duplicate=spawn(exe,['--user-data-dir='+profile],{cwd:out,env,windowsHide:true,stdio:'ignore'});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Duplicate exe did not exit')),15000);duplicate.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error('Duplicate exited with '+code));});duplicate.once('error',reject);});
  if(await node.evaluate('global.__exeTestElectron.BrowserWindow.getAllWindows().length')!==1)throw Error('Duplicate launch created another window');result.singleInstance=true;
  await renderer.send('Page.reload');await delay(300);await renderer.evaluate('document.fonts.ready.then(()=>true)');
  const restored=await renderer.evaluate('({count:document.querySelectorAll("#list .entry").length,layout:addressBookStorage.load().state.frontLayout.common.names})');if(restored.count!==3||restored.layout.writingMode!=='horizontal')throw Error('Packaged reload failed');result.reload=true;
  const log=fs.readFileSync(path.join(profile,'logs','startup.log'),'utf8');if(!log.includes('Window displayed; visible=true')||!log.includes(path.join(profile,'cache')))throw Error('Startup logging or writable cache path failed');result.writableRuntime=true;
  const fatal=logs.join('').match(/FATAL:|Unable to create cache|Gpu Cache Creation failed|Unable to move the cache|UnhandledPromiseRejection/);if(fatal)throw Error('Executable reported '+fatal[0]);result.noCacheErrors=true;
  await node.evaluate('setTimeout(()=>global.__exeTestElectron.app.quit(),250);true');renderer.close();renderer=null;node.close();node=null;for(let n=0;n<300&&!exited;n++)await delay(50);if(!exited||result.exitCode!==0)throw Error('Executable did not exit cleanly');
  result.cleanExit=true;result.ok=true;
 }catch(error){result.error=error.stack||String(error);if(renderer)result.screenStatus=await renderer.evaluate('({print:document.querySelector("#printMessage").textContent,design:document.querySelector("#designSaveStatus").textContent})').catch(()=>null);throw error;}finally{
  renderer?.close();node?.close();if(child&&!exited)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  fs.writeFileSync(path.join(out,'process.log'),logs.join(''));fs.writeFileSync(path.join(root,'.runtime','exe-test-result.json'),JSON.stringify(result,null,2));
 }
 if(!process.argv.includes('--unpacked'))result.normalLaunch=await require('./packaged-launch.cjs').run();
 fs.writeFileSync(path.join(root,'.runtime','exe-test-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
