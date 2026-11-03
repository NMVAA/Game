import {CLUBS,CLUB_BY_ID,CONTACT_BY_ID,POSITIONS,ASSETS,fixtures,opponentFor} from './data.js';
export const SAVE_KEY='football-life-save-v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const skillAvg=p=>Math.round(Object.values(p.skills).reduce((a,b)=>a+b,0)/4);
const note=(g,text,type='story')=>{g.feed.unshift({text,type,season:g.season,week:g.week,day:g.day});g.feed=g.feed.slice(0,34);};
const chance=g=>{g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;};
const pick=(g,a)=>a[Math.floor(chance(g)*a.length)];
const freshTable=()=>Object.fromEntries(CLUBS.map(c=>[c.id,{played:0,w:0,d:0,l:0,gf:0,ga:0,points:0}]));
export const scorePlayer=g=>Math.round(skillAvg(g.player)*.7 + g.reputation*.3);
export const ratingPlayer=g=>Math.round((g.player.skills.finishing*.25+g.player.skills.passing*.25+g.player.skills.speed*.2+g.player.skills.defense*.15+g.form*.15));
export function newGame(form={}){
  const clubId=CLUB_BY_ID[form.clubId]?form.clubId:'obriy';
  const name=String(form.name||'Алекс').trim().slice(0,24)||'Алекс';
  const position=POSITIONS.some(x=>x.id===form.position)?form.position:'ST';
  const seed=(Date.now() ^ 0x71355420)>>>0;
  const g={version:1,seed,name,age:21,position,clubId,season:1,year:2026,week:1,day:0,
    money:9500,reputation:17,morale:74,energy:88,form:63,stress:12,
    player:{skills:{finishing:position==='ST'?64:55,passing:position==='CM'?65:55,speed:position==='RW'?68:58,defense:position==='CB'?65:45}},
    contract:{wage:2600,until:2028,bonus:240},
    seasonStats:{matches:0,goals:0,assists:0,minutes:0,ratingSum:0},career:{matches:0,goals:0,assists:0,trophies:0},
    table:freshTable(),assets:[],personal:{personId:null,stage:'single',bond:0,trust:55,tension:5,quietDays:0},
    daily:{trained:false,social:false,lifestyle:false},feed:[],offers:[],match:null,lastResult:null,history:[],storyFlag:0};
  g.offers=[makeOffer(g,CLUBS.find(c=>c.id!==clubId&&c.power>=66)?.id||'port')];
  note(g,'Твоя професійна історія починається. Клуб підписав із тобою дворічний контракт.','football');
  note(g,'Тепер кожне рішення — тренування, трансфери та стосунки — має свою ціну.');
  return g;
}
export function loadGame(){
  try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return null;
    const g=JSON.parse(raw);
    if(g?.version===1&&CLUB_BY_ID[g.clubId]&&g.player?.skills&&g.personal&&g.table&&g.daily)return g;
  }catch{}return null;
}
export function saveGame(g){try{localStorage.setItem(SAVE_KEY,JSON.stringify(g));return true;}catch{return false;}}
export const hasGame=()=>!!loadGame();
export const gameClock=g=>`Сезон ${g.year}/${String(g.year+1).slice(-2)} · Тиждень ${g.week}/14 · ${['Пн','Вт','Ср','Чт','Пт','Сб','Нд'][g.day]}`;
export function standings(g){
  return CLUBS.map(c=>({...c,...g.table[c.id]}))
    .sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);
}
export function currentFixture(g){return opponentFor(g.clubId,g.week);}
export function nextDay(g){
  if(g.match)return {ok:false,message:'Спочатку заверши матч.'};
  if(g.day>=6)return {ok:false,message:'Сьогодні матч. Вийди на поле або обери швидку симуляцію.'};
  g.day++;g.daily={trained:false,social:false,lifestyle:false};
  g.energy=clamp(g.energy+11,0,100);
  g.stress=clamp(g.stress-3,0,100);
  if(g.personal.personId){
    g.personal.quietDays++;
    if(g.personal.quietDays>=5){g.personal.bond=clamp(g.personal.bond-3,0,100);g.personal.tension=clamp(g.personal.tension+4,0,100);}
  }
  const roll=chance(g);
  if(roll<.12){g.morale=clamp(g.morale+3,0,100);note(g,'Тренер відзначив твоє ставлення до роботи. +3 настрою.','football');}
  else if(roll>.92){g.stress=clamp(g.stress+5,0,100);note(g,'Після напруженого дня потрібен відпочинок.','story');}
  return {ok:true,message:'Наступний день. Енергія частково відновилася.'};
}
export function train(g,skill){
  if(g.day===6||g.match)return {ok:false,message:'У день матчу інтенсивне тренування недоступне.'};
  if(g.daily.trained)return {ok:false,message:'Ти вже тренувався сьогодні.'};
  if(!Object.hasOwn(g.player.skills,skill))return {ok:false,message:'Невідома вправа.'};
  if(g.energy<19)return {ok:false,message:'Замало енергії. Відпочинь.'};
  const before=g.player.skills[skill];
  const growth=before<75?2:before<90?1:chance(g)<.32?1:0;
  g.player.skills[skill]=clamp(before+growth,0,99);
  g.energy=clamp(g.energy-20,0,100);g.stress=clamp(g.stress+2,0,100);
  g.form=clamp(g.form+2,0,100);g.daily.trained=true;
  note(g,`Тренування: ${skill}. +${growth} до навички, форма зросла.`,'football');
  return {ok:true,message:`Тренування завершене. Навичка +${growth}.`};
}
export function recover(g,kind){
  if(g.match||g.day===6)return {ok:false,message:'Не зараз — матчевий день.'};
  if(g.daily.lifestyle)return {ok:false,message:'Дозвілля на сьогодні вже використано.'};
  const options={rest:{cost:0,energy:21,stress:-7,morale:1,text:'Тихий вечір удома'},
    gym:{cost:50,energy:8,stress:-4,morale:3,text:'Спа та відновлення'},
    party:{cost:340,energy:-13,stress:7,morale:9,text:'Вечірка з друзями'},
    therapy:{cost:110,energy:10,stress:-16,morale:2,text:'Розмова з психологом'}};
  const a=options[kind];if(!a)return {ok:false,message:'Невідома дія.'};
  if(g.money<a.cost)return {ok:false,message:'Недостатньо грошей.'};
  g.money-=a.cost;g.energy=clamp(g.energy+a.energy,0,100);
  g.morale=clamp(g.morale+a.morale,0,100);g.stress=clamp(g.stress+a.stress,0,100);
  if(kind==='party'&&g.personal.personId&&chance(g)<.5){g.personal.tension+=7;note(g,'Партнеру не сподобалося, що ти не попередив про вечірку.','personal');}
  g.daily.lifestyle=true;note(g,a.text+'.','personal');return {ok:true,message:a.text};
}
export function meet(g,id){
  const p=CONTACT_BY_ID[id];
  if(!p||p.age<21)return {ok:false,message:'Контакт недоступний.'};
  if(g.personal.personId)return {ok:false,message:'Спочатку розберися з поточними стосунками.'};
  if(g.daily.social)return {ok:false,message:'Сьогодні вже не залишилося часу для знайомств.'};
  g.personal={personId:id,stage:'acquaintance',bond:18,trust:50,tension:0,quietDays:0};
  g.daily.social=true;note(g,`Ти познайомився з ${p.name} (${p.age}).`,'personal');
  return {ok:true,message:`Нове знайомство: ${p.name}.`};
}
export function relationshipAction(g,action){
  const r=g.personal,p=CONTACT_BY_ID[r.personId];
  if(!p)return {ok:false,message:'Спершу обери людину для знайомства.'};
  if(action==='breakup'){
    const old=p.name;g.personal={personId:null,stage:'single',bond:0,trust:55,tension:5,quietDays:0};
    g.morale=clamp(g.morale-12,0,100);note(g,`Стосунки з ${old} завершилися. Потрібен час, щоб оговтатися.`,'personal');
    return {ok:true,message:'Стосунки завершено.'};
  }
  if(action==='commit'||action==='live'||action==='marry'){
    const need={commit:{stage:'acquaintance',bond:40,trust:35,next:'relationship'},live:{stage:'relationship',bond:65,trust:50,next:'living'},marry:{stage:'living',bond:86,trust:68,next:'married'}}[action];
    if(!need||r.stage!==need.stage||r.bond<need.bond||r.trust<need.trust)return {ok:false,message:'Для цього рішення потрібно більше близькості й довіри.'};
    r.stage=need.next;note(g,`Новий етап стосунків із ${p.name}: ${{commit:'ви пара',live:'живете разом',marry:'одруження'}[action]}.`,'personal');
    g.morale=clamp(g.morale+7,0,100);return {ok:true,message:'Важливий етап ваших стосунків.'};
  }
  if(g.daily.social||g.match||g.day===6)return {ok:false,message:'Сьогодні на особисте життя вже немає часу.'};
  const actions={talk:{cost:0,bond:7,trust:6,energy:-3,text:'Щира розмова'},
    date:{cost:180,bond:12,trust:4,energy:-7,text:'Побачення'},
    trip:{cost:700,bond:18,trust:6,energy:-13,text:'Спільна поїздка'},
    surprise:{cost:250,bond:8,trust:9,energy:-2,text:'Приємний сюрприз'}};
  const a=actions[action];if(!a)return {ok:false,message:'Такої дії немає.'};
  if(g.money<a.cost)return {ok:false,message:'Не вистачає грошей.'};
  g.money-=a.cost;g.energy=clamp(g.energy+a.energy,0,100);
  r.bond=clamp(r.bond+a.bond-(r.tension>65?4:0),0,100);
  r.trust=clamp(r.trust+a.trust,0,100);r.tension=clamp(r.tension-10,0,100);r.quietDays=0;
  g.daily.social=true;g.morale=clamp(g.morale+4,0,100);
  note(g,`${a.text} з ${p.name}. Ви стали ближчими.`,'personal');
  return {ok:true,message:`${a.text}: близькість +${a.bond}.`};
}
export function buyAsset(g,id){
  const item=ASSETS.find(a=>a.id===id);
  if(!item)return {ok:false,message:'Невідомий об’єкт.'};
  if(g.assets.includes(id))return {ok:false,message:'Це вже є у твоїй власності.'};
  if(g.money<item.price)return {ok:false,message:'Недостатньо коштів.'};
  g.money-=item.price;g.assets.push(item.id);
  g.reputation=clamp(g.reputation+item.prestige,0,100);
  note(g,`Ти придбав: ${item.name}.`,'personal');return {ok:true,message:'Покупку здійснено.'};
}
function makeOffer(g,id){
  const c=CLUB_BY_ID[id],wage=Math.round((1700+c.power*29+scorePlayer(g)*12)/100)*100;
  return {id:`offer-${g.season}-${g.week}-${id}-${Math.floor(chance(g)*9999)}`,clubId:id,wage,bonus:Math.round((c.power*70+scorePlayer(g)*30)/100)*100,until:g.year+2,expiresWeek:Math.min(14,g.week+3),negotiated:false};
}
export function negotiate(g,id){
  const o=g.offers.find(x=>x.id===id);
  if(!o)return {ok:false,message:'Пропозиція недоступна.'};
  if(o.negotiated)return {ok:false,message:'Ці переговори вже відбулися.'};
  o.negotiated=true;
  if(chance(g)<.62+g.reputation/350){o.wage=Math.round(o.wage*1.16/100)*100;o.bonus=Math.round(o.bonus*1.12/100)*100;
    note(g,`${CLUB_BY_ID[o.clubId].name} погодився підвищити зарплату.`,'transfer');
    return {ok:true,message:'Агент домовився про підвищену зарплату.'};}
  note(g,`${CLUB_BY_ID[o.clubId].name} відхилив фінансові вимоги.`,'transfer');
  return {ok:true,message:'Клуб не погодився на підвищення.'};
}
export function acceptOffer(g,id){
  if(g.match)return {ok:false,message:'Заверши матч перед переговорами.'};
  const o=g.offers.find(x=>x.id===id);
  if(!o)return {ok:false,message:'Пропозицію вже відкликано.'};
  const old=CLUB_BY_ID[g.clubId].name,newClub=CLUB_BY_ID[o.clubId].name;
  g.clubId=o.clubId;g.contract={wage:o.wage,bonus:Math.round(o.wage*.16),until:o.until};
  g.money+=o.bonus;g.morale=clamp(g.morale+9,0,100);g.reputation=clamp(g.reputation+4,0,100);
  if(g.personal.stage==='living'||g.personal.stage==='married'){
    if(chance(g)<.5){g.personal.tension=clamp(g.personal.tension+12,0,100);
      note(g,'Переїзд після трансферу створив напруження вдома.','personal');}
  }
  g.offers=[];note(g,`Трансфер: ${old} → ${newClub}. Підписаний бонус €${o.bonus}.`,'transfer');
  return {ok:true,message:`Контракт із ${newClub} підписано.`};
}
export function rejectOffer(g,id){g.offers=g.offers.filter(x=>x.id!==id);return {ok:true,message:'Пропозицію відхилено.'};}
function registerResult(rowA,rowB,scoreA,scoreB){
  rowA.played++;rowB.played++;rowA.gf+=scoreA;rowA.ga+=scoreB;rowB.gf+=scoreB;rowB.ga+=scoreA;
  if(scoreA>scoreB){rowA.w++;rowA.points+=3;rowB.l++;}
  else if(scoreA<scoreB){rowB.w++;rowB.points+=3;rowA.l++;}
  else {rowA.d++;rowB.d++;rowA.points++;rowB.points++;}
}
function aiGoals(g,power,opponent){
  const lambda=clamp(1.1+(power-opponent)/38,.45,2.1);
  let goals=0;for(let i=0;i<4;i++)if(chance(g)<lambda/4)goals++;
  return goals;
}
export function beginMatch(g){
  if(g.day!==6||g.match)return {ok:false,message:'Матч доступний у неділю.'};
  const fixture=currentFixture(g);if(!fixture)return {ok:false,message:'Не знайдено матч.'};
  g.match={...fixture,turns:0,minute:0,homeGoals:0,awayGoals:0,goals:0,assists:0,actions:0,
    rating:6.0,ball:{x:50,y:50},feed:['Свисток! Твоя кар’єра — у твоїх рішеннях.'],last:'Початок матчу'};
  return {ok:true,message:'Матч розпочато. Обирай дію на полі.'};
}
export function matchAction(g,action){
  const m=g.match;if(!m)return {ok:false,message:'Матч не розпочався.'};
  if(!['pass','dribble','shoot','press'].includes(action))return {ok:false,message:'Невідома дія.'};
  const ownHome=m.home===g.clubId,ours=ownHome?'homeGoals':'awayGoals',theirs=ownHome?'awayGoals':'homeGoals';
  const condition=clamp((g.energy-25)/100,-.15,.6),o=CLUB_BY_ID[ownHome?m.away:m.home];
  const value=g.player.skills,opp=o.power,roll=chance(g),quality=clamp((g.form-50)/210+condition/4,-.18,.18);
  let line='';
  const scoring=(base)=>chance(g)<clamp(base+(scorePlayer(g)-opp)/220+quality,.03,.66);
  if(action==='pass'){
    const good=roll<clamp(.54+value.passing/250+quality,.25,.94);
    if(good){m.rating+=.12;if(scoring(.08)){m[ours]++;m.assists++;m.rating+=.47;line='Точний пас у штрафний — партнер забиває! Асист!';}
      else line='Точний пас. Команда розвиває атаку.';}
    else {m.rating-=.13;line='Неточна передача. Суперник перехопив м’яч.';}
  }else if(action==='dribble'){
    const good=roll<clamp(.34+value.speed/230+quality,.2,.87);
    if(good){m.rating+=.22;line='Обіграш один в один! Ти відкрив простір для атаки.';}
    else {m.rating-=.22;line='Захисник прочитав твій фінт. Втрата м’яча.';}
    g.energy=clamp(g.energy-3,0,100);
  }else if(action==='shoot'){
    const goal=scoring(.02+value.finishing/440);
    if(goal){m[ours]++;m.goals++;m.rating+=.8;line='ГОООЛ! Твій удар знаходить ворота!';}
    else {m.rating-=.07;line=roll>.55?'Постріл повз дальню стійку.':'Воротар рятує команду після удару.';}
    g.energy=clamp(g.energy-2,0,100);
  }else{
    const good=roll<clamp(.36+value.defense/270+quality,.15,.85);
    if(good){m.rating+=.2;line='Ти виграв боротьбу та повернув м’яч команді.';}
    else {m.rating-=.1;line='Пресинг не спрацював, суперник зберігає м’яч.';}
  }
  const enemyChance=clamp(.12+(opp-scorePlayer(g))/170+g.stress/600,.03,.31);
  if(chance(g)<enemyChance){m[theirs]++;line+=' Суперник відповідає голом.';}
  else if(chance(g)<.08){m[ours]++;line+=' Команда забиває після колективної атаки!';}
  m.turns++;m.minute=Math.min(90,m.turns*8);m.last=line;m.feed.unshift(`${m.minute}' · ${line}`);m.feed=m.feed.slice(0,9);m.rating=clamp(m.rating,4.5,10);
  m.ball={x:clamp(12+chance(g)*77,8,92),y:clamp(10+chance(g)*80,8,92)};
  if(m.turns>=12)return finishMatch(g);
  return {ok:true,message:line};
}
function finishMatch(g){
  const m=g.match,ownHome=m.home===g.clubId;
  for(const fixture of fixtures(g.week)){
    let a,b;
    if(fixture.home===m.home&&fixture.away===m.away){a=m.homeGoals;b=m.awayGoals;}
    else {a=aiGoals(g,CLUB_BY_ID[fixture.home].power,CLUB_BY_ID[fixture.away].power);
      b=aiGoals(g,CLUB_BY_ID[fixture.away].power,CLUB_BY_ID[fixture.home].power);}
    registerResult(g.table[fixture.home],g.table[fixture.away],a,b);
  }
  const earned=g.contract.wage+g.contract.bonus*m.goals+Math.round(g.contract.bonus*.7)*m.assists;
  const ownScore=ownHome?m.homeGoals:m.awayGoals,oppScore=ownHome?m.awayGoals:m.homeGoals;
  g.money+=earned;
  const s=g.seasonStats;s.matches++;s.goals+=m.goals;s.assists+=m.assists;s.minutes+=90;s.ratingSum+=m.rating;
  g.career.matches++;g.career.goals+=m.goals;g.career.assists+=m.assists;
  g.form=clamp(g.form+(m.rating-6.5)*3,30,99);
  g.morale=clamp(g.morale+(ownScore>oppScore?7:ownScore===oppScore?1:-6),0,100);
  g.energy=clamp(g.energy-21,10,100);g.reputation=clamp(g.reputation+(m.goals?3:0)+(m.rating>7.5?2:0),0,100);
  g.lastResult={...m,earned,ownScore,oppScore};
  g.history.unshift({season:g.season,week:g.week,club:g.clubId,opponent:ownHome?m.away:m.home,score:`${ownScore}:${oppScore}`,rating:Math.round(m.rating*10)/10,goals:m.goals});
  g.history=g.history.slice(0,22);
  note(g,`Матч ${CLUB_BY_ID[m.home].name} ${m.homeGoals}:${m.awayGoals} ${CLUB_BY_ID[m.away].name}. Твоя оцінка ${m.rating.toFixed(1)}. Заробіток €${earned}.`,'football');
  if(g.personal.personId&&g.personal.stage!=='acquaintance')g.personal.tension=clamp(g.personal.tension+2,0,100);
  g.match=null;g.day=0;g.week++;g.daily={trained:false,social:false,lifestyle:false};g.energy=clamp(g.energy+7,0,100);
  g.offers=g.offers.filter(o=>o.expiresWeek>=g.week);
  if([3,6,9,12].includes(g.week)&&g.offers.length<3){
    const pool=CLUBS.filter(c=>c.id!==g.clubId&&!g.offers.some(o=>o.clubId===c.id));
    if(pool.length){const offer=makeOffer(g,pick(g,pool).id);g.offers.push(offer);
      note(g,`Агент отримав пропозицію від ${CLUB_BY_ID[offer.clubId].name}.`,'transfer');}
  }
  if(g.week>14){
    const champion=standings(g)[0];
    note(g,`Сезон завершено. Чемпіон — ${champion.name}. Починається нова футбольна глава.`,'football');
    if(champion.id===g.clubId){g.career.trophies++;g.money+=3500;}
    g.season++;g.year++;g.age++;g.week=1;g.table=freshTable();
    g.seasonStats={matches:0,goals:0,assists:0,minutes:0,ratingSum:0};
    g.offers=[];g.reputation=clamp(g.reputation+2,0,100);
  }
  return {ok:true,message:`Матч завершено: ${ownScore}:${oppScore}. Отримано €${earned}.`,finished:true};
}
export function quickMatch(g){
  if(g.day!==6||g.match)return {ok:false,message:'Зараз неможливо симулювати матч.'};
  beginMatch(g);let result={ok:true,message:''};
  const choices=['pass','dribble','press','shoot','pass','pass','dribble','shoot','press','pass','shoot','pass'];
  for(const action of choices)result=matchAction(g,action);
  return result;
}
