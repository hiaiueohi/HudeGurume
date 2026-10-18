// Launch the packaged exe using its ordinary profile and Documents folder.
// Read-only UI checks: never register test recipients or send a print job.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),{spawn,spawnSync}=require('node:child_process');
const {CDPClient}=require('./cdp-client.cjs');
const root=path.resolve(__dirname,'..'),exe=path.join(root,'dist','宛名はがき','宛名はがき.exe'),runtime=path.join(root,'.runtime');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const hash=file=>require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function run(){
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const out=fs.mkdtempSync(path.join(runtime,'normal-launch-')),logs=[],started=Date.now(),result={ok:false};let exited=false,exitCode,client;
 const child=spawn(exe,['--remote-debugging-port='+port],{cwd:out,env,windowsHide:false,stdio:['ignore','pipe','pipe']});child.once('exit',code=>{exited=true;exitCode=code;});
 for(const stream of [child.stdout,child.stderr])stream.on('data',data=>logs.push(data.toString()));
 try{
  let target;
  for(let n=0;n<600&&!exited;n++){try{const items=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=items.find(t=>t.url.endsWith('/index.html'));if(target)break;}catch(error){}await delay(50);}
  if(!target)throw Error(exited&&exitCode===0?'Another instance is already open; normal cold launch could not be checked.':'Normal executable launch did not become ready.');
  client=await CDPClient.connect(target.webSocketDebuggerUrl);await client.evaluate('document.fonts.ready.then(()=>true)');
  await delay(2000);
  const loaded=await client.evaluate('(()=>{const s=addressBookStorage.load();return {ok:s.ok,error:s.error,path:s.info.filePath,ready:document.querySelector("#addressTab").getAttribute("aria-selected")==="true",printing:typeof postcardPrinter.print==="function"}})()');
  if(!loaded.ok||!loaded.ready||!loaded.printing)throw Error('Normal startup check failed: '+(loaded.error||'UI/bridge missing'));
  const before=hash(loaded.path);result.startupMs=Date.now()-started;result.ordinaryProfile=true;result.documentsFolder=path.dirname(loaded.path);result.addressBookReadable=true;
  await client.evaluate('document.querySelector("#designTab").click();document.querySelector("#designPreview img").decode().then(()=>true)');
  await client.evaluate('document.querySelector("#designPreview").click();document.querySelector("#layoutCancel").click();true');result.designAndEditor=true;
  const screenshot=await client.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'exe-normal.png'),Buffer.from(screenshot.data,'base64'));
  await client.evaluate('setTimeout(()=>window.close(),50);true');for(let n=0;n<200&&!exited;n++)await delay(50);
  if(!exited||exitCode!==0)throw Error('Normal executable did not exit cleanly.');
  if(hash(loaded.path)!==before)throw Error('Read-only check unexpectedly changed the address book.');result.addressBookUnchanged=true;result.cleanExit=true;
  const log=fs.readFileSync(path.join(process.env.APPDATA,'atena-postcard','logs','startup.log'),'utf8');if(!log.includes('Window displayed; visible=true'))throw Error('Ordinary startup log was not written');result.userLog=true;
  if(/Unable to create cache|Unable to move the cache|Gpu Cache Creation failed|FATAL:/.test(logs.join('')))throw Error('Cache or fatal error in normal executable');result.ok=true;
 }catch(error){result.error=error.message;throw error;}finally{client?.close();if(!exited)spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});fs.writeFileSync(path.join(out,'process.log'),logs.join(''));fs.writeFileSync(path.join(runtime,'exe-normal-result.json'),JSON.stringify(result,null,2));}
 console.log(JSON.stringify(result));return result;
}
module.exports={run};
if(require.main===module)run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
