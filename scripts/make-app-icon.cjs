// Original envelope icon. No downloaded logos, fonts or third-party images.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const folder=path.resolve(__dirname,'../build');fs.mkdirSync(folder,{recursive:true});
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="54" fill="#176b60"/><rect x="41" y="76" width="174" height="120" rx="14" fill="#104e48"/><rect x="41" y="66" width="174" height="120" rx="14" fill="#fffaf0"/><path d="M45 178l64-56m102 56l-64-56" fill="none" stroke="#c2d9cc" stroke-width="7"/><path d="M44 76l73 59a18 18 0 0 0 22 0l73-59" fill="none" stroke="#176b60" stroke-width="8" stroke-linecap="round"/><circle cx="204" cy="59" r="29" fill="#ecc778"/><path d="M192 59h24m-12-12v24" stroke="#176b60" stroke-width="6" stroke-linecap="round"/></svg>';
fs.writeFileSync(path.join(folder,'icon.svg'),svg);
function insideRound(x,y,x0,y0,w,h,r){const cx=Math.max(x0+r,Math.min(x0+w-r,x)),cy=Math.max(y0+r,Math.min(y0+h-r,y));return (x-cx)**2+(y-cy)**2<=r*r;}
function nearLine(x,y,x0,y0,x1,y1,width){const dx=x1-x0,dy=y1-y0,t=Math.max(0,Math.min(1,((x-x0)*dx+(y-y0)*dy)/(dx*dx+dy*dy)));return (x-x0-t*dx)**2+(y-y0-t*dy)**2<=(width/2)**2;}
const colors={green:[23,107,96],shadow:[16,78,72],paper:[255,250,240],fold:[194,217,204],gold:[236,199,120]};
function colorAt(x,y){let c=null;
 if(insideRound(x,y,8,8,240,240,54))c=colors.green;
 if(insideRound(x,y,41,76,174,120,14))c=colors.shadow;
 if(insideRound(x,y,41,66,174,120,14)){
  c=colors.paper;
  if(nearLine(x,y,45,178,109,122,7)||nearLine(x,y,211,178,147,122,7))c=colors.fold;
  if(nearLine(x,y,44,76,128,141,8)||nearLine(x,y,128,141,212,76,8))c=colors.green;
 }
 if((x-204)**2+(y-59)**2<=29**2)c=colors.gold;
 if(nearLine(x,y,192,59,216,59,6)||nearLine(x,y,204,47,204,71,6))c=colors.green;
 return c;
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function chunk(type,data){const name=Buffer.from(type),body=Buffer.concat([name,data]),buffer=Buffer.alloc(data.length+12);buffer.writeUInt32BE(data.length);body.copy(buffer,4);let crc=0xffffffff;for(const b of body)crc=crcTable[(crc^b)&255]^(crc>>>8);buffer.writeUInt32BE((crc^0xffffffff)>>>0,data.length+8);return buffer;}
function png(size){const raw=Buffer.alloc((size*4+1)*size),sampling=4;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  let r=0,g=0,b=0,hits=0;
  for(let sy=0;sy<sampling;sy++)for(let sx=0;sx<sampling;sx++){const c=colorAt((x+(sx+.5)/sampling)*256/size,(y+(sy+.5)/sampling)*256/size);if(c){r+=c[0];g+=c[1];b+=c[2];hits++;}}
  const i=y*(size*4+1)+1+x*4;if(hits){raw[i]=r/hits;raw[i+1]=g/hits;raw[i+2]=b/hits;raw[i+3]=255*hits/sampling**2;}
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const sizes=[16,24,32,48,64,128,256],images=sizes.map(png),header=Buffer.alloc(6+sizes.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);let offset=header.length;
sizes.forEach((size,i)=>{const p=6+i*16;header[p]=size%256;header[p+1]=size%256;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(images[i].length,p+8);header.writeUInt32LE(offset,p+12);offset+=images[i].length;});
fs.writeFileSync(path.join(folder,'icon.ico'),Buffer.concat([header,...images]));fs.writeFileSync(path.join(folder,'icon.png'),images.at(-1));console.log('Application icon created');
