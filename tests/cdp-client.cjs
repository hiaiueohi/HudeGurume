class CDPClient{
  constructor(socket){this.socket=socket;this.nextId=0;this.pending=new Map();this.listeners=new Map();socket.addEventListener('message',event=>{const value=JSON.parse(event.data);if(value.id){const item=this.pending.get(value.id);if(!item)return;this.pending.delete(value.id);clearTimeout(item.timer);value.error?item.reject(Error(value.error.message)):item.resolve(value.result);}else for(const listener of this.listeners.get(value.method)||[])listener(value.params);});}
  static async connect(url){const socket=new WebSocket(url);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',()=>reject(Error('Debugger connection failed')),{once:true});});return new CDPClient(socket);}
  send(method,params={}){return new Promise((resolve,reject)=>{const id=++this.nextId,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Debugger call timed out: '+method));},20000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params}));});}
  once(method){return new Promise(resolve=>{const callback=value=>{this.listeners.set(method,(this.listeners.get(method)||[]).filter(fn=>fn!==callback));resolve(value);};this.listeners.set(method,[...(this.listeners.get(method)||[]),callback]);});}
  async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  close(){this.socket.close();}
}
module.exports={CDPClient};
