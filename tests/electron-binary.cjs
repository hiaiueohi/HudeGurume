const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const BUILT=path.join(__dirname,'..','.runtime','windows-build','宛名はがき','宛名はがき.exe');
function electronEnv(){
  const env={...process.env};
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  return env;
}
const usable=binary=>{const result=spawnSync(binary,['--version'],{env:electronEnv(),windowsHide:true});return !result.error&&result.status===0;};
// Some Windows machines block node_modules\electron\dist\electron.exe with an Application
// Control policy. The packaged application is the same Electron build with its own icon and
// version resources, so a copy of it beside the blocked file runs the checks unchanged.
// ATENA_ELECTRON overrides the choice. scripts/build-windows.cjs removes the copy before
// packaging so it never reaches the released folder.
function electronBinary(){
  const override=process.env.ATENA_ELECTRON;
  if(override){
    if(!fs.existsSync(override))throw Error('ATENA_ELECTRON does not exist: '+override);
    return override;
  }
  const stock=require('electron');
  if(usable(stock))return stock;
  const copy=path.join(path.dirname(stock),'atena-dev.exe');
  if(!fs.existsSync(copy)){
    if(!fs.existsSync(BUILT))throw Error('Windowsのアプリ制御が '+stock+' の起動をブロックしています。npm run build:win を実行してからもう一度お試しください。');
    fs.copyFileSync(BUILT,copy);
  }
  if(!usable(copy))throw Error('Electronを起動できません。ATENA_ELECTRONに起動できるElectronの実行ファイルを指定してください。');
  return copy;
}
module.exports={electronBinary,electronEnv};
