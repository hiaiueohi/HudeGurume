const path=require('node:path');
const {pathToFileURL}=require('node:url');
const trustedURL=pathToFileURL(path.join(__dirname,'index.html')).href;
function printOptions(job,printers){
  if(!job||typeof job.deviceName!=='string'||!printers.some(p=>p.name===job.deviceName))throw Error('プリンターが見つかりません。接続して一覧を更新してください。');
  if(!Number.isInteger(job.count)||job.count<1||job.count>10000||typeof job.testOnly!=='boolean'||typeof job.color!=='boolean'||typeof job.driverDialog!=='boolean')throw Error('印刷設定を確認してください。');
  return {deviceName:job.deviceName,silent:!job.driverDialog,printBackground:true,color:job.color,
    pageSize:{width:100000,height:148000},margins:{marginType:'none'},landscape:false,scaleFactor:100,pagesPerSheet:1,copies:1,collate:true,duplexMode:'simplex',header:'',footer:'',pageRanges:[{from:0,to:job.testOnly?0:job.count-1}]};
}
function createPrintService(getWindow){
  let busy=false;
  const contents=()=>{const win=getWindow();if(!win||win.isDestroyed())throw Error('画面を開き直してください。');return win.webContents;};
  async function list(){return (await contents().getPrintersAsync()).map(p=>({name:p.name,displayName:p.displayName||p.name,isDefault:Boolean(p.isDefault),status:p.status}));}
  async function print(job){
    if(busy)throw Error('印刷処理中です。完了してからもう一度お試しください。');busy=true;
    try{
      const wc=contents(),printers=await wc.getPrintersAsync(),options=printOptions(job,printers);
      await wc.executeJavaScript('document.fonts.ready.then(() => Promise.all([...document.querySelectorAll("#printArea img")].map(image => image.decode()))).then(() => true)');
      return await new Promise((resolve,reject)=>wc.print(options,(success,reason)=>success?resolve({ok:true,count:job.testOnly?1:job.count}):reject(Error(reason==='Print job canceled'?'印刷をキャンセルしました。':'印刷できませんでした。'+(reason||'プリンターの接続・用紙設定を確認してください。')))));
    }finally{busy=false;}
  }
  return {list,print};
}
function registerPrinting({ipcMain,getWindow}){
  const service=createPrintService(getWindow);
  const allowed=event=>{const win=getWindow();return win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===event.sender.mainFrame&&event.senderFrame.url===trustedURL;};
  for(const [channel,action]of [['postcard-print:list',()=>service.list()],['postcard-print:start',job=>service.print(job)]])ipcMain.handle(channel,async(event,payload)=>{
    if(!allowed(event))return {ok:false,error:'この画面からは印刷できません。'};
    try{const result=await action(payload);return channel.endsWith(':list')?{ok:true,printers:result}:result;}catch(error){return {ok:false,error:error.message};}
  });
  return service;
}
module.exports={printOptions,createPrintService,registerPrinting};
