(function (root) {
  const fonts = {
    serif:'"Yu Mincho", "MS Mincho", serif',
    sans:'"Yu Gothic", Meiryo, sans-serif',
    rounded:'"Yu Gothic", Meiryo, sans-serif'
  };
  function textSize(text, requested, width) {
    const units = Math.max(1, ...text.split(/\r?\n/).map(line => [...line].reduce((sum,c) => sum + (/[^\x00-\x7F]/.test(c) ? 1 : .6), 0)));
    return Math.min(requested, width / units / (25.4 / 72));
  }
  function senderLines(sender) {
    return [sender.name || '', [sender.address,sender.building].filter(Boolean).join(' ')].filter(Boolean);
  }
  function fitHeight(text, size, height) {
    return Math.min(size,height / Math.max(1,text.split(/\r?\n/).length) / 1.45 / (25.4/72));
  }
  function card(item, project, sender = {}) {
    const page = document.createElement('div'); page.className = 'card design-card';
    page.style.setProperty('--design-ink',item.color);
    page.style.fontFamily = fonts[item.font];
    const image = document.createElement('img');
    image.className = 'design-background'; image.src = item.image; image.alt = '';
    image.draggable=false;
    image.dataset.layoutElement='background';
    page.append(image);
    const block = (className,text,size) => {
      const node = document.createElement('div'); node.className = className; node.textContent = text;
      node.dataset.layoutElement=className.replace('design-','');
      if (size) node.style.fontSize = size + 'pt'; page.append(node); return node;
    };
    block('design-headline',project.headline,textSize(project.headline,fitHeight(project.headline,project.headlineSize,19),84)).style.fontWeight=item.font==='serif'?'normal':'bold';
    block('design-date',project.dateText,9);
    block('design-message',project.message,textSize(project.message,fitHeight(project.message,project.messageSize,project.showSender?11.5:16),84));
    if (project.showSender) {
      const lines = project.senderText??senderLines(sender).join('\n');
      block('design-sender',lines,textSize(lines,7,84));
    }
    applyPositions(page,item,project);
    return page;
  }
  function applyPositions(page,item,project) {
    for(const node of page.querySelectorAll('[data-layout-element]')) {
      const key=node.dataset.layoutElement,position=root.NengaLayout.resolve(project.layout,item.id,key);
      node.style.transform='translate('+position.x+'mm,'+position.y+'mm)'+(key==='background'?' scale('+position.scale+')':'');
      node.style.transformOrigin='center';
      if(key!=='background'){
        const vertical=position.writingMode==='vertical';node.classList.toggle('design-vertical',vertical);
        if(vertical){const boxes={headline:[68,10,22,90],date:[53,12,12,78],message:[12,42,36,92],sender:[8,103,25,41]},box=boxes[key];node.style.left=box[0]+'mm';node.style.top=box[1]+'mm';node.style.right='auto';node.style.bottom='auto';node.style.width=(position.width||box[2])+'mm';node.style.height=(position.height||box[3])+'mm';node.style.maxHeight='none';node.style.writingMode='vertical-rl';node.style.textOrientation='upright';node.style.textAlign='start';node.style.overflowWrap='anywhere';
          const requested=position.fontSize||(key==='headline'?project.headlineSize:key==='message'?project.messageSize:key==='date'?9:7);
          node.style.fontSize=(position.fontSize||Math.min(requested,(position.height||box[3])/Math.max(1,...node.textContent.split(/\r?\n/).map(s=>[...s].length))/(25.4/72)))+'pt';
        }else{if(position.fontSize)node.style.fontSize=position.fontSize+'pt';if(position.width){node.style.width=position.width+'mm';node.style.right='auto';}if(position.height){node.style.height=position.height+'mm';node.style.maxHeight='none';}}
      }
    }
  }
  async function renderPNG(item, project, sender = {}) {
    await document.fonts.ready;
    const image = new Image(); image.src = item.image;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1776;
    const context = canvas.getContext('2d'); context.scale(12,12);
    context.fillStyle = '#fff'; context.fillRect(0,0,100,148);
    const ratio = Math.max(100 / image.naturalWidth, 148 / image.naturalHeight);
    const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
    const background=root.NengaLayout.resolve(project.layout,item.id,'background');
    context.save();context.translate(50+background.x,74+background.y);context.scale(background.scale,background.scale);
    context.drawImage(image,-w/2,-h/2,w,h);context.restore();
    // Use the browser's actual glyph positions, including vertical writing and wrapping.
    // This keeps the saved PNG aligned with the editable and printable DOM.
    const page=card(item,project,sender);page.style.position='fixed';page.style.left='-10000px';page.style.top='0';page.style.opacity='0';page.style.zoom='1';document.body.append(page);
    try{
      const rect=page.getBoundingClientRect(),pxPerMM=rect.width/100;
      context.textAlign='center';context.textBaseline='alphabetic';
      const verticalForms={'、':'︑','。':'︒','「':'﹁','」':'﹂','『':'﹃','』':'﹄','（':'︵','）':'︶','ー':'丨','…':'︙'};
      for(const block of page.querySelectorAll('[data-layout-element]:not(img)')){
        const css=getComputedStyle(block),vertical=css.writingMode.startsWith('vertical');
        context.save();if(css.overflowX==='hidden'||css.overflowY==='hidden'){const box=block.getBoundingClientRect();context.beginPath();context.rect((box.x-rect.x)/pxPerMM,(box.y-rect.y)/pxPerMM,box.width/pxPerMM,box.height/pxPerMM);context.clip();}
        context.fillStyle=css.color;context.font=css.fontWeight+' '+(parseFloat(css.fontSize)/pxPerMM)+'px '+css.fontFamily;
        let offset=0;const textNode=block.firstChild;if(!textNode||textNode.nodeType!==Node.TEXT_NODE){context.restore();continue;}
        for(const char of textNode.textContent){
          const range=document.createRange();range.setStart(textNode,offset);offset+=char.length;range.setEnd(textNode,offset);
          if(/\s/.test(char))continue;const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;
          const glyph=vertical?(verticalForms[char]||char):char,metrics=context.measureText(glyph);
          const x=(r.x-rect.x+r.width/2)/pxPerMM,y=(r.y-rect.y+r.height/2)/pxPerMM+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
          context.fillText(glyph,x,y);
        }
        context.restore();
      }
    }finally{page.remove();}
    return canvas.toDataURL('image/png');
  }
  root.DesignRenderer = {card,renderPNG,fonts,applyPositions,senderLines};
})(window);
