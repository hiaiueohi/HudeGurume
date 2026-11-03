(function(root){
  const $=s=>document.querySelector(s),clone=v=>JSON.parse(JSON.stringify(v)),mm=96/25.4;
  let rangeTarget=null,rangeShown='',pendingRange=null;
  let session=null,model,draft,content,initial,initialContent,selected,undo=[],redo=[],drag=null,zoom=1,fitMode=true,paper,observer;
  const capture=()=>({draft:clone(draft),content:clone(content)});
  const changed=()=>JSON.stringify(initial)!==JSON.stringify(draft)||JSON.stringify(initialContent)!==JSON.stringify(content);
  const currentLayout=()=>model.apply(session.layout,session.item.id,draft,'one');
  function status(text,error=false){$('#layoutEditorMessage').textContent=text;$('#layoutEditorMessage').classList.toggle('error',error);}
  function fields(){
    const container=$('#layoutTextFields');container.replaceChildren();
    for(const field of session.fields?.(selected,content)||[]){
      const label=document.createElement('label');label.textContent=field.label;
      const input=document.createElement(field.rows?'textarea':'input');input.dataset.field=field.key;input.value=content[field.key]||'';input.maxLength=field.maxLength||300;
      if(field.rows)input.rows=field.rows;
      input.oninput=()=>{const before=capture();shiftSizes(field.key,content[field.key],input.value);content[field.key]=input.value;rebuild();paint();remember(before);};
      if(sizeKeys().includes(field.key)){const track=()=>{rangeTarget={key:field.key,start:input.selectionStart,end:input.selectionEnd};updateRangeUI();};for(const type of ['select','keyup','mouseup','focus','input'])input.addEventListener(type,track);}
      label.append(input);container.append(label);
    }
    rangeTarget=null;updateRangeUI();
    $('#layoutTextNote').textContent=session.textNote||'文面はこの年賀状に保存します。配置と文字の向きは下で適用先を選べます。';
    $('#layoutTextNote').hidden=!container.children.length;
  }
  // 文字欄で選んだ部分だけ大きさを変える。宛先ごとに文字の並びが違うので、この宛先だけに保存する。
  const sizeKeys=()=>session?.rangeSizes||[];
  function shiftSizes(key,before,after){
    const ranges=content.textSizes?.[key];if(!ranges)return;
    const next=root.PostcardCore.shiftRanges(before,after,ranges),sizes={...content.textSizes};
    if(next.length)sizes[key]=next;else delete sizes[key];
    content.textSizes=sizes;
  }
  function currentRange(){
    const t=rangeTarget;if(!t||t.end<=t.start||!$('#layoutTextFields [data-field="'+t.key+'"]'))return null;
    return String(content[t.key]||'').slice(t.start,t.end).trim()?t:null;
  }
  function updateRangeUI(){
    const panel=$('#layoutRangeSize');if(!panel)return;
    panel.hidden=!session||!sizeKeys().some(key=>$('#layoutTextFields [data-field="'+key+'"]'));
    if(panel.hidden)return;
    const t=currentRange(),text=t?String(content[t.key]).slice(t.start,t.end):'';
    $('#layoutRangeSelection').textContent=t?'「'+(text.length>14?text.slice(0,14)+'…':text)+'」（'+text.length+'文字）を選択中':'上の文字欄で、大きさを変えたい部分をドラッグして選んでください。';
    $('#layoutRangeSelection').classList.toggle('active',Boolean(t));
    for(const id of ['layoutRangeApply','layoutRangeClear','layoutRangeScale','layoutRangeSmaller','layoutRangeBigger'])$('#'+id).disabled=!t;
    const shown=t?[t.key,t.start,t.end].join(':'):'';
    if(t&&shown!==rangeShown){const r=(content.textSizes?.[t.key]||[]).find(r=>r.start<=t.start&&r.end>=t.end);$('#layoutRangeScale').value=Math.round((r?.scale||1)*100);}
    rangeShown=shown;
    const sized=Object.values(content.textSizes||{}).reduce((n,list)=>n+list.length,0);
    $('#layoutRangeCount').textContent=sized?'大きさを変えた部分：'+sized+'か所':'';
  }
  function setRangeSize(target,scale){
    const before=capture(),sizes={...content.textSizes},next=root.PostcardCore.setRange(sizes[target.key],target.start,target.end,scale);
    if(next.length)sizes[target.key]=next;else delete sizes[target.key];
    content.textSizes=sizes;rebuild();paint();remember(before);rangeShown='';
    const input=$('#layoutTextFields [data-field="'+target.key+'"]');if(input){input.focus();input.setSelectionRange(target.start,target.end);}
    rangeTarget={...target};updateRangeUI();
    status(Math.abs(scale-1)<.001?'選んだ部分を元の大きさに戻しました（この宛先だけ）。':'選んだ部分の文字を'+Math.round(scale*100)+'%の大きさにしました（この宛先だけ）。保存すると反映されます。');
  }
  function requestRangeSize(){
    const t=currentRange(),value=Number($('#layoutRangeScale').value);if(!t)return;
    if(!Number.isFinite(value)||value<30||value>300){status('選んだ部分の大きさは30〜300%で入力してください。',true);return;}
    pendingRange={...t,scale:value/100};
    $('#rangeSizeWarningText').textContent='「'+String(content[t.key]).slice(t.start,t.end)+'」を'+value+'%の大きさにします。';
    $('#rangeSizeWarning').showModal();$('#rangeSizeOK').focus();
  }
  function updateControls(){
    const p=draft[selected],node=paper.querySelector('[data-layout-element="'+selected+'"]'),bg=selected==='background';
    $('#layoutSelectedName').textContent=model.names[selected];$('#layoutX').value=p.x;$('#layoutY').value=p.y;
    $('#layoutScaleRow').hidden=!bg;$('#layoutTypography').hidden=bg;
    $('#layoutEditorDialog .layout-background-note').hidden=!bg;
    $('#layoutScale').value=Math.round((p.scale||1)*100);$('#layoutScaleLabel').textContent=Math.round((p.scale||1)*100)+'%';
    if(node&&!bg){const css=getComputedStyle(node),textCSS=getComputedStyle(node.querySelector('.person')||node);$('#layoutWritingMode').value=p.writingMode||node.dataset.writingMode||(css.writingMode.startsWith('vertical')?'vertical':'horizontal');$('#layoutFontSize').value=p.fontSize||Math.round(parseFloat(textCSS.fontSize)*72/96*10)/10;$('#layoutWidth').value=Math.round(parseFloat(css.width)/mm*10)/10;$('#layoutHeight').value=Math.round(parseFloat(css.height)/mm*10)/10;}
    $('#layoutUndo').disabled=!undo.length;$('#layoutRedo').disabled=!redo.length;$('#layoutApply').disabled=!changed();
    $('#layoutDirtyState').textContent=changed()?'● 未保存の変更があります':'変更なし';$('#layoutDirtyState').classList.toggle('dirty',changed());
    for(const button of $('#layoutWritingButtons').querySelectorAll('button')){const active=button.dataset.writing===$('#layoutWritingMode').value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    const all=$('input[name=layoutScope]:checked').value==='all';
    $('#layoutApply').textContent=all?'全体に適用して保存':'保存して戻る';
    $('#layoutScopeHint').textContent=all?(session.allHint||'変更した項目の配置・文字の向き・大きさを全6種類にそろえます。'):(session.oneHint||'このデザインの配置・文字の向き・大きさを保存します。');
    for(const button of $('#layoutLayers').querySelectorAll('button')){const active=button.dataset.element===selected;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    for(const n of paper.querySelectorAll('[data-layout-element]'))n.classList.toggle('layout-selected',n.dataset.layoutElement===selected);
  }
  function rebuild(){paper=session.render(currentLayout(),content);const guide=document.createElement('div');guide.id='layoutCenterGuide';guide.className='layout-center-guide';guide.hidden=true;$('#layoutPaper').replaceChildren(paper,guide);
    for(const button of $('#layoutLayers').querySelectorAll('button'))button.disabled=!paper.querySelector('[data-layout-element="'+button.dataset.element+'"]');}
  function paint(){session.applyPositions(paper,currentLayout(),content);updateControls();}
  function select(key){if(!paper.querySelector('[data-layout-element="'+key+'"]'))return;selected=key;updateControls();fields();}
  function remember(before){if(JSON.stringify(before)===JSON.stringify(capture()))return;undo.push(before);if(undo.length>50)undo.shift();redo=[];updateControls();status('変更をプレビューしています。適用先を選んで保存してください。');}
  function restore(snapshot){draft=snapshot.draft;content=snapshot.content;rebuild();paint();if(!paper.querySelector('[data-layout-element="'+selected+'"]'))selected=model.elements.find(key=>paper.querySelector('[data-layout-element="'+key+'"]'));updateControls();fields();}
  function undoAction(){if(!undo.length||drag)return;redo.push(capture());restore(undo.pop());status('ひとつ前の編集に戻しました。');}
  function redoAction(){if(!redo.length||drag)return;undo.push(capture());restore(redo.pop());status('編集をやり直しました。');}
  function setZoom(value){zoom=Math.max(.4,Math.min(1.6,value));$('#layoutZoom').value=Math.round(zoom*100);$('#layoutZoomLabel').textContent=Math.round(zoom*100)+'%';$('#layoutPaperWrapper').style.width=100*mm*zoom+'px';$('#layoutPaperWrapper').style.height=148*mm*zoom+'px';$('#layoutPaper').style.transform='scale('+zoom+')';}
  function fit(){if(session){const stage=$('#layoutStage');setZoom(Math.min((stage.clientWidth-58)/(100*mm),(stage.clientHeight-58)/(148*mm),1.6));}}
  function bound(value,property){const limit=property==='x'?100:148;return Math.round(Math.max(-limit,Math.min(limit,value))*100)/100;}
  function nudge(x,y){if(!session||drag)return;const before=capture();draft[selected].x=bound(draft[selected].x+x,'x');draft[selected].y=bound(draft[selected].y+y,'y');paint();remember(before);}
  function requestClose(){if(!session||!changed()){$('#layoutEditorDialog').close();return;}$('#discardEditDialog').showModal();}
  function applyChanges(){
    if(!session||!changed())return;const scope=$('input[name=layoutScope]:checked').value;
    try{const layout=model.apply(session.layout,session.item.id,model.diff(initial,draft),scope),result=session.onApply(layout,scope,clone(content));if(!result.ok){status(result.error||'変更を保存できませんでした。',true);return false;}if($('#discardEditDialog').open)$('#discardEditDialog').close();$('#layoutEditorDialog').close();return true;}catch(error){status(error.message,true);return false;}
  }
  function beginDrag(event){
    if(!session||event.button!==0)return;const target=event.target.closest('[data-layout-element]');if(!target)return;
    event.preventDefault();select(target.dataset.layoutElement);const rect=$('#layoutPaper').getBoundingClientRect();
    drag={pointerId:event.pointerId,key:selected,startX:event.clientX,startY:event.clientY,start:clone(draft[selected]),before:capture(),pixelsX:rect.width/100,pixelsY:rect.height/148};
    try{$('#layoutPaper').setPointerCapture(event.pointerId);}catch(error){}$('#layoutPaper').classList.add('dragging');
  }
  function moveDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;event.preventDefault();
    let dx=(event.clientX-drag.startX)/drag.pixelsX,dy=(event.clientY-drag.startY)/drag.pixelsY;
    if(event.shiftKey){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}
    let x=drag.start.x+dx,y=drag.start.y+dy;if($('#layoutSnap').checked&&!event.altKey){x=Math.round(x*2)/2;y=Math.round(y*2)/2;}if(Math.abs(x)<.3)x=0;
    draft[drag.key]={...draft[drag.key],x:bound(x,'x'),y:bound(y,'y')};paint();$('#layoutCenterGuide').hidden=x!==0;
  }
  function endDrag(event,cancel=false){if(!drag||event.pointerId!==drag.pointerId)return;const previous=drag;drag=null;if(cancel)restore(previous.before);else remember(previous.before);try{$('#layoutPaper').releasePointerCapture(event.pointerId);}catch(error){}$('#layoutPaper').classList.remove('dragging');$('#layoutCenterGuide').hidden=true;paint();}
  function open(options){
    if($('#layoutEditorDialog').open)return;
    session=options;model=options.model||root.NengaLayout;session.layout=options.layout||options.project?.layout;
    content=clone(options.content||{});initialContent=clone(content);initial=model.draft(session.layout,options.item.id);draft=clone(initial);undo=[];redo=[];drag=null;selected=model.elements[0];fitMode=true;
    if(!session.render)session.render=(layout,text)=>root.DesignRenderer.card(options.item,{...options.project,...text,layout},options.sender);
    if(!session.applyPositions)session.applyPositions=(node,layout)=>root.DesignRenderer.applyPositions(node,options.item,{...options.project,...content,layout});
    $('#layoutEditorTitle').textContent=options.item.name+'を編集';
    $('#layoutAdvanced').open=false;$('#layoutPositionDetails').open=false;
    $('#layoutScopeOne').textContent=options.oneLabel||'このデザインだけ';$('#layoutScopeAll').textContent=options.allLabel||'全6種類のデザイン';
    $('input[name=layoutScope][value=one]').checked=true;rebuild();$('#layoutLayers').replaceChildren();
    for(const key of model.elements){const button=document.createElement('button');button.textContent=model.names[key];button.dataset.element=key;button.type='button';button.disabled=!paper.querySelector('[data-layout-element="'+key+'"]');button.onclick=()=>select(key);$('#layoutLayers').append(button);}
    status('文字を選んで編集。ドラッグで移動、右の欄で文字の向きや大きさを変えられます。');
    $('#layoutEditorDialog').showModal();paint();fields();requestAnimationFrame(()=>{fit();$('#layoutLayers button').focus();});
    if(!observer){observer=new ResizeObserver(()=>{if(session&&fitMode)fit();});observer.observe($('#layoutStage'));}
  }
  function init(){
    const dialog=$('#layoutEditorDialog'),stage=$('#layoutPaper');
    $('#layoutPositionDetails').insertAdjacentElement('afterend',$('#layoutScaleRow'));
    $('#layoutClose').onclick=requestClose;$('#layoutCancel').onclick=()=>dialog.close();$('#layoutCancel').textContent='変更を破棄して戻る';
    dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
    dialog.addEventListener('close',()=>{if(dialog.open)return;if($('#discardEditDialog').open)$('#discardEditDialog').close();session=null;drag=null;paper=null;undo=[];redo=[];stage.classList.remove('dragging');});
    $('#keepEditing').onclick=()=>$('#discardEditDialog').close();$('#discardEditing').onclick=()=>{$('#discardEditDialog').close();dialog.close();};$('#saveEditing').onclick=()=>{if(!applyChanges())$('#discardEditDialog').close();};
    stage.addEventListener('pointerdown',beginDrag);stage.addEventListener('pointermove',moveDrag);stage.addEventListener('pointerup',e=>endDrag(e));stage.addEventListener('pointercancel',e=>endDrag(e,true));stage.addEventListener('lostpointercapture',e=>endDrag(e,true));stage.addEventListener('dragstart',e=>e.preventDefault());
    stage.addEventListener('dblclick',event=>{const target=event.target.closest('[data-layout-element]');if(target){select(target.dataset.layoutElement);$('#layoutTextFields input, #layoutTextFields textarea')?.focus();}});
    $('#layoutUndo').onclick=undoAction;$('#layoutRedo').onclick=redoAction;$('#layoutFit').onclick=()=>{fitMode=true;fit();};$('#layoutZoom').oninput=e=>{fitMode=false;setZoom(Number(e.target.value)/100);};
    for(const [id,property,min,max]of [['layoutX','x',-100,100],['layoutY','y',-148,148],['layoutFontSize','fontSize',4,72],['layoutWidth','width',4,100],['layoutHeight','height',4,148]])$('#'+id).onchange=event=>{
      if(!session)return;const value=Number(event.target.value);if(event.target.value===''||!Number.isFinite(value)||value<min||value>max){status('入力できる数値の範囲を確認してください。',true);updateControls();return;}
      const before=capture();draft[selected][property]=Math.round(value*100)/100;if(['fontSize','width','height'].includes(property))rebuild();paint();remember(before);
    };
    $('#layoutWritingMode').onchange=event=>{const before=capture();draft[selected].writingMode=event.target.value;rebuild();paint();remember(before);};
    for(const button of $('#layoutWritingButtons').querySelectorAll('button'))button.onclick=()=>{$('#layoutWritingMode').value=button.dataset.writing;$('#layoutWritingMode').dispatchEvent(new Event('change'));};
    for(const button of dialog.querySelectorAll('[data-nudge]'))button.onclick=event=>{const directions={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]},[x,y]=directions[button.dataset.nudge];nudge(x*(event.shiftKey?5:1),y*(event.shiftKey?5:1));};
    $('#layoutCenterHorizontal').onclick=()=>{const target=paper.querySelector('[data-layout-element="'+selected+'"]');if(!target)return;const box=target.getBoundingClientRect(),base=paper.getBoundingClientRect(),delta=50-(box.left-base.left+box.width/2)/(base.width/100);nudge(delta,0);};
    $('#layoutScale').oninput=event=>{if(!session||selected!=='background')return;const before=capture();draft.background.scale=Number(event.target.value)/100;paint();remember(before);};
    $('#layoutResetSelected').onclick=()=>{const before=capture();draft[selected]={...draft[selected],x:0,y:0,...(selected==='background'?{scale:1}:{})};rebuild();paint();remember(before);};
    for(const radio of dialog.querySelectorAll('input[name=layoutScope]'))radio.onchange=updateControls;
    $('#layoutApply').onclick=applyChanges;
    $('#layoutRangeApply').onclick=requestRangeSize;
    $('#layoutRangeClear').onclick=()=>{const t=currentRange();if(t)setRangeSize(t,1);};
    for(const [id,step]of [['layoutRangeSmaller',-10],['layoutRangeBigger',10]])$('#'+id).onclick=()=>{$('#layoutRangeScale').value=Math.max(30,Math.min(300,(Number($('#layoutRangeScale').value)||100)+step));};
    $('#rangeSizeCancel').onclick=()=>{pendingRange=null;$('#rangeSizeWarning').close();};
    $('#rangeSizeOK').onclick=()=>{const target=pendingRange;pendingRange=null;$('#rangeSizeWarning').close();if(target&&session)setRangeSize(target,target.scale);};
    dialog.addEventListener('keydown',event=>{
      if(!session)return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();applyChanges();return;}
      if(/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoAction():undoAction();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redoAction();return;}
      const direction={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]}[event.key];
      if(direction&&!drag){event.preventDefault();const before=capture();draft[selected][direction[0]]=bound(draft[selected][direction[0]]+direction[1]*(event.shiftKey?2:.5),direction[0]);paint();remember(before);}
    });
  }
  root.DesignLayoutEditor={init,open};
})(window);
