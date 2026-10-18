(async()=>{
 const $=s=>document.querySelector(s),assert=(v,m)=>{if(!v)throw Error(m);},change=(id,value)=>{const n=$('#'+id);n.value=value;n.dispatchEvent(new Event('change'));};
 const previous=postcardDesigns.loadProject().project;
 $('#designPreview').click();const field=$('#layoutTextFields [data-field=headline]');field.value='謹賀新年';field.dispatchEvent(new Event('input'));
 change('layoutWritingMode','vertical');change('layoutFontSize','26');change('layoutWidth','16');change('layoutHeight','80');
 assert(getComputedStyle($('#layoutPaper .design-headline')).writingMode==='vertical-rl','Design headline supports vertical writing');
 $('#layoutUndo').click();$('#layoutRedo').click();$('#layoutApply').click();
 let saved=postcardDesigns.loadProject().project;
 assert(saved.headline==='謹賀新年'&&NengaLayout.resolve(saved.layout,saved.designId,'headline').writingMode==='vertical','Edited wording and vertical formatting persist');
 const item=postcardDesigns.list().catalog.items.find(i=>i.id===saved.designId),vertical=await DesignRenderer.renderPNG(item,saved);
 const horizontal=await DesignRenderer.renderPNG(item,{...saved,layout:NengaLayout.apply(saved.layout,item.id,{headline:{writingMode:'horizontal'}},'one')});
 assert(vertical!==horizontal,'Saved image respects vertical versus horizontal writing');
 $('#designPreview').click();document.querySelector('#layoutLayers [data-element=date]').click();const date=$('#layoutTextFields [data-field=dateText]');date.value='2027年 新春';date.dispatchEvent(new Event('input'));$('#layoutApply').click();
 assert(postcardDesigns.loadProject().project.dateText==='2027年 新春','Date text can be edited inside the enlarged canvas editor');
 $('#designCopies').value='2';$('#printDesign').click();
 for(let i=0;i<100&&!$('#printDialog').open;i++)await new Promise(r=>setTimeout(r,20));
 assert($('#printArea .design-headline').textContent==='謹賀新年'&&getComputedStyle($('#printArea .design-headline')).writingMode==='vertical-rl','Print DOM uses edited vertical text');
 $('#printCancel').click();
 return {previous,png:vertical,checks:{vertical:true,horizontal:true,editableText:true,dateText:true,fontSize:true,boxSize:true,undoRedo:true,printDOM:true}};
})()
