/**
 * Persistent narrative memory for Football Life.
 * All people in romantic branches are 21+. This module has no UI dependencies.
 *
 * The simulation remembers individual promises, grudges and loyalties rather
 * than just incrementing the global morale/reputation gauges.
 */
const clamp = value => Math.max(0, Math.min(100, value));
export const storyDay = g => (g.season - 1) * 98 + (g.week - 1) * 7 + g.day;
const actorLabels = {coach:'Тренер',agent:'Агент',captain:'Капітан',press:'Редакція'};
export function actorLabel(g,id) {
  if(id?.startsWith('partner:')) {
    const {personId}=g.personal||{};
    if(personId===id.slice(8))return 'Партнер';
    return 'Колишні стосунки';
  }
  return actorLabels[id] || id;
}
export function initMemory(g) {
  if(!g.story)throw new Error('Історія кар’єри ще не створена.');
  const s=g.story;
  if(!s.memory || !s.memory.actors) {
    s.memory = {
      version:1, actors:{}, promises:[], history:[], arcs:[],
      serial:0, lastProcessedDay:-1, careerDoors:{}, socialDebt:0
    };
  }
  const mem=s.memory;
  mem.promises ||= [];mem.history ||= [];mem.arcs ||= [];mem.careerDoors ||= {};
  mem.serial ||= 0;
  for(const key of ['coach','agent','captain','press']){
    if(!mem.actors[key]){
      const baseline=key==='coach'?s.clubTrust:key==='agent'?s.agentTrust:key==='captain'?51:50;
      mem.actors[key]={trust:clamp(baseline??50),affinity:50,resentment:0,loyalty:0,memories:[],lastContact:storyDay(g)};
    }
  }
  if(g.personal?.personId){
    const id='partner:'+g.personal.personId;
    if(!mem.actors[id])mem.actors[id]={trust:clamp(g.personal.trust??50),affinity:clamp(g.personal.bond??40),resentment:0,loyalty:0,memories:[],lastContact:storyDay(g)};
  }
  return mem;
}
export function remember(g,actor,key,description,changes={}) {
  const mem=initMemory(g);
  if(!mem.actors[actor])mem.actors[actor]={trust:50,affinity:50,resentment:0,loyalty:0,memories:[],lastContact:storyDay(g)};
  const a=mem.actors[actor];
  for(const metric of ['trust','affinity','resentment','loyalty'])a[metric]=clamp((a[metric]||0)+(changes[metric]||0));
  a.lastContact=storyDay(g);
  const note={key,description,day:storyDay(g),impact:changes};
  a.memories.unshift(note);a.memories=a.memories.slice(0,24);
  mem.history.unshift({actor,key,description,day:storyDay(g)});
  mem.history=mem.history.slice(0,120);
  // Keep existing career/relationship signals aligned with character memory.
  if(actor==='coach')g.story.clubTrust=clamp((g.story.clubTrust||50)+(changes.trust||0));
  if(actor==='agent')g.story.agentTrust=clamp((g.story.agentTrust||50)+(changes.trust||0));
  if(actor.startsWith('partner:') && actor.slice(8)===g.personal?.personId){
    g.personal.trust=clamp((g.personal.trust||0)+(changes.trust||0));
    g.personal.bond=clamp((g.personal.bond||0)+(changes.affinity||0));
    g.personal.tension=clamp((g.personal.tension||0)+(changes.resentment||0));
  }
  return a;
}
export function memoryOf(g,id) {return initMemory(g).actors[id] || null;}
export const currentPartnerId = g => g.personal?.personId?'partner:'+g.personal.personId:null;
export function makePromise(g,actor,key,text,days=3) {
  const mem=initMemory(g),now=storyDay(g);
  if(mem.promises.some(p=>p.key===key&&p.actor===actor&&p.status==='open'))return null;
  const p={id:'pledge-'+(++mem.serial),actor,key,text,made:now,due:now+days,expires:now+days+9,status:'open'};
  mem.promises.push(p);
  remember(g,actor,'promise:'+key,'Ти дав обіцянку: '+text,{loyalty:2});
  return p;
}
export function resolvePromise(g,key,outcome,actor=null) {
  const mem=initMemory(g),p=mem.promises.find(x=>x.key===key&&x.status==='open'&&(!actor||x.actor===actor));
  if(!p)return null;
  p.status=outcome==='kept'?'kept':'broken';p.resolved=storyDay(g);
  remember(g,p.actor,(outcome==='kept'?'kept:':'broke:')+key,
    outcome==='kept'?'Ти дотримав слова: '+p.text:'Ти порушив обіцянку: '+p.text,
    outcome==='kept'?{trust:9,loyalty:8,resentment:-3}:{trust:-13,loyalty:-5,resentment:12});
  return p;
}
export function queueArc(g,kind,days,payload={},onceKey=null) {
  initMemory(g);
  const s=g.story,now=storyDay(g),key=onceKey||kind;
  if(s.pending.some(x=>x.key===key) || s.memory.arcs.some(x=>x.key===key && x.status==='queued'))return false;
  const serial=++s.memory.serial;
  s.pending.push({kind,due:now+days,payload,key,serial});
  s.memory.arcs.unshift({key,kind,sourceDay:now,due:now+days,status:'queued'});
  s.memory.arcs=s.memory.arcs.slice(0,100);
  return true;
}
export function markArc(g,item) {
  if(!item)return;
  const arc=initMemory(g).arcs.find(a=>a.key===item.key&&a.status==='queued');
  if(arc){arc.status='shown';arc.shown=storyDay(g);}
}
export function updateMemoryClock(g) {
  const m=initMemory(g),now=storyDay(g);
  if(m.lastProcessedDay===now)return;
  m.lastProcessedDay=now;
  // Unkept commitments become real consequences, even when the player spent
  // the intervening days dealing with football, other people or media scandals.
  for(const p of m.promises){
    if(p.status!=='open'||now<=p.expires)continue;
    p.status='broken';p.resolved=now;
    remember(g,p.actor,'forgot:'+p.key,'Обіцянку не виконано вчасно: '+p.text,{trust:-12,resentment:14,loyalty:-5});
    const current=currentPartnerId(g);
    if(p.actor===current)queueArc(g,'memoryRelationship',0,{actor:p.actor,reason:'promise'},'broken-'+p.id);
    else if(p.actor==='coach')queueArc(g,'memorySelection',1,{reason:'promise'},'broken-'+p.id);
    else if(p.actor==='agent')queueArc(g,'memoryAgent',1,{reason:'promise'},'broken-'+p.id);
  }
  m.promises=m.promises.slice(-35);
  // Resentment decays only slowly; an old betrayal can still matter next season.
  if(now%14===0)for(const a of Object.values(m.actors))a.resentment=clamp((a.resentment||0)-1);
}
export function careerAccess(g){
  const m=initMemory(g),coach=m.actors.coach,agent=m.actors.agent;
  const blocked=coach.resentment>=45||coach.trust<25;
  const agentFrozen=agent.resentment>=46||agent.trust<22;
  return {
    guaranteedMinutes:!blocked && (coach.trust>=65 || coach.loyalty>=22),
    benchRisk:blocked,
    agentFrozen,
    transferQuality:Math.max(-.15,Math.min(.15,(agent.trust-50)/220 - agent.resentment/350)),
    selection:blocked?'Під загрозою':coach.trust>=65?'Довіра тренера':'Конкуренція',
    agentStatus:agentFrozen?'Контакти заморожені':agent.trust>=65?'Сильний агент':'Переговори тривають'
  };
}
export function memorySummary(g){
  const m=initMemory(g),actors=Object.entries(m.actors).map(([id,a])=>({
    id,label:actorLabel(g,id),trust:Math.round(a.trust),affinity:Math.round(a.affinity),
    resentment:Math.round(a.resentment),loyalty:Math.round(a.loyalty),
    last:a.memories?.[0]?.description||'Поки немає спільних подій'
  }));
  return {
    actors, promises:m.promises.filter(p=>p.status==='open').map(p=>({...p,label:actorLabel(g,p.actor)})),
    scars:m.history.slice(0,12),
    consequences:m.arcs.filter(a=>a.status==='queued').length,
    access:careerAccess(g)
  };
}
