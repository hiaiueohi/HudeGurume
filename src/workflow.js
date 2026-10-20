(function(root){
  const $=s=>document.querySelector(s),stages=['address','design','print'];let stage='address',reviewId=null,initialized=false,refreshing=false,backCopiesEdited=false;
  function message(text){$('#stepDescription').textContent=text;}
  function renderReview(){
    const data=root.PostcardAddressApp.summary(),design=root.PostcardDesignApp.review();if(!design)return;
    const records=data.selected;let index=records.findIndex(r=>r.id===reviewId);if(index<0)index=0;const record=records[index];reviewId=record?.id||null;
    $('#reviewSummary').textContent='印刷する宛先 '+records.length+'人 ・ うら面「'+design.name+'」';
    $('#reviewRecipientLabel').textContent=record?(index+1)+' / '+records.length+'　'+record.name:'宛先がまだ選ばれていません';
    $('#reviewFront').replaceChildren();if(record)$('#reviewFront').append(root.PostcardAddressApp.card(record.id));else{const empty=document.createElement('p');empty.className='review-empty';empty.textContent='①宛先を選ぶ画面で、送る相手にチェックを付けてください。';$('#reviewFront').append(empty);}
    $('#reviewBack').replaceChildren(design.card);$('#reviewDesignName').textContent=design.name;
    $('#reviewFrontHint').textContent=record?'宛先の文字・位置は、この画面から直せます。':'うら面だけを印刷することもできます。';
    $('#reviewPrevious').disabled=!record||index===0;$('#reviewNext').disabled=!record||index===records.length-1;$('#reviewEditFront').disabled=!record;
    $('#reviewFrontCount').textContent='選んだ宛先 '+records.length+'人';updatePrintControls();
    if(!backCopiesEdited)$('#reviewCopies').value=Math.max(1,Math.min(500,records.length));
  }
  function updatePrintControls(){
    const count=root.PostcardAddressApp.summary().selected.length,back=$('input[name=reviewSide]:checked').value==='back';
    $('#reviewCopiesRow').hidden=$('#reviewUseRecipientCount').hidden=!back;$('#reviewUseRecipientCount').disabled=count===0||count>500;
    $('#reviewPrint').disabled=!back&&count===0;$('#reviewPrint').textContent=back?'うら面のプリンター設定へ':'宛名 '+count+'人のプリンター設定へ';
    $('#reviewPrintHint').textContent=back?'うら面は同じデザインを指定枚数だけ印刷します。':count?'チェックした'+count+'人の宛名を1枚ずつ印刷します。':'先に、①の画面で印刷する相手を選んでください。';
  }
  function fit(){
    if(!initialized)return;
    if(stage==='address'){
      const table=$('#addressPane .table-scroll'),top=table.getBoundingClientRect().top,bottom=$('#flowFooter').getBoundingClientRect().top,extra=$('#addressPane .list-footer').getBoundingClientRect().height;
      table.style.maxHeight=Math.max(140,bottom-top-extra-18)+'px';table.style.minHeight='140px';
      const area=$('#preview'),card=area.querySelector('.card');if(card)card.style.zoom=Math.max(.3,Math.min((area.clientWidth-24)/(100*96/25.4),(area.clientHeight-24)/(148*96/25.4),1));
    }
  }
  function refresh(){
    if(!initialized||refreshing)return;refreshing=true;
    try{
      const data=root.PostcardAddressApp.summary(),count=data.selected.length;
      $('#addressStepCount').textContent=count+'人';$('#saveState').textContent=data.ready?'✓ 住所録は自動保存':'住所録の保存先を確認';$('#saveState').classList.toggle('error',!data.ready);
      const copy={address:['まずは、送る相手を選びましょう','宛先を追加し、送る相手にチェックを付けたら「次へ」。'],design:['好きな絵柄を選んで、あいさつを入れましょう','右のはがきをクリックすると、文字や位置を大きく見ながら編集できます。'],print:['表と裏を見て、最後の確認です','印刷する面を選ぶと、プリンターの設定に進めます。']}[stage];
      $('#stepTitle').textContent=copy[0];message(copy[1]);$('#flowFooterTitle').textContent=stage==='address'?(data.total?'印刷する相手：'+count+'人':'まずは宛先を追加しましょう'):stage==='design'?'絵柄と文面を確認したら、仕上がりへ':'表と裏を確認してから、右の印刷ボタンへ';
      $('#flowFooterDescription').textContent=stage==='address'?'名前を選ぶと、おもて面の仕上がりを確認できます。':stage==='design'?'絵柄・あいさつ文は自動で保存されます。':'宛先 '+count+'人を選択中 ・ 最初は1枚だけ試し刷り';
      $('#flowPrevious').hidden=stage==='address';$('#flowNext').hidden=stage==='print';$('#flowNext').textContent=stage==='address'?'次へ：うら面をつくる →':'次へ：仕上がり・印刷 →';
      if(stage==='print')renderReview();
      fit();
    }finally{refreshing=false;}
  }
  function go(next,focus=false){
    if(!stages.includes(next))return false;
    if(stage==='design'&&next!=='design'&&!root.PostcardDesignApp.flush()){message('文面の行数や保存状態を確認してから、次に進んでください。');$('#designTextOptions').open=true;return false;}
    if(next!=='address'&&!root.PostcardDesignApp.prepare())return false;
    stage=next;for(const id of stages){const active=id===stage;$('#'+id+'Pane').hidden=!active;const tab=$('#'+id+'Tab');tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus();}
    refresh();root.scrollTo({top:0,behavior:'instant'});return true;
  }
  function init(){
    initialized=true;
    $('.menu-content').append($('.storage-location'));
    const toolbar=document.createElement('div');toolbar.className='address-search-tools';const search=$('.search-wrap');search.before(toolbar);toolbar.append(search,$('.address-filters'));
    const advanced=document.createElement('details');advanced.className='front-settings';const summary=document.createElement('summary');summary.textContent='年賀の表示・印刷位置などの設定';advanced.append(summary,$('#addressPane .print-panel'));$('#addressPane .preview-column').append(advanced);
    for(const id of stages){const button=$('#'+id+'Tab');button.onclick=()=>go(id);button.onkeydown=e=>{const current=stages.indexOf(stage),index=e.key==='Home'?0:e.key==='End'?2:e.key==='ArrowRight'?(current+1)%3:e.key==='ArrowLeft'?(current+2)%3:null;if(index!==null){e.preventDefault();go(stages[index],true);}};}
    $('#flowNext').onclick=()=>go(stage==='address'?'design':'print');$('#flowPrevious').onclick=()=>go(stage==='print'?'design':'address');
    $('#reviewChooseRecipients').onclick=()=>go('address');$('#reviewChooseDesign').onclick=()=>go('design');$('#reviewSender').onclick=()=>$('#openSender').click();
    $('#reviewEditFront').onclick=()=>{if(reviewId){root.PostcardAddressApp.choose(reviewId);root.PostcardAddressApp.edit();}};$('#reviewEditBack').onclick=()=>root.PostcardDesignApp.edit();
    for(const [id,direction]of [['reviewPrevious',-1],['reviewNext',1]])$('#'+id).onclick=()=>{const records=root.PostcardAddressApp.summary().selected,index=records.findIndex(r=>r.id===reviewId);reviewId=records[index+direction]?.id||reviewId;renderReview();};
    for(const radio of document.querySelectorAll('input[name=reviewSide]'))radio.onchange=updatePrintControls;
    $('#reviewCopies').oninput=()=>{backCopiesEdited=true;};$('#reviewUseRecipientCount').onclick=()=>{backCopiesEdited=false;$('#reviewCopies').value=root.PostcardAddressApp.summary().selected.length;};
    $('#reviewPrint').onclick=async()=>{
      const button=$('#reviewPrint');button.disabled=true;
      try{if($('input[name=reviewSide]:checked').value==='back'){const count=Number($('#reviewCopies').value);if(!Number.isInteger(count)||count<1||count>500){$('#reviewPrintHint').textContent='枚数は1〜500の整数で入力してください。';$('#reviewCopies').focus();return;}$('#designCopies').value=count;await root.PostcardDesignApp.print();}else await root.PostcardAddressApp.print();}finally{updatePrintControls();}
    };
    root.addEventListener('postcard-changed',refresh);root.addEventListener('resize',fit);go('address');
  }
  root.PostcardWorkflow={init,go,refresh,fit};
})(window);
