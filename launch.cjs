const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const log=path.join(__dirname,'startup.log');
fs.appendFileSync(log,`\n${new Date().toISOString()} Starting desktop application\n`);
// このPCのWindowsのApplication Controlポリシーがelectron.exeをブロックすることがある。
// electron-binary.cjs が別名コピーへのフォールバックを管理する（テストと共通のロジック）。
let executable,env;
try{
  const eb=require('./tests/electron-binary.cjs');
  executable=eb.electronBinary();
  env=eb.electronEnv();
  fs.appendFileSync(log,`Using: ${executable}\n`);
}catch(err){
  fs.appendFileSync(log,err.message+'\n');console.error(err.message);process.exit(1);
}
// This is the interactive application window requested by the user.
const child=spawn(executable,[__dirname],{cwd:__dirname,env,windowsHide:false,stdio:['ignore','pipe','pipe']});
for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{fs.appendFileSync(log,data);process.stdout.write(data);});
child.on('error',error=>{fs.appendFileSync(log,error.stack+'\n');console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{fs.appendFileSync(log,`Exited: code=${code}, signal=${signal}\n`);process.exitCode=code===null?1:code;});
