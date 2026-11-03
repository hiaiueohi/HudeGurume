(async()=>{
 const $=s=>document.querySelector(s),assert=(v,m)=>{if(!v)throw Error(m);};
 const waitFor=async predicate=>{for(let n=0;n<750;n++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Typesetting check timed out: '+$('#printMessage').textContent);};
 const stored=()=>addressBookStorage.load().state;
 // 実際の住所録にありがちな、長い住所・連名・長い団体名・英字の氏名で標準の組版を確かめる。
 const hard=[
  {id:'t1',name:'東海林 慎之介',honorific:'様',joint:'東海林 佐和子\n東海林 真之助\n東海林 さくら',zip:'1008111',address:'東京都千代田区霞が関一丁目2番3号 霞が関コモンゲート西館',building:'グランドメゾン霞が関タワーレジデンス2508号室'},
  {id:'t2',name:'特定非営利活動法人日本年賀状文化振興協会',honorific:'御中',joint:'',zip:'5410041',address:'大阪府大阪市中央区北浜四丁目7番28号 住友ビルディング第二号館',building:'10F'},
  {id:'t3',name:'William Alexander Thompson',honorific:'様',joint:'',zip:'0600042',address:'北海道札幌市中央区大通西15丁目1-20',building:'サンコーポラス大通301'}
 ];
 const plain={records:[],sender:{name:'山田 太郎',zip:'1500001',address:'東京都渋谷区神宮前五丁目52番2号',building:'青山オーバルビル14F'},offsetX:0,offsetY:0};
 const inside=(box,card)=>box.left>=card.left-.5&&box.right<=card.right+.5&&box.top>=card.top-.5&&box.bottom<=card.bottom+.5;
 const overlaps=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
 const stage=document.createElement('div');stage.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden';document.body.append(stage);
 const measured=[];
 // 縦書き（標準）と横書きのどちらでも、項目どうしが重ならないことを確かめる。
 const sideways=FrontLayout.elements.reduce((layout,key)=>FrontLayout.apply(layout,'t1',{[key]:{writingMode:'horizontal'}},'all'),undefined);
 try{
  for(const [record,frontLayout] of [...hard.map(r=>[r,undefined]),...hard.map(r=>[r,sideways])]){
   const card=FrontRenderer.card(record,{...plain,frontLayout},true);stage.replaceChildren(card);
   const page=card.getBoundingClientRect(),boxes=[...card.querySelectorAll('[data-layout-element]')];
   for(const node of boxes){
    const key=node.dataset.layoutElement,box=node.getBoundingClientRect();
    assert(inside(box,page),key+' must stay on the postcard for '+record.name+(frontLayout?' written sideways':''));
    assert(node.scrollWidth<=node.clientWidth+1&&node.scrollHeight<=node.clientHeight+1,key+' must be shrunk until it fits for '+record.name+(frontLayout?' written sideways':''));
   }
   for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)
    assert(!overlaps(boxes[a].getBoundingClientRect(),boxes[b].getBoundingClientRect()),boxes[a].dataset.layoutElement+' and '+boxes[b].dataset.layoutElement+' must not overlap for '+record.name+(frontLayout?' written sideways':''));
   if(frontLayout)continue;
   measured.push({address:[...card.querySelector('.address').children].map(line=>line.textContent),
    nameSize:Math.round(parseFloat(getComputedStyle(card.querySelector('.names')).fontSize)*72/96*10)/10,
    orientation:getComputedStyle(card.querySelector('.person')).textOrientation,
    senderZip:card.querySelector('.senderzip').textContent});
  }
 }finally{stage.remove();}
 assert(measured[0].address.length===2&&measured[0].address[0]==='東京都千代田区霞が関一丁目','A long address breaks before the street number: '+JSON.stringify(measured[0].address));
 assert(measured[0].address[1].startsWith('二番三号'),'The second line starts at the street number: '+measured[0].address[1]);
 assert(measured[0].nameSize<24,'Four joint names are shrunk so they stay clear of the sender: '+measured[0].nameSize);
 assert(measured[2].orientation==='mixed','A Latin name is laid on its side instead of stacked letter by letter');
 assert(measured[0].orientation==='upright','Japanese names stay upright');
 assert(measured[0].senderZip==='〒 150-0001','The sender postal code is printed with its hyphen: '+measured[0].senderZip);
 // 郵便番号の赤枠は、官製はがきの枠と二重にならないよう切り替えられる。
 $('#addressTab').click();
 $('#postalFrame').checked=false;$('#postalFrame').dispatchEvent(new Event('change'));
 assert(getComputedStyle($('#preview .postal span')).outlineStyle==='none','Turning the postal frame off removes the printed frame');
 assert(stored().postalFrame===false,'The postal frame choice is saved with the address book');
 $('#postalFrame').checked=true;$('#postalFrame').dispatchEvent(new Event('change'));
 assert(getComputedStyle($('#preview .postal span')).outlineStyle==='solid'&&stored().postalFrame===true,'The postal frame can be switched back on');
 // 途中から刷り直すための範囲指定と、プリンターがなくても出せるPDF。
 $('#selectAll').checked=true;$('#selectAll').dispatchEvent(new Event('change'));
 const total=stored().records.length;
 $('#print').click();await waitFor(()=>$('#printDialog').open&&!$('#printStart').disabled);
 assert($('#printArea').children.length===total,'Every selected recipient reaches the print area');
 assert($('#printTestOnly').checked&&$('#printPDF').textContent.includes('（'+total+'枚）'),'PDF saves every card even while the test print is on: '+$('#printPDF').textContent);
 $('#printTestOnly').checked=false;$('#printTestOnly').dispatchEvent(new Event('change'));
 $('#printFrom').value='2';$('#printFrom').dispatchEvent(new Event('input'));
 $('#printTo').value='3';$('#printTo').dispatchEvent(new Event('input'));
 assert($('#printStart').textContent.includes('2〜3枚目'),'The button states the chosen range: '+$('#printStart').textContent);
 assert($('#printPreviewPage').textContent.startsWith('2 /'),'The preview starts at the first page of the range');
 assert($('#printPreviewPrevious').disabled,'The preview cannot move before the chosen range');
 $('#printPDF').click();await waitFor(()=>!$('#printMessage').textContent.includes('作成しています'));
 assert($('#printMessage').textContent.includes('保存しました'),'A PDF can be saved without a printer: '+$('#printMessage').textContent);
 $('#printStart').click();await waitFor(()=>$('#printMessage').textContent.includes('送信'));
 assert($('#printMessage').textContent.startsWith('2枚'),'Only the chosen pages are reported as sent: '+$('#printMessage').textContent);
 $('#printCancel').click();
 return {autoFit:true,sidewaysLayout:true,addressLineBreak:true,shrinkJointNames:true,latinNames:true,postalFrameToggle:true,printRange:true,pdfExport:true,samples:hard.length};
})()
