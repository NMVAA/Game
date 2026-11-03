/**
 * Choice outcome presentation: explicit, player-visible effects.
 *
 * This module reads differences before/after a real game decision. It NEVER
 * simulates extra effects or changes the save. "Soon" events are reported as
 * pending rather than as guaranteed future results.
 */
const track=[
 ['money','Гроші','€'],
 ['energy','Енергія','%'],
 ['form','Форма','%'],
 ['morale','Настрій','%'],
 ['stress','Стрес','%'],
 ['reputation','Репутація','%'],
 ['clubTrust','Довіра клубу','%'],
 ['agentTrust','Довіра агента','%'],
 ['scandal','Публічний скандал','%'],
 ['personal.trust','Довіра партнера','%'],
 ['personal.bond','Близькість','%'],
 ['personal.tension','Напруга у стосунках','%'],
 ['personalPerson','Особисті стосунки',''],
 ['coachResentment','Образа тренера','%'],
 ['captainTrust','Довіра капітана','%'],
 ['agentResentment','Образа агента','%'],
 ['personalResentment','Образа партнера','%']
];
const read=(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj);
export function captureOutcomeState(game){
 const s=game.story||{},memory=s.memory?.actors||{};
 const values={
  money:game.money,energy:game.energy,form:game.form,morale:game.morale,
  stress:game.stress,reputation:game.reputation,
  clubTrust:s.clubTrust,agentTrust:s.agentTrust,scandal:s.scandal,
  personal:{trust:game.personal?.trust,bond:game.personal?.bond,
   tension:game.personal?.tension},
  coachResentment:memory.coach?.resentment,
  captainTrust:memory.captain?.trust,
  agentResentment:memory.agent?.resentment,
  personalResentment:game.personal?.personId?
   memory['partner:'+game.personal.personId]?.resentment:undefined
 };
 const pending=(s.pending||[]).map((item,i)=>({
  key:item.key||item.serial||item.kind+'|'+item.due+'|'+i,
  kind:item.kind,due:item.due,chapter:item.payload?.stage
 }));
 return {
  values,pending,
  personId:game.personal?.personId||null,
  stage:game.personal?.stage||'single',
  clubId:game.clubId,
  week:game.week,day:game.day,season:game.season,
  plotStatus:s.plots?.completed?.length||0
 };
}
const expectedGood={
 money:1,energy:1,form:1,morale:1,stress:-1,
 reputation:1,clubTrust:1,agentTrust:1,scandal:-1,
 'personal.trust':1,'personal.bond':1,'personal.tension':-1,
 coachResentment:-1,captainTrust:1,agentResentment:-1,personalResentment:-1
};
function formatStat(key,delta,unit){
 const positive=delta>0?'+':'−',absolute=Math.abs(delta);
 return unit==='€'?positive+'€'+Math.round(absolute).toLocaleString('uk-UA'):
 positive+Number(absolute.toFixed(1))+unit;
}
function delayedLabel(kind){
 if(kind==='plotScene')return 'Продовження сюжетної історії';
 if(kind?.includes('Coach')||kind==='memorySelection'||kind==='memoryOpportunity')return 'Рішення тренера або конкуренція за склад';
 if(kind?.includes('Agent')||kind==='memoryBoard'||kind==='agentLeak')return 'Наслідки для агента й контракту';
 if(kind?.includes('Partner')||kind==='memoryRelationship'||kind==='memoryRelocation')return 'Розвиток особистих стосунків';
 if(kind?.startsWith('adult'))return 'Подальша подія особистого життя';
 if(kind==='rehab')return 'Медичні наслідки навантаження';
 if(kind==='photo'||kind?.includes('Media')||kind==='sponsorThreat')return 'Преса, репутація або спонсори';
 if(kind==='investment')return 'Наслідки фінансового рішення';
 return 'Нова подія, пов’язана з рішенням';
}
export function describeChoiceOutcome(before,game,scene,side,result){
 const after=captureOutcomeState(game),effects=[];
 for(const [key,label,unit] of track){
  if(key==='personalPerson')continue;
  const a=read(before.values,key),b=read(after.values,key);
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(b-a)<.05)continue;
  const delta=b-a,impact=expectedGood[key]===undefined?0:Math.sign(delta)*expectedGood[key];
  effects.push({key,label,value:formatStat(key,delta,unit),impact,
    size:Math.abs(delta),difference:delta});
 }
 if(before.personId!==after.personId){
  effects.unshift({key:'relationship',label:'Особисте життя',
   value:after.personId?'Нове знайомство':'Стосунки завершені',
   impact:0,size:100});
 }else if(before.stage!==after.stage){
  const stageName={acquaintance:'Знайомство',relationship:'Пара',
   living:'Спільне життя',married:'Шлюб',single:'Вільний'};
  effects.unshift({key:'stage',label:'Етап стосунків',value:stageName[after.stage]||after.stage,
   impact:1,size:100});
 }
 if(before.clubId!==after.clubId){
  effects.unshift({key:'club',label:'Клуб',value:'Перехід до іншої команди',impact:0,size:100});
 }
 effects.sort((a,b)=>{
  const priorities={money:3,'personal.trust':3,clubTrust:3,agentTrust:3,reputation:3,
   form:2,energy:2,stress:2,'personal.bond':2};
  return (priorities[b.key]||0)-(priorities[a.key]||0)||b.size-a.size;
 });
 const was=new Set(before.pending.map(x=>String(x.key)));
 const future=after.pending.filter(x=>!was.has(String(x.key)));
 const day=n=>(n.season-1)*98+(n.week-1)*7+n.day;
 const now=day(after);
 const delayed=future.sort((a,b)=>a.due-b.due).slice(0,3).map(item=>({
  label:delayedLabel(item.kind),
  days:Math.max(0,item.due-now),
  chapter:item.kind==='plotScene'&&Number.isInteger(item.chapter)?item.chapter+1:null
 }));
 const name=scene?.plot?.name||scene?.title||'Ситуація';
 return {
  context:name,
  choice:(side===0?scene?.a:scene?.b)?.label||'Вибір',
  message:result.message||'Рішення прийнято.',
  changes:effects.slice(0,6),
  totalChanges:effects.length,
  delayed,
  plot:scene.plot?{
   name:scene.plot.name,
   phase:scene.plot.phase,
   chapter:scene.plot.chapter,
   total:scene.plot.total,
   ending:result.plot?.ending||null
  }:null
 };
}
