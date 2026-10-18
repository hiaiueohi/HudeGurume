(async()=>{
 const $=s=>document.querySelector(s),assert=(v,m)=>{if(!v)throw Error(m);},waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Print state timed out: '+$('#printMessage').textContent);};
 $('#addressTab').click();$('#print').click();await waitFor(()=>$('#printDialog').open&&$('#printMessage').textContent.includes('見つかりません'));
 assert($('#printStart').disabled,'No printers must disable printing');return true;
})()
