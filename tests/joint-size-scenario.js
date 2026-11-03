(async()=>{
 const $=s=>document.querySelector(s),assert=(v,m)=>{if(!v)throw Error(m);},change=(id,value)=>{const n=$('#'+id);n.value=value;n.dispatchEvent(new Event('change'));};
 const stored=()=>addressBookStorage.load().state,box=key=>$('#layoutPaper [data-layout-element="'+key+'"]').getBoundingClientRect();
 const typeInto=(key,value)=>{const n=$('#layoutTextFields [data-field="'+key+'"]');n.value=value;n.dispatchEvent(new Event('input'));return n;};
 const choose=(key,start,end)=>{const n=$('#layoutTextFields [data-field="'+key+'"]');n.focus();n.setSelectionRange(start,end);n.dispatchEvent(new Event('select'));};
 $('#search').value='';$('#search').dispatchEvent(new Event('input'));
 $('#list .person-button').click();const before=stored(),target=before.records.find(r=>r.name===$('#list .entry.active .person-button').textContent),other=before.records.find(r=>r.id!==target.id);
 $('#openFrontLayoutEditor').click();assert($('#layoutEditorDialog').open,'The address-side editor opens');
 // 連名を入力すると、氏名とは別に動かせる「連名」の枠ができる。
 assert($('#layoutLayers [data-element=joint]').disabled===!target.joint,'The joint layer is only offered when there are joint names');
 typeInto('joint','山田 花子\n山田 一郎');
 assert(!$('#layoutLayers [data-element=joint]').disabled&&$('#layoutPaper [data-layout-element=joint]').children.length===2,'Typing joint names creates a separate joint block');
 assert(!$('#layoutPaper [data-layout-element=names]').textContent.includes('花子'),'Joint names are no longer inside the main name block');
 $('#layoutLayers [data-element=joint]').click();assert($('#layoutSelectedName').textContent==='連名','The joint block can be selected on its own');
 const namesBefore=box('names'),jointBefore=box('joint');
 change('layoutX','-6');change('layoutY','5');
 const namesAfter=box('names'),jointAfter=box('joint');
 assert(Math.abs(namesAfter.left-namesBefore.left)<.5&&Math.abs(namesAfter.top-namesBefore.top)<.5,'Moving the joint names leaves the main name in place');
 assert(jointAfter.left<jointBefore.left-10&&jointAfter.top>jointBefore.top+10,'The joint names move by themselves');
 // カーソルで選んだ部分だけ大きさを変える。全体に適用を選んでいても、警告のうえこの宛先だけに保存する。
 $('#layoutLayers [data-element=names]').click();
 assert(!$('#layoutRangeSize').hidden&&$('#layoutRangeApply').disabled,'The partial size panel waits for a selection');
 const name=$('#layoutTextFields [data-field=name]').value;choose('name',0,1);
 assert(!$('#layoutRangeApply').disabled&&$('#layoutRangeSelection').textContent.includes('「'+name[0]+'」'),'The selected characters are shown');
 for(let n=0;n<5;n++)$('#layoutRangeBigger').click();
 assert($('#layoutRangeScale').value==='150','The plus button raises the size in 10% steps');
 $('#layoutRangeApply').click();assert($('#rangeSizeWarning').open&&$('#rangeSizeWarning').textContent.includes('この宛先だけ'),'A warning explains it only applies to this recipient');
 $('#rangeSizeCancel').click();assert(!$('#rangeSizeWarning').open&&!$('#layoutPaper .sized-text'),'Cancel leaves the text unchanged');
 $('#layoutRangeApply').click();$('#rangeSizeOK').click();
 const sized=$('#layoutPaper [data-layout-element=names] .sized-text');
 assert(sized&&sized.textContent===name[0]&&sized.style.fontSize==='1.5em','OK enlarges only the selected character');
 typeInto('name','新'+name);assert($('#layoutPaper [data-layout-element=names] .sized-text').textContent===name[0],'Typing before the selection keeps the size on the same character');
 typeInto('name',name);
 document.querySelector('input[name=layoutScope][value=all]').click();$('#layoutApply').click();
 assert(!$('#layoutEditorDialog').open,'Saving closes the editor: '+$('#layoutEditorMessage').textContent);
 const saved=stored(),record=saved.records.find(r=>r.id===target.id),otherSaved=saved.records.find(r=>r.id===other.id);
 assert(JSON.stringify(record.textSizes)===JSON.stringify({name:[{start:0,end:1,scale:1.5}]}),'The partial size is stored on this recipient: '+JSON.stringify(record.textSizes));
 assert(!otherSaved.textSizes,'Other recipients never receive the partial size even when applying to everyone');
 assert(FrontLayout.resolve(saved.frontLayout,other.id,'joint').x===-6,'The joint position itself can still be applied to everyone');
 assert($('#preview .sized-text')?.textContent===name[0],'The main preview shows the enlarged character');
 // 元に戻す：選んだ部分を100%に戻すと、保存データから消える。
 $('#openFrontLayoutEditor').click();choose('name',0,1);assert($('#layoutRangeScale').value==='150','The current size of a sized selection is shown');
 $('#layoutRangeClear').click();assert(!$('#layoutPaper .sized-text'),'Reset returns the selection to the normal size');
 typeInto('joint',target.joint||'');
 $('#layoutApply').click();
 const restored=stored();assert(!restored.records.find(r=>r.id===target.id).textSizes,'Resetting removes the stored partial size');
 return {jointSeparate:true,jointMovesAlone:true,partialSize:true,warning:true,cancel:true,keptWhileTyping:true,oneRecipientOnly:true,reset:true};
})()
