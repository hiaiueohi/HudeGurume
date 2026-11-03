(async()=>{
 const $=s=>document.querySelector(s),assert=(v,m)=>{if(!v)throw Error(m);};
 const stored=()=>addressBookStorage.load().state;
 const row=()=>[...document.querySelectorAll('#list .entry')].find(r=>r.textContent.includes(target.name));
 const target=stored().records[0];assert(target,'The memo check needs a recipient');
 $('#search').value='';$('#search').dispatchEvent(new Event('input'));
 const button=()=>row().querySelector('.memo-button'),edit=row().querySelector('.edit-button');
 assert(button()&&button().textContent==='メモを開く'&&edit.nextElementSibling===button(),'The memo button sits beside the edit button');
 assert(!button().classList.contains('has-memo'),'A recipient without a memo is not marked');
 button().click();assert($('#memoDialog').open&&$('#memoTitle').textContent.includes(target.name),'The memo dialog opens for that recipient');
 const text='2026年 喪中はがきが届いた\n来年は寒中見舞いにする';
 $('#memoText').value=text;$('#memoText').dispatchEvent(new Event('input'));assert($('#memoCount').textContent.startsWith(text.length+' / '),'The memo shows its length');
 $('#memoSave').click();assert(!$('#memoDialog').open,'Saving closes the memo');
 assert(stored().records.find(r=>r.id===target.id).memo===text,'The memo is saved in the address book');
 assert(button().classList.contains('has-memo')&&button().title.includes('喪中'),'A recipient with a memo is marked in the list');
 edit.click();$('#recipient').elements.building.value='メモ確認ハイツ';$('#saveRecipient').click();
 assert(stored().records.find(r=>r.id===target.id).memo===text,'Editing the address keeps the memo');
 $('#search').value='寒中見舞い';$('#search').dispatchEvent(new Event('input'));
 assert(document.querySelectorAll('#list .entry').length===1&&row(),'Search finds recipients by memo');
 $('#search').value='';$('#search').dispatchEvent(new Event('input'));
 button().click();$('#memoText').value='書き換え中';$('#memoDialog').querySelector('[data-close="memoDialog"]:not(.icon-button)').click();
 assert(stored().records.find(r=>r.id===target.id).memo===text,'Cancel keeps the saved memo');
 const confirmBefore=window.confirm;window.confirm=()=>true;
 try{button().click();$('#memoClear').click();}finally{window.confirm=confirmBefore;}
 assert(!('memo' in stored().records.find(r=>r.id===target.id))&&!button().classList.contains('has-memo'),'Clearing removes the memo');
 return {besideEdit:true,save:true,marker:true,keptOnEdit:true,search:true,cancel:true,clear:true};
})()
