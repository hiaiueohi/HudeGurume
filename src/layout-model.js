(function(root){
  function create({elements,names,groupKey='designs',validId}){
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const empty=()=>({common:{},[groupKey]:{}});
    function normalizeGroup(input){
      if(!object(input))throw Error('配置データの形式が不正です。');
      const output={};
      for(const key of Object.keys(input)){
        if(!elements.includes(key)||!object(input[key]))throw Error('対応していない編集項目です。');
        const value={};
        for(const [property,v]of Object.entries(input[key])){
          if(property==='writingMode'&&key!=='background'){
            if(!['horizontal','vertical'].includes(v))throw Error('文字の向きを確認してください。');value[property]=v;continue;
          }
          const limits=property==='x'?[-100,100]:property==='y'?[-148,148]:property==='scale'&&key==='background'?[.5,1.8]:key!=='background'?({fontSize:[4,72],width:[4,100],height:[4,148]})[property]:null;
          if(!limits||typeof v!=='number'||!Number.isFinite(v)||v<limits[0]||v>limits[1])throw Error('配置・文字サイズの数値が範囲外です。');
          value[property]=Math.round(v*1000)/1000;
        }
        if(Object.keys(value).length)output[key]=value;
      }return output;
    }
    function validate(input){
      if(input==null)return empty();
      if(!object(input)||Object.keys(input).some(k=>!['common',groupKey].includes(k))||!object(input[groupKey]||{}))throw Error('配置データの形式が不正です。');
      const output={common:normalizeGroup(input.common||{}),[groupKey]:{}};
      for(const [id,group]of Object.entries(input[groupKey]||{})){
        if(!validId(id))throw Error('配置の適用先が不正です。');
        const normalized=normalizeGroup(group);if(Object.keys(normalized).length)output[groupKey][id]=normalized;
      }return output;
    }
    function resolve(layout,id,key){return {x:0,y:0,...(key==='background'?{scale:1}:{}),...layout?.common?.[key],...layout?.[groupKey]?.[id]?.[key]};}
    function draft(layout,id){return Object.fromEntries(elements.map(key=>[key,resolve(layout,id,key)]));}
    function diff(before,after){const changes={};for(const key of elements)if(JSON.stringify(before[key])!==JSON.stringify(after[key]))changes[key]={...after[key]};return changes;}
    function apply(input,id,changes,scope){
      if(!validId(id)||!['one','all'].includes(scope))throw Error('適用先を選んでください。');
      const layout=validate(input),patch=normalizeGroup(changes);
      if(scope==='one'){
        const group=layout[groupKey][id]||{};
        for(const key of Object.keys(patch))group[key]={...group[key],...patch[key]};
        if(Object.keys(group).length)layout[groupKey][id]=group;
      }else for(const key of Object.keys(patch)){
        layout.common[key]={...layout.common[key],...patch[key]};
        for(const [otherId,group]of Object.entries(layout[groupKey])){
          if(group[key]){for(const property of Object.keys(patch[key]))delete group[key][property];if(!Object.keys(group[key]).length)delete group[key];}
          if(!Object.keys(group).length)delete layout[groupKey][otherId];
        }
      }return validate(layout);
    }
    return {elements,names,empty,validate,resolve,draft,diff,apply};
  }
  if(typeof module!=='undefined')module.exports={create};root.PostcardLayoutModel={create};
})(typeof globalThis!=='undefined'?globalThis:this);
