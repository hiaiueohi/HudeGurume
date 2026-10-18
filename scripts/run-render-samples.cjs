const {spawn}=require('node:child_process');const path=require('node:path');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const child=spawn(require('electron'),[path.join(__dirname,'render-design-samples.cjs')],{cwd:path.join(__dirname,'..'),env,windowsHide:true,stdio:'inherit'});
child.on('error',error=>{console.error(error);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code===null?1:code;});
