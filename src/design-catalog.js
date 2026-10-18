(function (root) {
  const catalog = {
    year: 2027, zodiac: '未', animal: 'ひつじ', folderName: '2027年_未（ひつじ）',
    items: [
      {id:'washi-gold', number:'01', name:'和紙と金彩', category:'和風', description:'紅い日の出と金彩、晴れやかな和紙のひつじ。', color:'#8d3028', font:'serif', headline:'謹賀新年'},
      {id:'sheep-family', number:'02', name:'ひつじの家族', category:'かわいい', description:'笑顔の親子ひつじ。やさしい色で家族や友人へ。', color:'#986044', font:'rounded', headline:'あけまして\nおめでとう'},
      {id:'watercolor-plum', number:'03', name:'梅香る水彩', category:'水彩', description:'梅の花と朝の光を、淡い水彩で描いた一枚。', color:'#6a7057', font:'serif', headline:'迎春'},
      {id:'nordic-garden', number:'04', name:'北欧のひつじ', category:'シンプル', description:'くすみカラーと草花。落ち着いた北欧の雰囲気。', color:'#365e52', font:'sans', headline:'HAPPY NEW YEAR'},
      {id:'sumi-sunrise', number:'05', name:'墨と初日の出', category:'和風', description:'墨の筆致と朱色の太陽。凛とした大人の年賀状。', color:'#373a35', font:'serif', headline:'謹賀新年'},
      {id:'felt-friends', number:'06', name:'ふわふわの冬便り', category:'かわいい', description:'羊毛フェルトのふたりが届ける、ぬくもりのご挨拶。', color:'#82634f', font:'rounded', headline:'あけまして\nおめでとう'}
    ]
  };
  for (const item of catalog.items) {
    item.image = 'assets/designs/2027/' + item.number + '.png';
    item.sample = 'assets/designs/2027/samples/' + item.number + '.png';
    item.filename = item.number + '_' + item.name;
  }
  if (typeof module !== 'undefined') module.exports = catalog;
  root.NengaCatalog = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);
