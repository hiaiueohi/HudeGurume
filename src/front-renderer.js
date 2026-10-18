(function(root){
  const C=root.PostcardCore,L=root.FrontLayout;
  function el(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function card(r,state,newyear=true){
    const page=el('div','card front-card'),content=el('div','content');page.append(content);content.style.setProperty('--x',state.offsetX+'mm');content.style.setProperty('--y',state.offsetY+'mm');
    const mode=key=>L.resolve(state.frontLayout,r.id,key).writingMode||(['postal','senderzip'].includes(key)?'horizontal':'vertical');
    const addressText=(key,v)=>mode(key)==='vertical'?C.verticalAddress(v):v||'';
    function block(key,cls,text){const n=el('div',cls,text);n.dataset.layoutElement=key;content.append(n);return n;}
    const postal=block('postal','postal');for(const digit of C.zipDigits(r.zip).padEnd(7,' ').slice(0,7))postal.append(el('span','',digit));
    const address=block('address','address',addressText('address',r.address));if((r.address||'').length>30)address.style.fontSize='11pt';
    block('building','address building',addressText('building',r.building));
    const names=block('names','names'),people=[r.name,...(r.joint||'').split(/\r?\n/).filter(s=>s.trim())];
    for(const name of people){const text=name.trim()+(r.honorific?'　'+r.honorific:'');names.append(el('div','person'+(text.length>13||people.length>2?' small':''),text));}
    if(newyear)block('newyear','newyear',r.yearLabel??'年賀');
    const s=r.senderOverride||state.sender,sender=block('sender','sender');
    sender.append(el('div','',addressText('sender',s.address)),el('div','',addressText('sender',s.building)),el('div','sender-name',s.name||''));
    block('senderzip','senderzip',s.zip?'〒 '+s.zip:'');applyPositions(page,r,state);return page;
  }
  function applyPositions(page,r,state){
    for(const node of page.querySelectorAll('[data-layout-element]')){
      const key=node.dataset.layoutElement,p=L.resolve(state.frontLayout,r.id,key),mode=p.writingMode||(['postal','senderzip'].includes(key)?'horizontal':'vertical');
      node.dataset.writingMode=mode;
      node.style.transform='translate('+p.x+'mm,'+p.y+'mm)';node.style.writingMode=mode==='vertical'?'vertical-rl':'horizontal-tb';node.style.textOrientation='upright';
      if(key==='names'){
        node.style.writingMode='horizontal-tb';node.style.flexDirection=mode==='vertical'?'row-reverse':'column';node.style.fontSize=(p.fontSize||24)+'pt';
        for(const person of node.children){person.style.writingMode=mode==='vertical'?'vertical-rl':'horizontal-tb';if(p.fontSize)person.style.fontSize=p.fontSize+'pt';}
      }else if(p.fontSize){node.style.fontSize=p.fontSize+'pt';if(key==='sender')node.querySelector('.sender-name').style.fontSize=p.fontSize+'pt';}
      if(mode==='horizontal'&&['address','building','names','sender'].includes(key)){node.classList.add('front-horizontal');}
      if(key==='postal'){node.style.flexDirection=mode==='vertical'?'column':'row';node.style.gap=mode==='vertical'?'0':'0.8mm';if(p.fontSize)for(const digit of node.children)digit.style.fontSize=p.fontSize+'pt';}
      if(p.width){node.style.width=p.width+'mm';node.style.maxWidth='none';}
      if(p.height){node.style.height=p.height+'mm';node.style.maxHeight='none';}
    }
  }
  root.FrontRenderer={card,applyPositions};
})(window);
