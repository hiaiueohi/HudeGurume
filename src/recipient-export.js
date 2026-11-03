(function(root){
  const HEADERS=['名前','郵便番号','住所','連名','メモ'];
  const zipDigits=v=>String(v||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/[-ー－\s]/g,'');
  const formatZip=v=>{const d=zipDigits(v);return /^\d{7}$/.test(d)?d.slice(0,3)+'-'+d.slice(3):String(v||'');};
  function rows(records){
    return [HEADERS,...records.map(r=>[
      r.name||'',
      r.zip?formatZip(r.zip):'',
      [r.address,r.building].filter(Boolean).join(' '),
      String(r.joint||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).join(', '),
      r.memo||''
    ])];
  }
  // Excelで文字化けしないよう、BOM付きUTF-8・CRLFで書き出す。
  function toCSV(records){
    // 「=」などで始まる文字はExcelが数式として実行してしまうため、先頭に ' を付けて文字として開かせる。
    const cell=v=>{if(/^[=+\-@]/.test(v))v="'"+v;return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;};
    return '﻿'+rows(records).map(row=>row.map(v=>cell(String(v).replace(/\r?\n/g,'\r\n'))).join(',')).join('\r\n')+'\r\n';
  }
  const encoder=new TextEncoder();
  const xml=v=>String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const column=i=>String.fromCharCode(65+i);
  function sheet(records){
    const data=rows(records);
    const body=data.map((row,y)=>'<row r="'+(y+1)+'">'+row.map((v,x)=>'<c r="'+column(x)+(y+1)+'" t="inlineStr" s="'+(y?2:1)+'"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>').join('')+'</row>').join('');
    const widths=[22,12,48,30,48];
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      +'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      +'<cols>'+widths.map((w,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>').join('')+'</cols>'
      +'<sheetData>'+body+'</sheetData><autoFilter ref="A1:E'+data.length+'"/></worksheet>';
  }
  const STYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<fonts count="2"><font><sz val="11"/><name val="Yu Gothic"/><family val="3"/><charset val="128"/></font><font><b/><sz val="11"/><name val="Yu Gothic"/><family val="3"/><charset val="128"/></font></fonts>'
    +'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F0EC"/><bgColor indexed="64"/></patternFill></fill></fills>'
    +'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    +'<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>'
    +'<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs>'
    +'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  function parts(records){
    return [
      ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
      ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="住所録" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">住所録!$A$1:$E$'+(records.length+1)+'</definedName></definedNames></workbook>'],
      ['xl/_rels/workbook.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
      ['xl/worksheets/sheet1.xml',sheet(records)],
      ['xl/styles.xml',STYLES]
    ];
  }
  const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=CRC[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  // .xlsxはXMLをまとめたZIP。圧縮なし（格納のみ）でも Excel はそのまま開ける。
  function zip(files,date=new Date()){
    const time=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1);
    const day=((date.getFullYear()-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
    const chunks=[],central=[];let offset=0;
    const header=(size,write)=>{const b=new Uint8Array(size);write(new DataView(b.buffer));return b;};
    for(const [name,text] of files){
      const nameBytes=encoder.encode(name),data=encoder.encode(text),crc=crc32(data);
      const common=(v,at)=>{v.setUint16(at,20,true);v.setUint16(at+2,0x0800,true);v.setUint16(at+4,0,true);v.setUint16(at+6,time,true);v.setUint16(at+8,day,true);v.setUint32(at+10,crc,true);v.setUint32(at+14,data.length,true);v.setUint32(at+18,data.length,true);v.setUint16(at+22,nameBytes.length,true);v.setUint16(at+24,0,true);};
      const local=header(30,v=>{v.setUint32(0,0x04034b50,true);common(v,4);});
      chunks.push(local,nameBytes,data);
      central.push(header(46,v=>{v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);common(v,6);v.setUint32(42,offset,true);}),nameBytes);
      offset+=local.length+nameBytes.length+data.length;
    }
    const centralSize=central.reduce((n,b)=>n+b.length,0);
    const end=header(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);});
    const all=[...chunks,...central,end],out=new Uint8Array(all.reduce((n,b)=>n+b.length,0));let at=0;for(const b of all){out.set(b,at);at+=b.length;}
    return out;
  }
  const toXLSX=(records,date)=>zip(parts(records),date);
  const api={HEADERS,rows,toCSV,toXLSX};
  if(typeof module!=='undefined')module.exports=api;root.RecipientExport=api;
})(typeof window!=='undefined'?window:globalThis);
