const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const log=path.join(__dirname,'startup.log');
const executable=path.join(__dirname,'node_modules','electron','dist','electron.exe');
const env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
fs.appendFileSync(log,`\n${new Date().toISOString()} Starting desktop application\n`);
if(!fs.existsSync(executable)){console.error('Electron is missing. Run npm install and node node_modules/electron/install.js');process.exit(1);}
// This is the interactive application window requested by the user.
const child=spawn(executable,[__dirname],{cwd:__dirname,env,windowsHide:false,stdio:['ignore','pipe','pipe']});
for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{fs.appendFileSync(log,data);process.stdout.write(data);});
child.on('error',error=>{fs.appendFileSync(log,error.stack+'\n');console.error(error.message);process.exitCode=1;});
child.on('exit',(code,signal)=>{fs.appendFileSync(log,`Exited: code=${code}, signal=${signal}\n`);process.exitCode=code===null?1:code;});
