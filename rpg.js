/**
 * Football Life RPG. Lazily attached to g.story without changing save version.
 * Level-ups are two-choice swipe scenes. Perks are gameplay modifiers, not
 * cosmetic unlocks. Checks use the saved game seed and display their odds.
 */
const clamp=(x,a=0,b=100)=>Math.max(a,Math.min(b,x));
export const RPG_ATTRIBUTES=[
 {id:'technique',name:'Техніка',description:'Пас, удар та дриблінг'},
 {id:'discipline',name:'Воля',description:'Психологічна стійкість і концентрація'},
 {id:'endurance',name:'Витривалість',description:'Матчева енергія й відновлення'},
 {id:'charisma',name:'Харизма',description:'Контракти, розмови та стосунки'},
 {id:'insight',name:'Інтуїція',description:'Переговорні ризики й сюжетні перевірки'}
];
export const RPG_PERKS=[
 {id:'precision',name:'Майстер м’яча',attribute:'technique',
  description:'Точність матчевих дій, вищий потенціал тренувань',detail:'+техніка, +2% до ефективності матчевих дій за ранг'},
 {id:'leader',name:'Лідер роздягальні',attribute:'charisma',
  description:'Сильніший вплив на тренера й капітана',detail:'+харизма, додаткова довіра тренера за сюжетні рішення'},
 {id:'negotiator',name:'Переговорник',attribute:'charisma',
  description:'Кращі контракти та складні розмови',detail:'+харизма, +6% до шансів переговорів за ранг'},
 {id:'analyst',name:'Тактик',attribute:'insight',
  description:'Більше шансів на перевірках у сюжетах',detail:'+інтуїція, +4% до сюжетних перевірок за ранг'},
 {id:'iron',name:'Залізні легені',attribute:'endurance',
  description:'Менша втома й швидше відновлення',detail:'+витривалість, +2 енергії на день за ранг'},
 {id:'composure',name:'Холодна голова',attribute:'discipline',
  description:'Менше стресу та впевненіша гра',detail:'+воля, менше стресу після рішень, вища ігрова якість'}
];
const perkById=Object.fromEntries(RPG_PERKS.map(p=>[p.id,p]));
const attrById=Object.fromEntries(RPG_ATTRIBUTES.map(a=>[a.id,a]));
export function xpForLevel(level){return 80+level*34;}
export function initRpg(g){
 if(!g.story)throw Error('Спершу розпочни кар’єру.');
 if(g.story.rpg?.attributes)return g.story.rpg;
 const attributes={technique:2,discipline:2,endurance:2,charisma:2,insight:2};
 if(g.position==='CM')attributes.technique++;
 else if(g.position==='CB')attributes.discipline++;
 else if(g.position==='RW')attributes.endurance++;
 else if(g.position==='ST')attributes.charisma++;
 const r={level:1,xp:0,totalXp:0,attributes,perks:{},
   pendingLevelUps:0,offered:null,lastGain:null,lastCheck:null,
   history:[],totalChecks:0,passedChecks:0};
 g.story.rpg=r;return r;
}
export const perkRank=(g,id)=>g.story?.rpg?.perks?.[id]||0;
export function awardXp(g,amount,reason){
 const r=initRpg(g);
 amount=Math.max(0,Math.floor(amount));
 if(!amount)return null;
 r.xp+=amount;r.totalXp+=amount;
 const oldLevel=r.level;
 while(r.level<30&&r.xp>=xpForLevel(r.level)){
  r.xp-=xpForLevel(r.level);r.level++;r.pendingLevelUps++;
 }
 if(r.level>=30)r.xp=Math.min(r.xp,xpForLevel(30));
 const raised=r.level-oldLevel;
 r.lastGain={amount,reason,raised,level:r.level};
 r.history.unshift({type:'xp',reason,amount,level:r.level});
 if(raised)r.history.unshift({type:'level',reason:'Новий рівень!',amount:raised,level:r.level});
 r.history=r.history.slice(0,32);
 return {amount,reason,raised,level:r.level,available:r.pendingLevelUps};
}
function perkOptions(g){
 const r=initRpg(g);
 if(r.offered?.length===2&&r.offered.every(id=>perkRank(g,id)<3))return r.offered;
 const available=RPG_PERKS.filter(p=>perkRank(g,p.id)<3);
 const start=(r.level*2+Math.floor(r.totalXp/100))%available.length;
 const first=available[start],second=available[(start+1)%available.length];
 r.offered=[first.id,second.id];
 return r.offered;
}
export function perkLevelScene(g){
 const r=initRpg(g);
 if(r.pendingLevelUps<=0)return null;
 const [left,right]=perkOptions(g).map(id=>perkById[id]);
 return {
  id:'rpg-level',tag:'RPG · РОЗВИТОК',title:'Рівень '+r.level+': твоя спеціалізація',
  text:'Ти здобув новий рівень. Обери одну спеціалізацію: її бонуси діятимуть у кар’єрі й особистому житті.',
  a:{label:left.name,sub:left.description,id:'rpg:'+left.id},
  b:{label:right.name,sub:right.description,id:'rpg:'+right.id},
  art:'training',major:false,
  rpgLevel:{level:r.level,left:left.detail,right:right.detail}
 };
}
export function choosePerk(g,id){
 const r=initRpg(g),perkId=id.slice(4),def=perkById[perkId];
 if(r.pendingLevelUps<=0||!def||!perkOptions(g).includes(perkId)||perkRank(g,perkId)>=3)
  return {ok:false,message:'Цю спеціалізацію зараз обрати неможливо.'};
 r.perks[perkId]=perkRank(g,perkId)+1;
 r.attributes[def.attribute]=Math.min(10,(r.attributes[def.attribute]||2)+1);
 r.pendingLevelUps--;r.offered=null;
 const rank=r.perks[perkId];
 const message='Здібність «'+def.name+'» — ранг '+rank+'. '+def.description+'.';
 r.history.unshift({type:'perk',reason:message,level:r.level});
 r.history=r.history.slice(0,32);
 return {ok:true,message,rpgPerk:{name:def.name,rank,attribute:attrById[def.attribute].name},
   noXp:true};
}
export function rpgBonus(g,kind){
 const ranks=g.story?.rpg?.perks||{};
 return {
  action:(ranks.precision||0)*.02+(ranks.composure||0)*.012,
  contract:(ranks.negotiator||0)*.06+(ranks.analyst||0)*.01,
  recovery:(ranks.iron||0)*2,
  stress:(ranks.composure||0),
  training:(ranks.precision||0)>=2?1:0,
  relationship:(ranks.leader||0)*2+(ranks.negotiator||0),
  check:(ranks.analyst||0)*.04,
  fatigue:(ranks.iron||0)*2
 }[kind]||0;
}
export const RPG_CHECK_MAP={
 shadow:'insight',derby:'discipline',city:'charisma',armband:'charisma',
 limit:'endurance',truth:'insight',budget:'charisma',witness:'insight'
};
export function skillChance(g,attribute,hard=0){
 const r=initRpg(g);
 const value=r.attributes[attribute]||2;
 return clamp(.53+(value-2)*.075+rpgBonus(g,'check')-hard
  +(g.morale-50)/700-g.stress/950,.22,.91);
}
export function previewRpgCheck(g,plotKey,step,side=0){
 if(step!==2&&step!==4)return null;
 const attribute=RPG_CHECK_MAP[plotKey]||'insight';
 const attr=attrById[attribute];
 const hard=(step===4?.13:.055)+(side===1?.05:0);
 const odds=skillChance(g,attribute,hard);
 return {attribute,attributeName:attr.name,odds:Math.round(odds*100),chance:odds};
}
export function resolveRpgCheck(g,plotKey,step,side){
 const preview=previewRpgCheck(g,plotKey,step,side);
 if(!preview)return null;
 // Same deterministic RNG formula as the game engine; a saved decision can
 // never be re-rolled by closing the screen before making a swipe.
 g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;
 const roll=g.seed/4294967296;
 const success=roll<preview.chance;
 const r=initRpg(g);r.totalChecks++;if(success)r.passedChecks++;
 const record={...preview,success,plot:plotKey,stage:step};
 r.lastCheck=record;
 r.history.unshift({type:'check',reason:plotKey+' · '+preview.attributeName,
  success,odds:preview.odds,level:r.level});
 r.history=r.history.slice(0,32);
 return record;
}
export function rpgSnapshot(g){
 const r=initRpg(g);
 return {
  level:r.level,xp:r.xp,required:xpForLevel(r.level),totalXp:r.totalXp,
  pending:r.pendingLevelUps,attributes:RPG_ATTRIBUTES.map(attr=>({
   ...attr,value:r.attributes[attr.id]||2})),
  perks:RPG_PERKS.map(p=>({...p,rank:r.perks[p.id]||0})),
  checks:r.totalChecks,passed:r.passedChecks,
  history:r.history.slice(0,10)
 };
}
