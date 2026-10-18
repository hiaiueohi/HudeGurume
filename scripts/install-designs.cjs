const path=require('node:path');
const {createDesignLibrary}=require('../design-library.cjs');
const index=process.argv.indexOf('--documents');
if(index<0||!process.argv[index+1]||!path.isAbsolute(process.argv[index+1]))throw Error('--documents にドキュメントの絶対パスを指定してください。');
const library=createDesignLibrary(path.join(process.argv[index+1],'宛名はがき'));
const result=library.list();
console.log(JSON.stringify({folder:result.info.folder,designs:result.catalog.items.length,backgrounds:6,samples:6},null,2));
