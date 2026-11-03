// Fictional football universe. All personal-life characters are adults aged 21+.
export const CLUBS = [
  {id:'obriy',name:'ФК Обрій',city:'Київ',power:62,color:'#b7f46b',accent:'#173a3b'},
  {id:'port',name:'Портовик',city:'Одеса',power:67,color:'#74c5ea',accent:'#133558'},
  {id:'granite',name:'Граніт',city:'Кривий Ріг',power:65,color:'#e69c79',accent:'#52302c'},
  {id:'north',name:'Північ',city:'Чернігів',power:71,color:'#dfd5ff',accent:'#3c3468'},
  {id:'vector',name:'Вектор',city:'Дніпро',power:74,color:'#facb79',accent:'#55421b'},
  {id:'wind',name:'Вітер',city:'Львів',power:69,color:'#94d7ad',accent:'#244a40'},
  {id:'titan',name:'Титан',city:'Запоріжжя',power:76,color:'#fa91aa',accent:'#5a2638'},
  {id:'pulse',name:'Пульс',city:'Харків',power:72,color:'#8bcaf5',accent:'#203e60'}
];
export const CONTACTS = [
  {id:'sofia',name:'Софія',age:25,job:'архітекторка',vibe:'Відверта й незалежна',interests:['подорожі','мистецтво'],icon:'✦',color:'#ffa78e'},
  {id:'marta',name:'Марта',age:24,job:'музична продюсерка',vibe:'Любить увагу й пригоди',interests:['музика','нічне життя'],icon:'♫',color:'#c5a7f6'},
  {id:'daniel',name:'Данило',age:27,job:'фотограф',vibe:'Спокійний та уважний',interests:['спорт','подорожі'],icon:'◈',color:'#8bd7c8'},
  {id:'anna',name:'Анна',age:23,job:'рестораторка',vibe:'Амбітна й турботлива',interests:['кухня','бізнес'],icon:'♡',color:'#f4bf73'}
];
export const POSITIONS = [
  {id:'ST',name:'Нападник',focus:'finishing'},
  {id:'RW',name:'Вінгер',focus:'speed'},
  {id:'CM',name:'Півзахисник',focus:'passing'},
  {id:'CB',name:'Захисник',focus:'defense'}
];
export const TRAINING = [
  {id:'finishing',name:'Удари',icon:'◎',detail:'Точність і реалізація'},
  {id:'passing',name:'Пас',icon:'↗',detail:'Бачення поля і асисти'},
  {id:'speed',name:'Швидкість',icon:'⚡',detail:'Ривки та дриблінг'},
  {id:'defense',name:'Оборона',icon:'◇',detail:'Відбір та позиція'}
];
export const ASSETS = [
  {id:'studio',kind:'home',name:'Студія в центрі',price:12000,prestige:3,detail:'Перший власний простір'},
  {id:'loft',kind:'home',name:'Квартира з терасою',price:36000,prestige:7,detail:'Більше комфорту після матчів'},
  {id:'villa',kind:'home',name:'Будинок із садом',price:95000,prestige:12,detail:'Приватність та простір'},
  {id:'hatch',kind:'car',name:'Міський хетчбек',price:6000,prestige:2,detail:'Свобода пересування'},
  {id:'coupe',kind:'car',name:'Спорткупе',price:28000,prestige:6,detail:'Стиль за межами стадіону'},
  {id:'gt',kind:'car',name:'Гран-турер',price:82000,prestige:10,detail:'Помітний статус'}
];
export const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map(c=>[c.id,c]));
export const CONTACT_BY_ID = Object.fromEntries(CONTACTS.map(c=>[c.id,c]));
export const formatCash = n => '€' + Math.round(n).toLocaleString('uk-UA');
export function fixtures(round) {
  const n=CLUBS.length,ids=CLUBS.map(c=>c.id),teams=[...ids],all=[];
  for(let r=0;r<n-1;r++){
    const matches=[];
    for(let k=0;k<n/2;k++){
      let home=teams[k],away=teams[n-1-k];
      if((r+k)%2===1)[home,away]=[away,home];
      matches.push({home,away});
    }
    all.push(matches);
    teams.splice(1,0,teams.pop());
  }
  const index=(round-1)%(2*(n-1));
  return index<n-1?all[index]:all[index-(n-1)].map(m=>({home:m.away,away:m.home}));
}
export const opponentFor = (clubId,week) => fixtures(week).find(m=>m.home===clubId||m.away===clubId);
