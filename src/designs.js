(function (root) {
  const $ = selector => document.querySelector(selector);
  const native = root.postcardDesigns;
  const key = 'atena-design-project-2027';
  const Layout = root.NengaLayout;
  let catalog = root.NengaCatalog, project, category = 'すべて', started = false;
  let getSender = () => ({}), pendingSave = false, saveTimer, invalidDraft = false;
  let thumbnailObserver;
  function defaults(item = catalog.items[0]) {
    return {year:2027,designId:item.id,headline:item.headline,message:'旧年中は大変お世話になりました\n本年もどうぞよろしくお願いいたします',dateText:'2027年 元旦',showSender:false,headlineSize:item.font==='sans'?13:item.headline.includes('\n')?18:22,messageSize:9,layout:Layout.empty()};
  }
  function say(message,error = false) {
    $('#designSaveStatus').textContent = message;
    $('#designSaveStatus').classList.toggle('error',error);
  }
  function check(value) {
    if (!value || value.year!==2027 || !catalog.items.some(item=>item.id===value.designId)) throw Error('保存されたデザインを確認してください。');
    for (const [field,max] of [['headline',40],['message',150],['dateText',30]]) if (typeof value[field]!=='string'||value[field].length>max) throw Error('文面の長さを確認してください。');
    if(value.headline.split(/\r?\n/).length>2||value.message.split(/\r?\n/).length>3)throw Error('見出しは2行、あいさつ文は3行までにしてください。');
    if(!Number.isFinite(value.headlineSize)||value.headlineSize<10||value.headlineSize>26||!Number.isFinite(value.messageSize)||value.messageSize<7||value.messageSize>11)throw Error('文字サイズを確認してください。');
    if(value.senderText!==undefined&&(typeof value.senderText!=='string'||value.senderText.length>300))throw Error('差出人の文面は300文字までにしてください。');
    return {...value,layout:Layout.validate(value.layout)};
  }
  function selectedItem() {return catalog.items.find(item=>item.id===project.designId);}
  function fillForm() {
    $('#designHeadline').value=project.headline;
    $('#designMessage').value=project.message;
    $('#designDate').value=project.dateText;
    $('#designShowSender').checked=project.showSender;
    $('#designHeadlineSize').value=project.headlineSize;
    $('#designMessageSize').value=project.messageSize;
    $('#headlineSizeLabel').textContent=(Layout.resolve(project.layout,project.designId,'headline').fontSize||project.headlineSize)+'pt';
    $('#messageSizeLabel').textContent=(Layout.resolve(project.layout,project.designId,'message').fontSize||project.messageSize)+'pt';
  }
  function preview() {
    const item=selectedItem();
    $('#designName').textContent=item.name;
    $('#designDescription').textContent=item.description;
    $('#designPreview').replaceChildren(root.DesignRenderer.card(item,project,getSender()));
    document.querySelectorAll('.design-choice').forEach(button=>{
      const active=button.dataset.id===item.id;
      button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active));
    });
    root.dispatchEvent(new Event('postcard-changed'));
  }
  function flush() {
    clearTimeout(saveTimer);
    if (invalidDraft) return false;
    if (!pendingSave) return true;
    try {
      check(project);
      if(native) {
        const response=native.saveProject(project);
        if(!response.ok)throw Error(response.error);
        project=response.project;
      } else localStorage.setItem(key,JSON.stringify(project));
      pendingSave=false;
      say(native?'選んだデザインと文面を自動保存しました':'選んだ内容をブラウザー内に保存しました');
      return true;
    } catch(error) {say('保存できませんでした。'+error.message,true);return false;}
  }
  function changed() {
    invalidDraft=false; pendingSave=true; say('変更を保存しています…');
    clearTimeout(saveTimer); saveTimer=setTimeout(flush,350); preview();
  }
  function choose(id) {
    if(invalidDraft){say('文面の行数を直すか、標準の文面に戻してから絵柄を選んでください。',true);return;}
    const before=selectedItem(), item=catalog.items.find(item=>item.id===id);
    if(!item)return;
    const useDefault=project.headline===before.headline;
    project={...project,designId:id,headline:useDefault?item.headline:project.headline,headlineSize:useDefault?defaults(item).headlineSize:project.headlineSize};
    fillForm(); changed();
  }
  function renderGrid() {
    const items=catalog.items.filter(item=>category==='すべて'||item.category===category);
    $('#designGrid').replaceChildren();
    thumbnailObserver?.disconnect();
    if(!thumbnailObserver)thumbnailObserver=new ResizeObserver(entries=>{for(const {target}of entries){const card=target.querySelector('.card');if(card&&target.clientWidth)card.style.zoom=(target.clientWidth-6)/(100*96/25.4);}});
    for(const item of items) {
      const button=document.createElement('button');button.className='design-choice';button.dataset.id=item.id;
      button.setAttribute('aria-label',item.name+'を選ぶ');
      const figure=document.createElement('div');figure.className='design-thumbnail';
      const useDefault=project.headline===selectedItem().headline;
      const thumbProject={...project,designId:item.id,headline:useDefault?item.headline:project.headline,headlineSize:useDefault?defaults(item).headlineSize:project.headlineSize};
      const image=root.DesignRenderer.card(item,thumbProject,getSender());
      const mark=document.createElement('span');mark.className='choice-mark';mark.textContent='✓';mark.setAttribute('aria-hidden','true');
      figure.append(image,mark);
      const name=document.createElement('strong');name.textContent=item.name;
      const tag=document.createElement('span');tag.className='choice-category';tag.textContent=item.category;
      button.append(figure,name,tag);button.onclick=()=>choose(item.id);$('#designGrid').append(button);
      thumbnailObserver.observe(figure);
    }
    $('#designLibraryCount').textContent=items.length+'種類を表示 / 全'+catalog.items.length+'種類';
    preview();
  }
  function start() {
    if(started)return;
    try {
      if(native){const response=native.list();if(!response.ok)throw Error(response.error);catalog=response.catalog;$('#designFolderLabel').title=response.info.folder;}
      else {$('#openDesignFolder').hidden=true;$('#designFolderLabel').textContent='ブラウザー版：画像保存はダウンロードになります。ドキュメントへの自動保存はデスクトップ版で使えます。';}
      project=defaults();
      try {
        if(native){const response=native.loadProject();if(!response.ok)throw Error(response.error);project=check(response.project);}
        else {const saved=localStorage.getItem(key);if(saved)project=check(JSON.parse(saved));}
      }catch(error){say('文面設定を読み込めませんでした。'+error.message+' 標準の文面を表示しています。',true);}
      started=true; fillForm();renderGrid();
      if(!$('#designSaveStatus').textContent)say('絵柄をクリックして選んでください。変更は自動保存されます。');
    }catch(error){$('#designGrid').textContent='デザインを開けませんでした。'+error.message;say('デザインの保存先を確認してから、アプリを起動し直してください。',true);}
  }
  function updateDraft(event) {
    if(!started)return;
    try {
      const value={...project,headline:$('#designHeadline').value,message:$('#designMessage').value,dateText:$('#designDate').value,
        showSender:$('#designShowSender').checked,headlineSize:Number($('#designHeadlineSize').value),messageSize:Number($('#designMessageSize').value)};
      const element=event?.target.id==='designHeadlineSize'?'headline':event?.target.id==='designMessageSize'?'message':null;
      if(element&&Layout.resolve(value.layout,value.designId,element).fontSize)value.layout=Layout.apply(value.layout,value.designId,{[element]:{fontSize:element==='headline'?value.headlineSize:value.messageSize}},'one');
      check(value);project=value;
      $('#headlineSizeLabel').textContent=(Layout.resolve(project.layout,project.designId,'headline').fontSize||project.headlineSize)+'pt';$('#messageSizeLabel').textContent=(Layout.resolve(project.layout,project.designId,'message').fontSize||project.messageSize)+'pt';
      changed();
    }catch(error){clearTimeout(saveTimer);invalidDraft=true;say(error.message,true);}
  }
  function openLayoutEditor() {
    if(!started||!flush())return;
    const content={headline:project.headline,message:project.message,dateText:project.dateText,senderText:project.senderText??root.DesignRenderer.senderLines(getSender()).join('\n')};
    root.DesignLayoutEditor.open({item:selectedItem(),project:JSON.parse(JSON.stringify(project)),sender:getSender(),content,
      fields:key=>({headline:[{key:'headline',label:'見出し（2行まで）',maxLength:40,rows:2}],message:[{key:'message',label:'あいさつ文（3行まで）',maxLength:150,rows:3}],date:[{key:'dateText',label:'年・日付',maxLength:30}],sender:[{key:'senderText',label:'差出人の文面（この年賀状用）',maxLength:300,rows:4}]})[key]||[],
      onApply:(layout,scope,text)=>{
      const previous=project;
      project={...project,...text,layout};
      if(text.senderText===content.senderText&&previous.senderText===undefined)delete project.senderText;
      try{check(project);}catch(error){project=previous;return {ok:false,error:error.message};}
      pendingSave=true;
      if(!flush()){const error=$('#designSaveStatus').textContent;project=previous;pendingSave=false;preview();return {ok:false,error};}
      renderGrid();
      fillForm();
      say(scope==='all'?'動かした項目の配置を、全6種類に適用しました。':'このデザインだけに配置を適用しました。');
      return {ok:true};
    }});
  }
  async function outputImage() {
    if(!started||!flush())return;
    const button=$('#saveDesignImage');button.disabled=true;
    try {
      const item=selectedItem(), snapshot={...project};
      const dataUrl=await root.DesignRenderer.renderPNG(item,snapshot,getSender());
      if(native){const result=native.saveImage(dataUrl,item.id);if(!result.ok)throw Error(result.error);say('完成画像を「作成した年賀状」フォルダーに保存しました。');}
      else {const link=document.createElement('a');link.download='2027年_'+item.name+'.png';link.href=dataUrl;link.click();say('完成画像をダウンロードしました。');}
    }catch(error){say('画像を保存できませんでした。'+error.message,true);}
    finally{button.disabled=false;}
  }
  async function print() {
    if(!started||!flush())return;
    const copies=Number($('#designCopies').value);
    if(!Number.isInteger(copies)||copies<1||copies>500){say('印刷枚数は1〜500の整数で入力してください。',true);return;}
    const button=$('#printDesign');button.disabled=true;
    try{
      const fragment=document.createDocumentFragment();
      for(let index=0;index<copies;index++){
        fragment.append(root.DesignRenderer.card(selectedItem(),project,getSender()));
      }
      $('#printArea').replaceChildren(fragment);
      await Promise.all([...$('#printArea').querySelectorAll('img')].map(image=>image.decode()));
      await root.PostcardPrinting.open({side:'デザイン面（うら）',count:copies});
    }catch(error){say('印刷の準備ができませんでした。'+error.message,true);}
    finally{button.disabled=false;}
  }
  function init(options) {
    getSender=options.getSender;
    root.DesignLayoutEditor.init();
    $('#designPreview').onclick=$('#openLayoutEditor').onclick=openLayoutEditor;
    $('#designPreview').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openLayoutEditor();}};
    for(const button of $('#designFilters').querySelectorAll('button'))button.onclick=()=>{
      category=button.dataset.category;
      for(const other of $('#designFilters').querySelectorAll('button')){other.classList.toggle('active',other===button);other.setAttribute('aria-pressed',String(other===button));}
      if(started)renderGrid();
    };
    $('#designForm').onsubmit=event=>event.preventDefault();$('#designForm').oninput=updateDraft;
    $('#resetDesignText').onclick=()=>{if(!started)return;project={...defaults(selectedItem()),layout:project.layout};fillForm();changed();};
    $('#saveDesignImage').onclick=outputImage;$('#printDesign').onclick=print;
    $('#openDesignFolder').onclick=async()=>{
      try{const result=await native.openFolder();if(!result.ok)throw Error(result.error);}
      catch(error){say('保存先を開けませんでした。'+error.message,true);}
    };
    root.addEventListener('beforeunload',()=>{if(started)flush();});
  }
  root.PostcardDesignApp={init,refresh:()=>{if(started)preview();},flush,prepare:()=>{start();return started;},review:()=>{if(!started)return null;return {name:selectedItem().name,card:root.DesignRenderer.card(selectedItem(),project,getSender())};},edit:openLayoutEditor,print};
})(window);
