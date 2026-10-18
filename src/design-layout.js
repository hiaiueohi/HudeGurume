(function(root){
  const catalog=typeof module!=='undefined'?require('./design-catalog.js'):root.NengaCatalog;
  const factory=typeof module!=='undefined'?require('./layout-model.js'):root.PostcardLayoutModel;
  const api=factory.create({elements:['headline','date','message','sender','background'],names:{headline:'見出し',date:'年・日付',message:'あいさつ文',sender:'差出人',background:'イラスト（背景全体）'},validId:id=>catalog.items.some(item=>item.id===id)});
  if(typeof module!=='undefined')module.exports=api;root.NengaLayout=api;
})(typeof globalThis!=='undefined'?globalThis:this);
