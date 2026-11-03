const {spawn}=require('node:child_process');
const path=require('node:path');
const {electronBinary,electronEnv}=require('./electron-binary.cjs');
const child=spawn(electronBinary(),[path.join(__dirname,'desktop-smoke.cjs')],{cwd:path.join(__dirname,'..'),env:electronEnv(),windowsHide:true,stdio:'inherit'});
child.once('error',error=>{console.error(error);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code===null?1:code;});
