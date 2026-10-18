(function(root){
  const $=s=>document.querySelector(s),clone=v=>JSON.parse(JSON.stringify(v)),mm=96/25.4;
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
      input.oninput=()=>{const before=capture();content[field.key]=input.value;rebuild();paint();remember(before);};
      label.append(input);container.append(label);
    }
    $('#layoutTextNote').textContent=session.textNote||'文面はこの年賀状に保存します。配置と文字の向きは下で適用先を選べます。';
    $('#layoutTextNote').hidden=!container.children.length;
  }
  function updateControls(){
    const p=draft[selected],node=paper.querySelector('[data-layout-element="'+selected+'"]'),bg=selected==='background';
    $('#layoutSelectedName').textContent=model.names[selected];$('#layoutX').value=p.x;$('#layoutY').value=p.y;
    $('#layoutScaleRow').hidden=!bg;$('#layoutTypography').hidden=bg;
    $('#layoutScale').value=Math.round((p.scale||1)*100);$('#layoutScaleLabel').textContent=Math.round((p.scale||1)*100)+'%';
    if(node&&!bg){const css=getComputedStyle(node),textCSS=getComputedStyle(node.querySelector('.person')||node);$('#layoutWritingMode').value=p.writingMode||node.dataset.writingMode||(css.writingMode.startsWith('vertical')?'vertical':'horizontal');$('#layoutFontSize').value=p.fontSize||Math.round(parseFloat(textCSS.fontSize)*72/96*10)/10;$('#layoutWidth').value=Math.round(parseFloat(css.width)/mm*10)/10;$('#layoutHeight').value=Math.round(parseFloat(css.height)/mm*10)/10;}
    $('#layoutUndo').disabled=!undo.length;$('#layoutRedo').disabled=!redo.length;$('#layoutApply').disabled=!changed();
    const all=$('input[name=layoutScope]:checked').value==='all';
    $('#layoutApply').textContent=all?'全体に適用して保存':'この1枚に保存';
    $('#layoutScopeHint').textContent=all?(session.allHint||'変更した項目の配置・文字の向き・大きさを全6種類にそろえます。'):(session.oneHint||'このデザインの配置・文字の向き・大きさを保存します。');
    for(const button of $('#layoutLayers').querySelectorAll('button')){const active=button.dataset.element===selected;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
    for(const n of paper.querySelectorAll('[data-layout-element]'))n.classList.toggle('layout-selected',n.dataset.layoutElement===selected);
  }
  function rebuild(){paper=session.render(currentLayout(),content);const guide=document.createElement('div');guide.id='layoutCenterGuide';guide.className='layout-center-guide';guide.hidden=true;$('#layoutPaper').replaceChildren(paper,guide);}
  function paint(){session.applyPositions(paper,currentLayout(),content);updateControls();}
  function select(key){if(!paper.querySelector('[data-layout-element="'+key+'"]'))return;selected=key;updateControls();fields();}
  function remember(before){if(JSON.stringify(before)===JSON.stringify(capture()))return;undo.push(before);if(undo.length>50)undo.shift();redo=[];updateControls();status('変更をプレビューしています。適用先を選んで保存してください。');}
  function restore(snapshot){draft=snapshot.draft;content=snapshot.content;rebuild();paint();fields();}
  function undoAction(){if(!undo.length||drag)return;redo.push(capture());restore(undo.pop());status('ひとつ前の編集に戻しました。');}
  function redoAction(){if(!redo.length||drag)return;undo.push(capture());restore(redo.pop());status('編集をやり直しました。');}
  function setZoom(value){zoom=Math.max(.4,Math.min(1.6,value));$('#layoutZoom').value=Math.round(zoom*100);$('#layoutZoomLabel').textContent=Math.round(zoom*100)+'%';$('#layoutPaperWrapper').style.width=100*mm*zoom+'px';$('#layoutPaperWrapper').style.height=148*mm*zoom+'px';$('#layoutPaper').style.transform='scale('+zoom+')';}
  function fit(){if(session){const stage=$('#layoutStage');setZoom(Math.min((stage.clientWidth-58)/(100*mm),(stage.clientHeight-58)/(148*mm),1.6));}}
  function bound(value,property){const limit=property==='x'?100:148;return Math.round(Math.max(-limit,Math.min(limit,value))*100)/100;}
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
    $('#layoutScopeOne').textContent=options.oneLabel||'このデザインだけ';$('#layoutScopeAll').textContent=options.allLabel||'全6種類のデザイン';
    $('input[name=layoutScope][value=one]').checked=true;rebuild();$('#layoutLayers').replaceChildren();
    for(const key of model.elements){const button=document.createElement('button');button.textContent=model.names[key];button.dataset.element=key;button.type='button';button.disabled=!paper.querySelector('[data-layout-element="'+key+'"]');button.onclick=()=>select(key);$('#layoutLayers').append(button);}
    status('文字を選んで編集。ドラッグで移動、右の欄で文字の向きや大きさを変えられます。');
    $('#layoutEditorDialog').showModal();paint();fields();requestAnimationFrame(()=>{fit();$('#layoutLayers button').focus();});
    if(!observer){observer=new ResizeObserver(()=>{if(session&&fitMode)fit();});observer.observe($('#layoutStage'));}
  }
  function init(){
    const dialog=$('#layoutEditorDialog'),stage=$('#layoutPaper');
    $('#layoutClose').onclick=$('#layoutCancel').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{if(dialog.open)return;session=null;drag=null;paper=null;undo=[];redo=[];stage.classList.remove('dragging');});
    stage.addEventListener('pointerdown',beginDrag);stage.addEventListener('pointermove',moveDrag);stage.addEventListener('pointerup',e=>endDrag(e));stage.addEventListener('pointercancel',e=>endDrag(e,true));stage.addEventListener('lostpointercapture',e=>endDrag(e,true));stage.addEventListener('dragstart',e=>e.preventDefault());
    stage.addEventListener('dblclick',event=>{const target=event.target.closest('[data-layout-element]');if(target){select(target.dataset.layoutElement);$('#layoutTextFields input, #layoutTextFields textarea')?.focus();}});
    $('#layoutUndo').onclick=undoAction;$('#layoutRedo').onclick=redoAction;$('#layoutFit').onclick=()=>{fitMode=true;fit();};$('#layoutZoom').oninput=e=>{fitMode=false;setZoom(Number(e.target.value)/100);};
    for(const [id,property,min,max]of [['layoutX','x',-100,100],['layoutY','y',-148,148],['layoutFontSize','fontSize',4,72],['layoutWidth','width',4,100],['layoutHeight','height',4,148]])$('#'+id).onchange=event=>{
      if(!session)return;const value=Number(event.target.value);if(event.target.value===''||!Number.isFinite(value)||value<min||value>max){status('入力できる数値の範囲を確認してください。',true);updateControls();return;}
      const before=capture();draft[selected][property]=Math.round(value*100)/100;if(['fontSize','width','height'].includes(property))rebuild();paint();remember(before);
    };
    $('#layoutWritingMode').onchange=event=>{const before=capture();draft[selected].writingMode=event.target.value;rebuild();paint();remember(before);};
    $('#layoutScale').oninput=event=>{if(!session||selected!=='background')return;const before=capture();draft.background.scale=Number(event.target.value)/100;paint();remember(before);};
    $('#layoutResetSelected').onclick=()=>{const before=capture();draft[selected]={...draft[selected],x:0,y:0,...(selected==='background'?{scale:1}:{})};rebuild();paint();remember(before);};
    for(const radio of dialog.querySelectorAll('input[name=layoutScope]'))radio.onchange=updateControls;
    $('#layoutApply').onclick=()=>{
      if(!session||!changed())return;const scope=$('input[name=layoutScope]:checked').value;
      try{const layout=model.apply(session.layout,session.item.id,model.diff(initial,draft),scope),result=session.onApply(layout,scope,clone(content));if(!result.ok){status(result.error||'変更を保存できませんでした。',true);return;}dialog.close();}catch(error){status(error.message,true);}
    };
    dialog.addEventListener('keydown',event=>{
      if(!session||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoAction():undoAction();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redoAction();return;}
      const direction={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]}[event.key];
      if(direction&&!drag){event.preventDefault();const before=capture();draft[selected][direction[0]]=bound(draft[selected][direction[0]]+direction[1]*(event.shiftKey?2:.5),direction[0]);paint();remember(before);}
    });
  }
  root.DesignLayoutEditor={init,open};
})(window);
