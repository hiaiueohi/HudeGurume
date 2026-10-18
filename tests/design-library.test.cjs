const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {createDesignLibrary,defaultProject,validateProject}=require('../design-library.cjs');
const catalog=require('../src/design-catalog.js');
const Layout=require('../src/design-layout.js');
const root=()=>fs.mkdtempSync(path.join(os.tmpdir(),'atena-design-test-'));
test('install all six backgrounds and complete samples under a clear year folder',()=>{
 const library=createDesignLibrary(root());const result=library.list();
 assert.equal(result.catalog.items.length,6);assert.equal(path.basename(result.info.folder),'2027年_未（ひつじ）');
 assert.equal(fs.readdirSync(library.info.folder).filter(name=>name.endsWith('.png')).length,12);
 assert.ok(result.catalog.items.every(item=>item.image.startsWith('file:')&&item.sample.startsWith('file:')));
 const first=result.catalog.items[0];
 const image=path.join(library.info.folder,first.filename+'_背景.png');fs.writeFileSync(image,'user changed file');
 library.ensure();assert.equal(fs.readFileSync(image,'utf8'),'user changed file');
});
test('save and reload the chosen design and custom wording',()=>{
 const library=createDesignLibrary(root());const project={...defaultProject(),designId:'felt-friends',headline:'迎春',message:'素敵な一年になりますように',showSender:true,layout:Layout.apply(Layout.empty(),'felt-friends',{headline:{x:4,y:6}},'one')};
 library.saveProject(project);assert.deepEqual(createDesignLibrary(path.dirname(path.dirname(library.info.folder))).loadProject(),project);
});
test('invalid project data cannot replace a saved selection',()=>{
 const library=createDesignLibrary(root());library.saveProject(defaultProject());
 const before=fs.readFileSync(library.info.projectPath,'utf8');
 assert.throws(()=>library.saveProject({...defaultProject(),designId:'../../bad'}));
 assert.throws(()=>validateProject({...defaultProject(),year:2026}));
 assert.throws(()=>validateProject({...defaultProject(),message:'a\nb\nc\nd'}));
 assert.equal(fs.readFileSync(library.info.projectPath,'utf8'),before);
});
test('completed PNG exports use the chosen year folder and reject invalid payloads',()=>{
 const library=createDesignLibrary(root());
 assert.throws(()=>library.saveImage('data:text/plain;base64,abc','washi-gold'));
 assert.throws(()=>library.saveImage('data:image/png;base64,abc','washi-gold'));
 const sample=fs.readFileSync(path.resolve(__dirname,'../assets/designs/2027/samples/01.png'));
 const result=library.saveImage('data:image/png;base64,'+sample.toString('base64'),'washi-gold');
 assert.equal(path.dirname(result.filePath),library.info.exportsFolder);
 assert.deepEqual(fs.readFileSync(result.filePath),sample);
});
