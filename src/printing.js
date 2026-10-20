(function(root){
  const $=s=>document.querySelector(s),native=root.postcardPrinter;let job=null,busy=false,token=0,pageIndex=0;
  function say(text,error=false){$('#printMessage').textContent=text;$('#printMessage').classList.toggle('error',error);}
  function preview(){
    if(!job)return;const test=$('#printTestOnly').checked,count=test?1:job.count;pageIndex=Math.max(0,Math.min(count-1,pageIndex));const source=$('#printArea').children[pageIndex];
    $('#printJobPreview').replaceChildren();if(source)$('#printJobPreview').append(source.cloneNode(true));
    $('#printPreviewPage').textContent=test?'試し刷り：最初の1枚':(pageIndex+1)+' / '+count+'枚';$('#printPreviewPrevious').disabled=busy||pageIndex===0;$('#printPreviewNext').disabled=busy||pageIndex===count-1;
  }
  function update(){const test=$('#printTestOnly').checked,count=test?1:job?.count;$('#printStart').textContent=test?'まず1枚だけ試し刷り':(count||1)+'枚を印刷する';$('#printStart').disabled=busy||!$('#printerSelect').value;preview();}
  async function refresh(){
    if(!job||busy)return;const current=++token,previous=$('#printerSelect').value;$('#printerSelect').replaceChildren();$('#printStart').disabled=true;$('#refreshPrinters').disabled=true;say('プリンターを確認しています…');
    try{const result=await native.list();if(current!==token||!job)return;if(!result.ok)throw Error(result.error);
      for(const p of result.printers){const option=document.createElement('option');option.value=p.name;option.textContent=p.displayName+(p.isDefault?'（通常使うプリンター）':'');$('#printerSelect').append(option);}
      if(result.printers.some(p=>p.name===previous))$('#printerSelect').value=previous;else if(result.printers.some(p=>p.isDefault))$('#printerSelect').value=result.printers.find(p=>p.isDefault).name;
      say(result.printers.length?'印刷するプリンターを確認してください。':'プリンターが見つかりません。接続してWindowsにプリンターを追加し、「再読み込み」を押してください。',!result.printers.length);update();
    }catch(error){if(current===token)say('一覧を取得できませんでした。'+error.message,true);}finally{if(current===token)$('#refreshPrinters').disabled=false;}
  }
  async function open(options){
    if(busy||$('#printDialog').open)return;
    await document.fonts.ready;await Promise.all([...$('#printArea').querySelectorAll('img')].map(image=>image.decode()));
    if(!native){root.print();return;}
    job={...options};pageIndex=0;$('#printJobSummary').textContent=options.side+' ・ 全'+options.count+'枚';$('#printTestOnly').checked=true;$('#printDriverDialog').checked=false;$('#printColor').checked=true;
    $('#printTestOnly').closest('label').hidden=options.count===1;preview();$('#printDialog').showModal();await refresh();
  }
  function init(){
    const dialog=$('#printDialog');$('#printCancel').onclick=$('#printClose').onclick=()=>{if(!busy)dialog.close();};
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{if(dialog.open)return;job=null;token++;});
    $('#refreshPrinters').onclick=refresh;$('#printerSelect').onchange=$('#printTestOnly').onchange=update;
    $('#printPreviewPrevious').onclick=()=>{pageIndex--;preview();};$('#printPreviewNext').onclick=()=>{pageIndex++;preview();};
    $('#printStart').onclick=async()=>{
      if(busy||!job||!$('#printerSelect').value)return;busy=true;update();
      for(const id of ['printClose','printCancel','refreshPrinters','printerSelect','printTestOnly','printColor','printDriverDialog'])$('#'+id).disabled=true;
      say('印刷処理中です…');
      try{const result=await native.print({deviceName:$('#printerSelect').value,count:job.count,testOnly:$('#printTestOnly').checked,color:$('#printColor').checked,driverDialog:$('#printDriverDialog').checked});if(!result.ok)throw Error(result.error);say(result.count+'枚をプリンターに送信しました。出力を確認してください。');$('#printTestOnly').checked=false;}
      catch(error){say(error.message,true);}finally{busy=false;for(const id of ['printClose','printCancel','refreshPrinters','printerSelect','printTestOnly','printColor','printDriverDialog'])$('#'+id).disabled=false;update();}
    };
  }
  root.PostcardPrinting={init,open};
})(window);
