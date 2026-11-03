(function(root){
  const $=s=>document.querySelector(s),native=root.postcardPrinter;let job=null,busy=false,token=0,pageIndex=0;
  const controls=['printClose','printCancel','refreshPrinters','printerSelect','printTestOnly','printColor','printDriverDialog','printFrom','printTo','printPDF'];
  function say(text,error=false){$('#printMessage').textContent=text;$('#printMessage').classList.toggle('error',error);}
  // 試し刷りは常に1枚目。範囲を指定した場合はその範囲だけを送る。
  // PDFは試し刷りの設定に関係なく、指定した範囲（指定がなければ全枚）を保存する。
  function range(forPDF=false){
    if(!job)return {from:1,to:1};
    if(!forPDF&&$('#printTestOnly').checked)return {from:1,to:1};
    const limit=job.count,read=(id,fallback)=>{const value=Number($('#'+id).value);return Number.isInteger(value)&&value>=1&&value<=limit?value:fallback;};
    const from=read('printFrom',1);return {from,to:Math.max(from,read('printTo',limit))};
  }
  function preview(){
    if(!job)return;const {from,to}=range();pageIndex=Math.max(from-1,Math.min(to-1,pageIndex));const source=$('#printArea').children[pageIndex];
    $('#printJobPreview').replaceChildren();if(source)$('#printJobPreview').append(source.cloneNode(true));
    $('#printPreviewPage').textContent=$('#printTestOnly').checked?'試し刷り：最初の1枚':(pageIndex+1)+' / '+job.count+'枚';
    $('#printPreviewPrevious').disabled=busy||pageIndex<=from-1;$('#printPreviewNext').disabled=busy||pageIndex>=to-1;
  }
  function update(){
    if(!job)return;const test=$('#printTestOnly').checked,{from,to}=range(),pages=to-from+1;
    $('#printRangeDetails').hidden=job.count===1;$('#printRangeDetails').classList.toggle('disabled',test);
    for(const id of ['printFrom','printTo'])$('#'+id).disabled=busy||test;
    $('#printRangeTotal').textContent='（全'+job.count+'枚）';
    $('#printRangeHint').textContent=test?'試し刷りのチェックを外すと、範囲を指定できます。PDFは全枚を保存します。':pages+'枚（'+from+'枚目から'+to+'枚目まで）を印刷します。';
    $('#printStart').textContent=test?'まず1枚だけ試し刷り':pages===job.count?pages+'枚を印刷する':from+'〜'+to+'枚目（'+pages+'枚）を印刷';
    const pdf=range(true);$('#printPDF').textContent='PDFとして保存（'+(pdf.to-pdf.from+1)+'枚）';
    $('#printStart').disabled=busy||!$('#printerSelect').value;$('#printPDF').disabled=busy;
    preview();
  }
  async function refresh(){
    if(!job||busy)return;const current=++token,previous=$('#printerSelect').value;$('#printerSelect').replaceChildren();$('#printStart').disabled=true;$('#refreshPrinters').disabled=true;say('プリンターを確認しています…');
    try{const result=await native.list();if(current!==token||!job)return;if(!result.ok)throw Error(result.error);
      for(const p of result.printers){const option=document.createElement('option');option.value=p.name;option.textContent=p.displayName+(p.isDefault?'（通常使うプリンター）':'');$('#printerSelect').append(option);}
      if(result.printers.some(p=>p.name===previous))$('#printerSelect').value=previous;else if(result.printers.some(p=>p.isDefault))$('#printerSelect').value=result.printers.find(p=>p.isDefault).name;
      say(result.printers.length?'印刷するプリンターを確認してください。':'プリンターが見つかりません。接続してWindowsにプリンターを追加して「再読み込み」を押すか、「PDFとして保存」をお使いください。',!result.printers.length);update();
    }catch(error){if(current===token)say('一覧を取得できませんでした。'+error.message,true);}finally{if(current===token)$('#refreshPrinters').disabled=false;}
  }
  async function open(options){
    if(busy||$('#printDialog').open)return;
    await document.fonts.ready;await Promise.all([...$('#printArea').querySelectorAll('img')].map(image=>image.decode()));
    if(!native){root.print();return;}
    job={...options};pageIndex=0;$('#printJobSummary').textContent=options.side+' ・ 全'+options.count+'枚';
    $('#printTestOnly').checked=true;$('#printDriverDialog').checked=false;$('#printColor').checked=true;
    $('#printRangeDetails').open=false;for(const [id,value]of [['printFrom',1],['printTo',options.count]]){$('#'+id).max=options.count;$('#'+id).value=value;}
    $('#printTestOnly').closest('label').hidden=options.count===1;update();$('#printDialog').showModal();await refresh();
  }
  function lock(on){busy=on;for(const id of controls)$('#'+id).disabled=on;update();}
  async function send(action,extra,message){
    if(busy||!job)return;lock(true);say(message);
    const {from,to}=range();
    try{const result=await action({count:job.count,testOnly:$('#printTestOnly').checked,from,to,color:$('#printColor').checked,driverDialog:$('#printDriverDialog').checked,...extra});
      if(!result.ok)throw Error(result.error);return result;}
    catch(error){say(error.message,true);}finally{lock(false);}
  }
  function init(){
    const dialog=$('#printDialog');$('#printCancel').onclick=$('#printClose').onclick=()=>{if(!busy)dialog.close();};
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{if(dialog.open)return;job=null;token++;});
    $('#refreshPrinters').onclick=refresh;$('#printerSelect').onchange=$('#printTestOnly').onchange=update;
    for(const id of ['printFrom','printTo'])$('#'+id).oninput=()=>{pageIndex=range().from-1;update();};
    $('#printPreviewPrevious').onclick=()=>{pageIndex--;preview();};$('#printPreviewNext').onclick=()=>{pageIndex++;preview();};
    $('#printStart').onclick=async()=>{
      if(!$('#printerSelect').value)return;
      const result=await send(request=>native.print({deviceName:$('#printerSelect').value,...request}),{},'印刷処理中です…');
      if(result){say(result.count+'枚をプリンターに送信しました。出力を確認してください。');$('#printTestOnly').checked=false;$('#printFrom').value=result.to<job.count?result.to+1:1;update();}
    };
    $('#printPDF').onclick=async()=>{
      const {from,to}=range(true);
      const result=await send(request=>native.savePDF(request),{testOnly:false,from,to,suggestedName:(job.name||'はがき')+'.pdf'},'PDFを作成しています…');
      if(result)say(result.count+'枚分をPDFに保存しました。'+result.filePath);
    };
  }
  root.PostcardPrinting={init,open};
})(window);
