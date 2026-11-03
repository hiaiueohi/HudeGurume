const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const trustedURL=pathToFileURL(path.join(__dirname,'index.html')).href;
// はがきは100×148mm。印刷もPDFも同じ用紙で、余白・倍率を変えずに送る。
const PAGE={width:100,height:148};
function printRange(job){
  if(!job||!Number.isInteger(job.count)||job.count<1||job.count>10000)throw Error('印刷設定を確認してください。');
  if(typeof job.testOnly!=='boolean')throw Error('印刷設定を確認してください。');
  if(job.testOnly)return {from:1,to:1};
  const from=job.from===undefined?1:job.from,to=job.to===undefined?job.count:job.to;
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<1||to<from||to>job.count)throw Error('印刷する範囲は1枚目から'+job.count+'枚目までの間で指定してください。');
  return {from,to};
}
function printOptions(job,printers){
  if(!job||typeof job.deviceName!=='string'||!printers.some(p=>p.name===job.deviceName))throw Error('プリンターが見つかりません。接続して一覧を更新してください。');
  if(typeof job.color!=='boolean'||typeof job.driverDialog!=='boolean')throw Error('印刷設定を確認してください。');
  const range=printRange(job);
  return {deviceName:job.deviceName,silent:!job.driverDialog,printBackground:true,color:job.color,
    pageSize:{width:PAGE.width*1000,height:PAGE.height*1000},margins:{marginType:'none'},landscape:false,scaleFactor:100,pagesPerSheet:1,copies:1,collate:true,duplexMode:'simplex',header:'',footer:'',pageRanges:[{from:range.from-1,to:range.to-1}]};
}
function pdfOptions(job){
  const range=printRange(job);
  return {printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,landscape:false,
    margins:{top:0,bottom:0,left:0,right:0},pageSize:{width:PAGE.width/25.4,height:PAGE.height/25.4},pageRanges:range.from+'-'+range.to};
}
function createPrintService(getWindow,{dialog,io=fs}={}){
  let busy=false;
  const contents=()=>{const win=getWindow();if(!win||win.isDestroyed())throw Error('画面を開き直してください。');return win.webContents;};
  const ready=wc=>wc.executeJavaScript('document.fonts.ready.then(() => Promise.all([...document.querySelectorAll("#printArea img")].map(image => image.decode()))).then(() => true)');
  async function list(){return (await contents().getPrintersAsync()).map(p=>({name:p.name,displayName:p.displayName||p.name,isDefault:Boolean(p.isDefault),status:p.status}));}
  async function exclusive(action){
    if(busy)throw Error('印刷処理中です。完了してからもう一度お試しください。');busy=true;
    try{return await action();}finally{busy=false;}
  }
  async function print(job){
    return exclusive(async()=>{
      const wc=contents(),printers=await wc.getPrintersAsync(),options=printOptions(job,printers),range=printRange(job);
      await ready(wc);
      return await new Promise((resolve,reject)=>wc.print(options,(success,reason)=>success?resolve({ok:true,count:range.to-range.from+1,from:range.from,to:range.to}):reject(Error(reason==='Print job canceled'?'印刷をキャンセルしました。':'印刷できませんでした。'+(reason||'プリンターの接続・用紙設定を確認してください。')))));
    });
  }
  // プリンターがなくてもPDFにして持ち出せるようにする。保存先はユーザーが選ぶ。
  async function savePDF(job){
    return exclusive(async()=>{
      const wc=contents(),options=pdfOptions(job),range=printRange(job);
      if(typeof job.suggestedName!=='string'||job.suggestedName.length>80)throw Error('保存するファイル名を確認してください。');
      await ready(wc);
      const data=await wc.printToPDF(options);
      const chosen=await dialog.showSaveDialog(getWindow(),{title:'PDFとして保存',defaultPath:job.suggestedName,filters:[{name:'PDF',extensions:['pdf']}]});
      if(chosen.canceled||!chosen.filePath)return {ok:false,error:'保存を取り消しました。',canceled:true};
      try{io.writeFileSync(chosen.filePath,data);}
      catch(error){throw Error(['EBUSY','EPERM','EACCES'].includes(error.code)?'PDFを保存できませんでした。同じ名前のPDFを開いている場合は閉じるか、別の名前で保存してください。':'PDFを保存できませんでした。'+error.message);}
      return {ok:true,count:range.to-range.from+1,filePath:chosen.filePath};
    });
  }
  return {list,print,savePDF};
}
function registerPrinting({ipcMain,getWindow,dialog=require('electron').dialog}){
  const service=createPrintService(getWindow,{dialog});
  const allowed=event=>{const win=getWindow();return win&&!win.isDestroyed()&&event.sender===win.webContents&&event.senderFrame===event.sender.mainFrame&&event.senderFrame.url===trustedURL;};
  for(const [channel,action]of [['postcard-print:list',()=>service.list()],['postcard-print:start',job=>service.print(job)],['postcard-print:pdf',job=>service.savePDF(job)]])ipcMain.handle(channel,async(event,payload)=>{
    if(!allowed(event))return {ok:false,error:'この画面からは印刷できません。'};
    try{const result=await action(payload);return channel.endsWith(':list')?{ok:true,printers:result}:result;}catch(error){return {ok:false,error:error.message};}
  });
  return service;
}
module.exports={printOptions,pdfOptions,printRange,createPrintService,registerPrinting};
