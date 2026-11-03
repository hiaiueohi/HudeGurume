(function(root){
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,''); const rows=[]; let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw Error('引用符の位置が不正です');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.length))rows.push(row);row=[];cell='';}else cell+=c;}
    if(quoted)throw Error('CSVの引用符が閉じられていません');row.push(cell);if(row.some(v=>v.length))rows.push(row);return rows;
  }
  const headers=['氏名','敬称','連名','郵便番号','住所','建物名','メモ'];const keys=['name','honorific','joint','zip','address','building','memo'];
  function toCSV(records){return '\uFEFF'+[headers,...records.map(r=>keys.map(k=>r[k]||''))].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  function fromCSV(text){const rows=parseCSV(text);if(!rows.length)throw Error('CSVが空です');const head=rows.shift().map(s=>s.trim());if(!head.includes('氏名')||!head.includes('住所'))throw Error('見出しに「氏名」と「住所」が必要です');return rows.map((row,i)=>{const r={};keys.forEach((k,j)=>{const n=head.indexOf(headers[j]);r[k]=n<0?'':(row[n]||'').trim();});if(!r.name||!r.address)throw Error(`${i+2}行目の氏名または住所が空です`);if(!head.includes('敬称'))r.honorific='様';if(!r.memo)delete r.memo;if(r.zip&&!validZip(r.zip))throw Error(`${i+2}行目の郵便番号が不正です`);return r;});}
  function zipDigits(v){return String(v||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[-ー－\s]/g,'');}
  function validZip(v){return /^\d{7}$/.test(zipDigits(v));}
  function formatZip(v){const digits=zipDigits(v);return validZip(digits)?digits.slice(0,3)+'-'+digits.slice(3):String(v||'');}
  function verticalAddress(v){return String(v||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/\d/g,c=>'〇一二三四五六七八九'[Number(c)]).replace(/[-－]/g,'ー');}
  const MEMO_LIMIT=2000;
  // 文字の一部だけ大きさを変えた範囲。宛先ごとに文字の並びが違うので、宛先ひとりずつにしか持たせない。
  const SIZE_FIELDS=['name','joint','address','building','yearLabel','senderName','senderAddress','senderBuilding'];
  function validateTextSizes(input){
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('文字サイズの形式が不正です');
    const output={};
    for(const [key,ranges]of Object.entries(input)){
      if(!SIZE_FIELDS.includes(key)||!Array.isArray(ranges)||ranges.length>40)throw Error('文字サイズの形式が不正です');
      const list=ranges.map(r=>{
        if(!r||!Number.isInteger(r.start)||!Number.isInteger(r.end)||r.start<0||r.end<=r.start||r.end>2000||typeof r.scale!=='number'||!(r.scale>=0.3&&r.scale<=3))throw Error('文字サイズの範囲が不正です');
        return {start:r.start,end:r.end,scale:Math.round(r.scale*100)/100};
      }).sort((a,b)=>a.start-b.start);
      if(list.some((r,i)=>i&&r.start<list[i-1].end))throw Error('文字サイズの範囲が重なっています');
      if(list.length)output[key]=list;
    }
    return output;
  }
  // 文字を書き換えたとき、大きさを変えた範囲が同じ文字を指し続けるようにずらす。
  function shiftRanges(before,after,ranges){
    before=String(before||'');after=String(after||'');
    if(!Array.isArray(ranges)||!ranges.length||before===after)return ranges||[];
    let head=0;while(head<before.length&&head<after.length&&before[head]===after[head])head++;
    let tail=0;while(tail<before.length-head&&tail<after.length-head&&before[before.length-1-tail]===after[after.length-1-tail])tail++;
    const oldEnd=before.length-tail,newEnd=after.length-tail,delta=after.length-before.length;
    const start=i=>i<head?i:i>=oldEnd?i+delta:newEnd,end=i=>i<=head?i:i>=oldEnd?i+delta:head;
    return ranges.map(r=>({...r,start:start(r.start),end:end(r.end)})).filter(r=>r.end>r.start);
  }
  // 選んだ部分に倍率を付ける。重なる既存の範囲は切り詰め、倍率1は「元に戻す」として範囲を消す。
  function setRange(ranges,start,end,scale){
    const out=[];
    for(const r of ranges||[]){
      if(r.end<=start||r.start>=end){out.push(r);continue;}
      if(r.start<start)out.push({...r,end:start});
      if(r.end>end)out.push({...r,start:end});
    }
    if(Math.abs(scale-1)>0.001)out.push({start,end,scale:Math.round(scale*100)/100});
    return out.sort((a,b)=>a.start-b.start);
  }
  function validateState(s){
    if(!s||!Array.isArray(s.records)||!s.sender||typeof s.sender!=='object'||Array.isArray(s.sender))throw Error('住所録データの形式が不正です');
    const fields=['id','name','honorific','joint','zip','address','building','yearLabel','memo'],ids=new Set();
    const records=s.records.map(r=>{
      if(!r||fields.some(k=>r[k]!==undefined&&typeof r[k]!=='string')||!r.id||!r.name||!r.address||ids.has(r.id)||(r.memo&&r.memo.length>MEMO_LIMIT))throw Error('住所録に不正な項目があります');
      ids.add(r.id);const copy={};for(const k of fields)if(r[k]!==undefined)copy[k]=r[k];
      if(r.textSizes!==undefined){const sizes=validateTextSizes(r.textSizes);if(Object.keys(sizes).length)copy.textSizes=sizes;}
      if(r.senderOverride!==undefined){if(!r.senderOverride||typeof r.senderOverride!=='object'||Array.isArray(r.senderOverride))throw Error('差出人の形式が不正です');copy.senderOverride={};for(const k of ['name','zip','address','building']){if(typeof r.senderOverride[k]!=='string')throw Error('差出人の形式が不正です');copy.senderOverride[k]=r.senderOverride[k];}}
      return copy;
    });
    const sender={};for(const k of ['name','zip','address','building']){if(s.sender[k]!==undefined&&typeof s.sender[k]!=='string')throw Error('差出人が不正です');if(s.sender[k]!==undefined)sender[k]=s.sender[k];}
    const result={records,sender,offsetX:Number.isFinite(s.offsetX)?Math.max(-15,Math.min(15,s.offsetX)):0,offsetY:Number.isFinite(s.offsetY)?Math.max(-15,Math.min(15,s.offsetY)):0};
    // 官製はがきには朱色の郵便番号枠が印刷済みなので、枠を重ねて刷るかどうかを保存する。
    if(s.postalFrame!==undefined){if(typeof s.postalFrame!=='boolean')throw Error('郵便番号枠の設定が不正です');result.postalFrame=s.postalFrame;}
    if(s.frontLayout!==undefined){const L=typeof module!=='undefined'?require('./front-layout.js'):root.FrontLayout;result.frontLayout=L.validate(s.frontLayout);for(const id of Object.keys(result.frontLayout.records))if(!ids.has(id))delete result.frontLayout.records[id];}
    return result;
  }
  const api={parseCSV,toCSV,fromCSV,zipDigits,validZip,formatZip,verticalAddress,validateState,MEMO_LIMIT,SIZE_FIELDS,shiftRanges,setRange};if(typeof module!=='undefined')module.exports=api;root.PostcardCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
