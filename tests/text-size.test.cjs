const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../src/core.js'),L=require('../src/front-layout.js');
const base={sender:{},records:[{id:'a',name:'山田太郎',address:'東京都1-2',textSizes:{name:[{start:2,end:4,scale:1.5}]}}]};
const withSizes=textSizes=>({...base,records:[{...base.records[0],textSizes}]});
test('partial text sizes are stored per recipient and validated',()=>{
  assert.deepEqual(C.validateState(base).records[0].textSizes,{name:[{start:2,end:4,scale:1.5}]});
  for(const bad of [{memo:[{start:0,end:1,scale:2}]},{name:[{start:1,end:1,scale:2}]},{name:[{start:0,end:2,scale:9}]},{name:[{start:0,end:2,scale:2},{start:1,end:3,scale:2}]},{name:'big'}])
    assert.throws(()=>C.validateState(withSizes(bad)),JSON.stringify(bad));
  assert.equal('textSizes' in C.validateState(withSizes({})).records[0],false);
});
test('partial sizes follow the same characters while the text is edited',()=>{
  assert.deepEqual(C.shiftRanges('山田太郎','新山田太郎',[{start:2,end:4,scale:2}]),[{start:3,end:5,scale:2}]);
  assert.deepEqual(C.shiftRanges('山田太郎','山田太X郎',[{start:2,end:4,scale:2}]),[{start:2,end:5,scale:2}]);
  assert.deepEqual(C.shiftRanges('山田太郎','山田太郎様',[{start:2,end:4,scale:2}]),[{start:2,end:4,scale:2}]);
  assert.deepEqual(C.shiftRanges('山田太郎','山田',[{start:2,end:4,scale:2}]),[]);
});
test('setting a size replaces overlapping parts and 100% removes it',()=>{
  assert.deepEqual(C.setRange([{start:0,end:4,scale:2}],1,3,1.5),[{start:0,end:1,scale:2},{start:1,end:3,scale:1.5},{start:3,end:4,scale:2}]);
  assert.deepEqual(C.setRange([{start:0,end:2,scale:2}],0,2,1),[]);
});
test('joint names are a separate layout element that moves on its own',()=>{
  assert.ok(L.elements.includes('joint'));assert.equal(L.names.joint,'連名');
  const layout=L.apply(undefined,'a',{joint:{x:-6,y:5}},'one');
  assert.deepEqual(L.resolve(layout,'a','joint'),{x:-6,y:5});assert.deepEqual(L.resolve(layout,'a','names'),{x:0,y:0});
});
