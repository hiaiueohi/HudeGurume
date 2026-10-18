const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../src/design-catalog.js');
const {defaultProject}=require('../design-library.cjs');
const root=path.resolve(__dirname,'..');
const profile=path.join(root,'.runtime','design-render-profile');
fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
let win;
app.whenReady().then(async()=>{
 try{
  win=new BrowserWindow({show:false,width:1250,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await win.loadFile(path.join(root,'index.html'));
  const out=path.join(root,'assets','designs','2027','samples');fs.mkdirSync(out,{recursive:true});
  for(const item of catalog.items){
    const project={...defaultProject(),designId:item.id,headline:item.headline,headlineSize:item.font==='sans'?13:item.headline.includes('\n')?18:22};
    const dataUrl=await win.webContents.executeJavaScript('DesignRenderer.renderPNG('+JSON.stringify(item)+','+JSON.stringify(project)+')');
    fs.writeFileSync(path.join(out,item.number+'.png'),Buffer.from(dataUrl.split(',')[1],'base64'));
    console.log(item.number+' '+item.name);
  }
  app.quit();
 }catch(error){console.error(error);app.exit(1);}
});
