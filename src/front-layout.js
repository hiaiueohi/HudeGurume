(function(root){
  const factory=typeof module!=='undefined'?require('./layout-model.js'):root.PostcardLayoutModel;
  const api=factory.create({elements:['names','address','building','postal','sender','senderzip','newyear'],names:{names:'宛先の氏名・連名',address:'宛先の住所',building:'建物名・部屋番号',postal:'宛先の郵便番号',sender:'差出人の氏名・住所',senderzip:'差出人の郵便番号',newyear:'年賀の文字'},groupKey:'records',validId:id=>typeof id==='string'&&id.length>0&&id.length<=200&&!['__proto__','constructor','prototype'].includes(id)});
  if(typeof module!=='undefined')module.exports=api;root.FrontLayout=api;
})(typeof globalThis!=='undefined'?globalThis:this);
