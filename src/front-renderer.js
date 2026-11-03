(function(root){
  const C=root.PostcardCore,L=root.FrontLayout;
  // 宛名面の標準の枠（mm）と標準の文字サイズ（pt）。長い住所・多い連名・長い差出人でも
  // 隣の項目に重ならないよう、それぞれの枠に収まるところまで文字を自動で小さくする。
  const BOX={
    address:{width:19,height:100,size:14,min:8,horizontal:{width:62,height:14}},
    building:{width:10,height:95,size:12,min:7,horizontal:{width:62,height:10}},
    names:{width:31,height:88,size:24,min:10,horizontal:{width:72,height:28}},
    joint:{width:17,height:88,size:24,min:8,horizontal:{width:72,height:17}},
    sender:{width:19,height:56,size:9,min:5,horizontal:{width:70,height:18}},
    senderzip:{width:34,height:6,size:9,min:6,horizontal:{width:34,height:6}},
    newyear:{width:9,height:26,size:11,min:7,horizontal:{width:24,height:9}},
    postal:{size:14,min:9}
  };
  // 連名があるときは、氏名の枠の左側（横書きでは下側）を連名の枠として分ける。
  const NAMES_WITH_JOINT={width:13,horizontal:{width:72,height:12}};
  // 縦書きの日本語は文字を立てるが、英字の氏名や住所は横に寝かせるのが宛名の通例。
  const orientation=text=>/[A-Za-z]{3,}/.test(text||'')?'mixed':'upright';
  function el(tag,cls,text){const n=document.createElement(tag);n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  const blank=c=>/\s/.test(c);
  function trimmed(text,from,to){while(from<to&&blank(text[from]))from++;while(to>from&&blank(text[to-1]))to--;return [from,to];}
  // 文字の一部だけ大きさを変えた範囲を、周りの文字に対する倍率（em）で組む。自動縮小しても比率は保たれる。
  function rich(text,ranges,from=0,to=text.length,transform=v=>v){
    const fragment=document.createDocumentFragment(),cuts=new Set([from,to]);
    const usable=(ranges||[]).filter(r=>r.start<to&&r.end>from);
    for(const r of usable){if(r.start>from)cuts.add(r.start);if(r.end<to)cuts.add(r.end);}
    const points=[...cuts].sort((a,b)=>a-b);
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],piece=transform(text.slice(a,b));if(!piece)continue;
      const hit=usable.find(r=>r.start<=a&&r.end>=b);
      if(hit){const span=el('span','sized-text',piece);span.style.fontSize=hit.scale+'em';fragment.append(span);}
      else fragment.append(document.createTextNode(piece));
    }
    return fragment;
  }
  // 宛名の住所は「町名まで」と「番地以降」の2行に分けるのが通例。1行に収まらないときだけ分ける。
  function splitAddress(value){
    const text=String(value||''),[from,to]=trimmed(text,0,text.length),body=text.slice(from,to);
    const space=body.search(/[\s　]/),number=body.search(/[0-9０-９]/);
    const at=space>0&&(number<0||space<number)?space:number;
    if(at<=0||at>=body.length-1)return [[from,to]];
    return [trimmed(text,from,from+at),trimmed(text,from+at,to)];
  }
  // 各行は {text, ranges, from, to, transform}。複数行のときは2行目以降を字下げする。
  function setLines(node,lines){
    node.replaceChildren(...lines.filter(line=>line.to>line.from).map((line,index)=>{
      const div=el('div','address-line'+(index?' address-continued':''));div.append(rich(line.text,line.ranges,line.from,line.to,line.transform));return div;
    }));
  }
  const whole=(text,ranges,transform)=>{text=String(text||'');const [from,to]=trimmed(text,0,text.length);return {text,ranges,from,to,transform};};
  function person(text,ranges,from,to,honorific){
    const node=el('div','person');node.append(rich(text,ranges,from,to));if(honorific)node.append('　'+honorific);return node;
  }
  function jointLines(text){
    const out=[];let at=0;text=String(text||'');
    for(const line of text.split('\n')){const [from,to]=trimmed(text,at,at+line.length);if(to>from)out.push([from,to]);at+=line.length+1;}
    return out;
  }
  function card(r,state,newyear=true){
    const page=el('div','card front-card'),content=el('div','content');page.append(content);content.style.setProperty('--x',state.offsetX+'mm');content.style.setProperty('--y',state.offsetY+'mm');
    const sizes=r.textSizes||{};
    const mode=key=>writingMode(state,r,key);
    const transform=key=>mode(key)==='vertical'?C.verticalAddress:v=>v;
    function block(key,cls){const n=el('div',cls);n.dataset.layoutElement=key;content.append(n);return n;}
    const postal=block('postal','postal'+(state.postalFrame===false?' no-frame':''));for(const digit of C.zipDigits(r.zip).padEnd(7,' ').slice(0,7))postal.append(el('span','',digit));
    const address=block('address','address');address.richSource={...whole(r.address,sizes.address),key:'address'};setLines(address,[{...address.richSource,transform:transform('address')}]);
    const building=block('building','address building');building.append(rich(String(r.building||''),sizes.building,0,String(r.building||'').length,transform('building')));
    const names=block('names','names'),name=String(r.name||''),[nameFrom,nameTo]=trimmed(name,0,name.length);
    names.append(person(name,sizes.name,nameFrom,nameTo,r.honorific));
    const joints=jointLines(r.joint);
    if(joints.length){const joint=block('joint','names joint');for(const [from,to]of joints)joint.append(person(String(r.joint),sizes.joint,from,to,r.honorific));}
    if(newyear){const label=String(r.yearLabel??'年賀'),year=block('newyear','newyear');year.append(rich(label,sizes.yearLabel));}
    const s=r.senderOverride||state.sender,sender=block('sender','sender');
    const senderAddress=el('div','sender-address');setLines(senderAddress,[whole(s.address,sizes.senderAddress,transform('sender')),whole(s.building,sizes.senderBuilding,transform('sender'))]);
    const senderName=el('div','sender-name');senderName.append(rich(String(s.name||''),sizes.senderName));
    sender.append(senderAddress,senderName);
    const senderzip=block('senderzip','senderzip');senderzip.textContent=s.zip?'〒 '+C.formatZip(s.zip):'';
    applyPositions(page,r,state);return page;
  }
  // 連名は向きを指定していなければ氏名と同じ向きにそろえる。
  function writingMode(state,r,key){
    const own=L.resolve(state.frontLayout,r.id,key).writingMode;if(own)return own;
    if(key==='joint')return writingMode(state,r,'names');
    return ['postal','senderzip'].includes(key)?'horizontal':'vertical';
  }
  // 枠からはみ出すかどうかは実際に組んでみないと分からないため、画面外の計測用の場所で測る。
  let host;
  function measureHost(){
    if(!host||!host.isConnected){host=el('div','card-measure');host.id='cardMeasure';document.body.append(host);}
    return host;
  }
  const fits=node=>node.scrollWidth<=node.clientWidth+1&&node.scrollHeight<=node.clientHeight+1;
  function shrinkToFit(node,max,min){
    node.style.fontSize=max+'pt';
    let size=max;
    for(let step=0;step<60&&size>min&&!fits(node);step++){
      size=Math.max(min,Math.round(size*9.4)/10);
      node.style.fontSize=size+'pt';
    }
    return size;
  }
  function fit(page){
    const detached=!page.isConnected;
    if(detached)measureHost().append(page);
    try{
      for(const node of page.querySelectorAll('[data-layout-element]')){
        const key=node.dataset.layoutElement,box=BOX[key];
        if(!box||!box.width)continue;
        const max=Number(node.dataset.maxSize)||box.size;
        // 住所が1列に収まらないときだけ、番地の前で2行に分ける。折り返し任せだと町名の途中で切れてしまう。
        if(key==='address'&&node.children.length===1&&node.richSource){
          node.style.fontSize=max+'pt';node.style.whiteSpace='nowrap';
          const oneLine=fits(node);node.style.whiteSpace='';
          const source=node.richSource,parts=splitAddress(source.text);
          if(!oneLine&&parts.length===2)setLines(node,parts.map(([from,to])=>({...source,from,to,transform:node.dataset.writingMode==='vertical'?C.verticalAddress:v=>v})));
        }
        const fitKey=[node.innerHTML,max,box.min,node.style.width,node.style.height,node.dataset.writingMode].join('|');
        if(node.dataset.fitKey===fitKey){node.style.fontSize=node.dataset.fitSize+'pt';continue;}
        const size=shrinkToFit(node,max,box.min);
        node.dataset.fitKey=fitKey;node.dataset.fitSize=size;
      }
      // 連名の大きさを指定していないときは、氏名と連名を同じ大きさにそろえる（小さいほうに合わせる）。
      const names=page.querySelector('[data-layout-element="names"]'),joint=page.querySelector('[data-layout-element="joint"]');
      if(names&&joint&&!joint.dataset.ownSize){const size=Math.min(Number(names.dataset.fitSize),Number(joint.dataset.fitSize));for(const node of [names,joint])node.style.fontSize=size+'pt';}
    }finally{if(detached)page.remove();}
    return page;
  }
  function applyPositions(page,r,state){
    const hasJoint=Boolean(page.querySelector('[data-layout-element="joint"]'));
    for(const node of page.querySelectorAll('[data-layout-element]')){
      const key=node.dataset.layoutElement,p=L.resolve(state.frontLayout,r.id,key),box=BOX[key],mode=writingMode(state,r,key);
      const vertical=mode==='vertical';
      node.dataset.writingMode=mode;
      node.style.transform='translate('+p.x+'mm,'+p.y+'mm)';node.style.textOrientation=orientation(node.textContent);
      node.classList.toggle('front-horizontal',!vertical);
      // 郵便番号と氏名・連名は枠を横に並べる入れ物なので、入れ物自体は横組みのまま向きを並び方で表す。
      node.style.writingMode=['postal','names','joint'].includes(key)?'horizontal-tb':(vertical?'vertical-rl':'horizontal-tb');
      if(key==='postal'){node.style.flexDirection=vertical?'column':'row';node.style.fontSize=(p.fontSize||BOX.postal.size)+'pt';continue;}
      if(key==='names'||key==='joint'){node.style.flexDirection=vertical?'row-reverse':'column';for(const person of node.children){person.style.writingMode=vertical?'vertical-rl':'horizontal-tb';person.style.textOrientation=orientation(person.textContent);}}
      if(!box)continue;
      // 枠の大きさは縦書き／横書きごとの標準値。拡大編集で指定した場合はその値を使う。
      const base=key==='names'&&hasJoint?{...box,...NAMES_WITH_JOINT}:box,standard=vertical?base:base.horizontal;
      node.style.width=(p.width||standard.width)+'mm';node.style.height=(p.height||standard.height)+'mm';
      // 連名の文字サイズを指定していなければ、氏名に指定した大きさを引き継ぐ。
      const size=key==='joint'?p.fontSize||L.resolve(state.frontLayout,r.id,'names').fontSize:p.fontSize;
      node.dataset.maxSize=size||box.size;
      if(key==='joint'){if(p.fontSize)node.dataset.ownSize='1';else delete node.dataset.ownSize;}
    }
    return fit(page);
  }
  root.FrontRenderer={card,applyPositions};
})(window);
