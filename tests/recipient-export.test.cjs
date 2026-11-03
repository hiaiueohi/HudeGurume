const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const E=require('../src/recipient-export.js');
const records=[{id:'a',name:'山田 太郎',honorific:'様',zip:'0600042',address:'北海道札幌市中央区大通西15丁目1-20',building:'サンコーポラス301',joint:'山田 花子\n\n山田 一郎 ',memo:'喪中のため控える\n<要確認> & "引用"'},{id:'b',name:'=SUM(1,2)',address:'東京都1-2'}];
function unzip(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files={};
  const end=bytes.length-22;assert.equal(view.getUint32(end,true),0x06054b50);
  let at=view.getUint32(end+16,true);
  for(let n=0;n<view.getUint16(end+10,true);n++){
    assert.equal(view.getUint32(at,true),0x02014b50);
    const crc=view.getUint32(at+16,true),size=view.getUint32(at+24,true),nameLength=view.getUint16(at+28,true),local=view.getUint32(at+42,true);
    const name=Buffer.from(bytes.subarray(at+46,at+46+nameLength)).toString('utf8');
    assert.equal(view.getUint32(local,true),0x04034b50);
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),data=Buffer.from(bytes.subarray(start,start+size));
    assert.equal(zlib.crc32(data),crc,name+' CRC');files[name]=data.toString('utf8');at+=46+nameLength;
  }
  return files;
}
test('the recipient list has name, postal code, address, comma-separated joint names and memo',()=>{
  assert.deepEqual(E.rows(records),[['名前','郵便番号','住所','連名','メモ'],['山田 太郎','060-0042','北海道札幌市中央区大通西15丁目1-20 サンコーポラス301','山田 花子, 山田 一郎','喪中のため控える\n<要確認> & "引用"'],['=SUM(1,2)','','東京都1-2','','']]);
});
test('the CSV list opens in Excel without garbling or running formulas',()=>{
  const csv=E.toCSV(records);
  assert.ok(csv.startsWith('﻿名前,郵便番号,住所,連名,メモ\r\n'));
  assert.ok(csv.includes('"山田 花子, 山田 一郎","喪中のため控える\r\n<要確認> & ""引用"""'));
  assert.ok(csv.includes('"\'=SUM(1,2)",,東京都1-2,,'));
});
test('the Excel list is a valid workbook with text cells',()=>{
  const files=unzip(E.toXLSX(records,new Date(2026,9,25,9,30)));
  assert.deepEqual(Object.keys(files).sort(),['[Content_Types].xml','_rels/.rels','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/workbook.xml','xl/worksheets/sheet1.xml']);
  const sheet=files['xl/worksheets/sheet1.xml'];
  assert.ok(files['xl/workbook.xml'].includes('name="住所録"'));
  assert.ok(sheet.includes('<c r="B2" t="inlineStr" s="2"><is><t xml:space="preserve">060-0042</t></is></c>'));
  assert.ok(sheet.includes('&lt;要確認&gt; &amp; &quot;引用&quot;'));
  assert.ok(sheet.includes('<t xml:space="preserve">=SUM(1,2)</t>')&&!sheet.includes('<f>'));
  assert.ok(sheet.includes('<autoFilter ref="A1:E3"/>'));
});
