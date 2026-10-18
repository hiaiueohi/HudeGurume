const {test}=require('node:test');const assert=require('node:assert/strict');
const Layout=require('../src/design-layout.js');
const {defaultProject,validateProject}=require('../design-library.cjs');
test('a per-design position keeps other designs and elements unchanged',()=>{
 const base={common:{date:{x:1,y:2}},designs:{'sumi-sunrise':{message:{x:3,y:-4}}}};
 const next=Layout.apply(base,'felt-friends',{headline:{x:4,y:6}},'one');
 assert.deepEqual(Layout.resolve(next,'felt-friends','headline'),{x:4,y:6});
 assert.deepEqual(Layout.resolve(next,'sheep-family','headline'),{x:0,y:0});
 assert.deepEqual(Layout.resolve(next,'felt-friends','date'),{x:1,y:2});
 assert.deepEqual(Layout.resolve(next,'sumi-sunrise','message'),{x:3,y:-4});
 assert.equal(base.designs['felt-friends'],undefined);
});
test('apply to all makes moved elements agree, replacing their individual positions only',()=>{
 const base={common:{date:{x:1,y:2}},designs:{'felt-friends':{headline:{x:4,y:6}},'sheep-family':{headline:{x:-9,y:-7},message:{x:2,y:3}}}};
 const before=Layout.draft(base,'felt-friends'),after=JSON.parse(JSON.stringify(before));after.headline.x=7;
 const next=Layout.apply(base,'felt-friends',Layout.diff(before,after),'all');
 for(const id of ['felt-friends','sheep-family','washi-gold','nordic-garden'])assert.deepEqual(Layout.resolve(next,id,'headline'),{x:7,y:6});
 assert.deepEqual(Layout.resolve(next,'sheep-family','message'),{x:2,y:3});
 assert.deepEqual(Layout.resolve(next,'washi-gold','date'),{x:1,y:2});
});
test('background movement and scaling use the same scoping rules',()=>{
 const next=Layout.apply(Layout.empty(),'felt-friends',{background:{x:2,y:-3,scale:1.2}},'one');
 assert.deepEqual(Layout.resolve(next,'felt-friends','background'),{x:2,y:-3,scale:1.2});
 assert.deepEqual(Layout.resolve(next,'sheep-family','background'),{x:0,y:0,scale:1});
});
test('old project files receive an empty layout and invalid placement is rejected',()=>{
 const legacy=defaultProject();delete legacy.layout;
 assert.deepEqual(validateProject(legacy).layout,Layout.empty());
 assert.throws(()=>Layout.validate({common:{headline:{x:Infinity}},designs:{}}));
 assert.throws(()=>Layout.validate({common:{message:{y:149}},designs:{}}));
 assert.throws(()=>Layout.validate({common:{background:{scale:2}},designs:{}}));
 assert.throws(()=>Layout.validate({common:{headline:{scale:1.2}},designs:{}}));
 assert.throws(()=>Layout.validate({common:{},designs:{unknown:{headline:{x:1}}}}));
});
