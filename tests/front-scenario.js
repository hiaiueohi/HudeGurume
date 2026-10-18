(async()=>{
 const $=s=>document.querySelector(s),assert=(v,m)=>{if(!v)throw Error(m);},change=(id,value)=>{const n=$('#'+id);n.value=value;n.dispatchEvent(new Event('change'));};
 const stored=()=>addressBookStorage.load().state;
 $('#list .person-button').click();const original=stored(),first=original.records[0],other=original.records[1];
 $('#preview').click();assert($('#layoutEditorDialog').open,'Front preview opens shared editor');
 const name=$('#layoutTextFields [data-field=name]');name.value='山田 編集太郎';name.dispatchEvent(new Event('input'));
 change('layoutWritingMode','horizontal');change('layoutFontSize','20');change('layoutX','-4');
 assert(getComputedStyle($('#layoutPaper .person')).writingMode==='horizontal-tb','Front names support horizontal writing');
 $('#layoutApply').click();let saved=stored();
 assert(saved.records[0].name==='山田 編集太郎'&&saved.records[1].name===other.name,'Content edits affect only selected recipient');
 assert(FrontLayout.resolve(saved.frontLayout,first.id,'names').x===-4&&FrontLayout.resolve(saved.frontLayout,other.id,'names').x===0,'Per-recipient placement is isolated');
 $('#openFrontLayoutEditor').click();change('layoutX','-2');document.querySelector('input[name=layoutScope][value=all]').click();$('#layoutApply').click();saved=stored();
 assert(FrontLayout.resolve(saved.frontLayout,other.id,'names').x===-2&&FrontLayout.resolve(saved.frontLayout,other.id,'names').writingMode==='horizontal','All-recipient formatting propagates without overwriting names');
 $('#openFrontLayoutEditor').click();document.querySelector('#layoutLayers [data-element=address]').click();const address=$('#layoutTextFields [data-field=address]');address.value='';address.dispatchEvent(new Event('input'));$('#layoutApply').click();assert($('#layoutEditorDialog').open&&$('#layoutEditorMessage').classList.contains('error'),'Invalid text cannot save');$('#layoutCancel').click();
 assert(stored().records[0].address===first.address,'Cancel retains stored text');
 // Restore the name used by the regression scenario while keeping saved formatting.
 $('#openFrontLayoutEditor').click();const field=$('#layoutTextFields [data-field=name]');field.value=first.name;field.dispatchEvent(new Event('input'));$('#layoutApply').click();
 return {oneRecipient:true,allRecipients:true,contentIsolated:true,horizontal:true,fontSize:true,cancel:true,validation:true};
})()
