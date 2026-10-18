(function(root){
  function parseCSV(text){
    text=text.replace(/^\uFEFF/,''); const rows=[]; let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell.length)throw Error('引用符の位置が不正です');else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.length))rows.push(row);row=[];cell='';}else cell+=c;}
    if(quoted)throw Error('CSVの引用符が閉じられていません');row.push(cell);if(row.some(v=>v.length))rows.push(row);return rows;
  }
  const headers=['氏名','敬称','連名','郵便番号','住所','建物名'];const keys=['name','honorific','joint','zip','address','building'];
  function toCSV(records){return '\uFEFF'+[headers,...records.map(r=>keys.map(k=>r[k]||''))].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  function fromCSV(text){const rows=parseCSV(text);if(!rows.length)throw Error('CSVが空です');const head=rows.shift().map(s=>s.trim());if(!head.includes('氏名')||!head.includes('住所'))throw Error('見出しに「氏名」と「住所」が必要です');return rows.map((row,i)=>{const r={};keys.forEach((k,j)=>{const n=head.indexOf(headers[j]);r[k]=n<0?'':(row[n]||'').trim();});if(!r.name||!r.address)throw Error(`${i+2}行目の氏名または住所が空です`);if(!head.includes('敬称'))r.honorific='様';if(r.zip&&!validZip(r.zip))throw Error(`${i+2}行目の郵便番号が不正です`);return r;});}
  function zipDigits(v){return String(v||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[-ー－\s]/g,'');}
  function validZip(v){return /^\d{7}$/.test(zipDigits(v));}
  function verticalAddress(v){return String(v||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/\d/g,c=>'〇一二三四五六七八九'[Number(c)]).replace(/[-－]/g,'ー');}
  const api={parseCSV,toCSV,fromCSV,zipDigits,validZip,verticalAddress};if(typeof module!=='undefined')module.exports=api;root.PostcardCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
