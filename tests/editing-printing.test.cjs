const {test}=require('node:test'),assert=require('node:assert/strict');
const Front=require('../src/front-layout.js'),Design=require('../src/design-layout.js'),Core=require('../src/core.js');
const {defaultProject,validateProject}=require('../design-library.cjs');
const {printOptions,createPrintService}=require('../printing-ipc.cjs');
test('address-book persistence preserves scoped formatting and recipient-only sender text',()=>{
 const frontLayout=Front.apply(undefined,'a',{names:{x:2,y:3,writingMode:'horizontal',fontSize:20,width:60,height:30}},'one');
 const state=Core.validateState({records:[{id:'a',name:'A',address:'住所',senderOverride:{name:'自分',address:'住所',zip:'1234567',building:''}}],sender:{},frontLayout});
 assert.deepEqual(state.frontLayout,frontLayout);assert.equal(state.records[0].senderOverride.name,'自分');
 const all=Front.apply(frontLayout,'a',{names:{x:4,y:5,writingMode:'vertical'}},'all');assert.equal(Front.resolve(all,'b','names').writingMode,'vertical');
 assert.equal(Core.validateState({...state,records:[]}).frontLayout.records.a,undefined);
});
test('both layout models reject invalid typography and preserve valid vertical text',()=>{
 for(const [model,id,key]of [[Front,'a','address'],[Design,'felt-friends','message']]){
  assert.throws(()=>model.apply(undefined,id,{[key]:{writingMode:'sideways'}},'one'));
  assert.throws(()=>model.apply(undefined,id,{[key]:{fontSize:73}},'one'));
  assert.equal(model.resolve(model.apply(undefined,id,{[key]:{writingMode:'vertical',fontSize:12}},'one'),id,key).fontSize,12);
 }
 const project=validateProject({...defaultProject(),senderText:'編集した差出人',layout:Design.apply(undefined,'washi-gold',{headline:{writingMode:'vertical'}},'one')});assert.equal(project.senderText,'編集した差出人');
});
const job={deviceName:'test',count:10,testOnly:true,color:true,driverDialog:false};
test('native printing uses postcard microns, one test page, selected printer and no duplication',()=>{
 const options=printOptions(job,[{name:'test'}]);assert.deepEqual(options.pageSize,{width:100000,height:148000});assert.equal(options.scaleFactor,100);assert.equal(options.deviceName,'test');assert.equal(options.copies,1);assert.equal(options.duplexMode,'simplex');assert.deepEqual(options.pageRanges,[{from:0,to:0}]);
 assert.equal(printOptions({...job,testOnly:false},[{name:'test'}]).pageRanges[0].to,9);assert.equal(printOptions({...job,driverDialog:true},[{name:'test'}]).silent,false);
 assert.throws(()=>printOptions(job,[]));assert.throws(()=>printOptions({...job,count:0},[{name:'test'}]));
});
test('printer enumeration alone never prints; driver errors are reported and retry is possible',async()=>{
 let calls=0,fail=true;const wc={getPrintersAsync:async()=>[{name:'test'}],executeJavaScript:async()=>true,print:(options,callback)=>{calls++;callback(!fail,'Invalid printer settings');}};
 const service=createPrintService(()=>({isDestroyed:()=>false,webContents:wc}));await service.list();assert.equal(calls,0);await assert.rejects(service.print(job),/Invalid printer settings/);fail=false;assert.equal((await service.print(job)).count,1);assert.equal(calls,2);
});
