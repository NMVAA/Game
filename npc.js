/**
 * Autonomous adult characters in Football Life.
 *
 * Deterministic in-game-time simulation: NPC goals advance on calendar days,
 * even when the user chooses unrelated activities. No wall-clock timers or APIs.
 * NPCs make decisions BEFORE the player is offered a reaction.
 */
import {CLUBS,CLUB_BY_ID,CONTACTS} from './data.js';
import {initMemory,remember,queueArc,careerAccess,currentPartnerId,storyDay} from './memory.js';

const clamp=(n,min=0,max=100)=>Math.min(max,Math.max(min,n));
const random=g=>{g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;};
const select=(g,arr)=>arr[Math.floor(random(g)*arr.length)];
const names=[
 {id:'rival',name:'Максим Коваль',age:24,role:'rival',trait:'амбітний',goal:'starting-eleven'},
 {id:'teammate',name:'Роман Бойко',age:28,role:'teammate',trait:'командний',goal:'captaincy'}
];
const actors=[
 {id:'coach',name:'Олег Савчук',age:46,role:'coach',trait:'вимогливий',goal:'league-success'},
 {id:'agent',name:'Тарас Величко',age:39,role:'agent',trait:'розважливий',goal:'higher-fees'},
 {id:'captain',name:'Андрій Мороз',age:31,role:'captain',trait:'принциповий',goal:'dressing-room'},
 ...names,
 ...CONTACTS.filter(p=>p.age>=21).map(p=>({
    id:'social:'+p.id,name:p.name,age:p.age,role:'social',trait:p.vibe,
    goal:p.id==='sofia'?'architecture':p.id==='marta'?'music':p.id==='anna'?'business':'creative-work'
 }))
];
function news(world,day,actor,text){
 world.news.unshift({day,actor,text});
 world.news=world.news.slice(0,45);
}
function signal(g,kind,delay,payload,key){
 return queueArc(g,kind,delay,payload,key);
}
function interest(g,actor,delta){
 actor.motivation=clamp(actor.motivation+delta);
}
export function initNpcWorld(g){
 if(!g.story)throw Error('Потрібно створити кар’єру');
 if(g.story.npcs?.version===1)return g.story.npcs;
 const today=storyDay(g);
 const world={
  version:1,lastDay:today,news:[],lastAction:null,serial:0,
  people:Object.fromEntries(actors.map((a,i)=>[a.id,{
   ...a,clubId:a.role==='social'?null:g.clubId,
   motivation:45+(i%5)*6,stress:12+(i%4)*8,
   wealth: a.role==='social'?4000:10000,
   bond:50,goalProgress:0,
   nextMove:today+2+(i*3)%7,
   lastDecision:null,history:[],
   relationshipStatus:'single'
  }])),
  transferRumors:[],moves:0,unresolved:0
 };
 // Start existing couples in their correct relationship state.
 if(g.personal?.personId){
  const partner=world.people['social:'+g.personal.personId];
  if(partner)partner.relationshipStatus=g.personal.stage;
 }
 g.story.npcs=world;
 return world;
}
function decide(world,actor,g,day,action,description){
 actor.lastDecision=action;
 actor.history.unshift({day,action,description});
 actor.history=actor.history.slice(0,14);
 news(world,day,actor.id,description);
 world.lastAction={day,actor:actor.id,action};
}
function coachTurn(g,w,a,day){
 const memory=initMemory(g).actors.coach,access=careerAccess(g);
 a.goalProgress+=a.motivation/17;
 const rival=w.people.rival;
 if((access.benchRisk||memory.resentment>30||g.form<45) && rival.clubId===g.clubId){
  interest(g,a,3);interest(g,rival,5);
  rival.goalProgress+=17;
  decide(w,a,g,day,'bench-competition',a.name+' ставить під сумнів твоє місце в основі.');
  signal(g,'npcCoachContest',1,{coach:a.id,rival:rival.id},'npc-coach-challenge-'+day);
 }else if(g.form>=65&&memory.trust>=58){
  decide(w,a,g,day,'captain-discussion',a.name+' обговорює твоє підвищення з капітаном.');
  signal(g,'npcCoachPromotion',2,{coach:a.id},'npc-coach-promotion-'+day);
 }else{
  if(rival.clubId===g.clubId)rival.goalProgress+=8;
  interest(g,a,2);
  decide(w,a,g,day,'extra-practice',a.name+' запровадив додаткові тренування для команди.');
  signal(g,'npcCoachDrill',2,{coach:a.id},'npc-coach-drill-'+day);
 }
 a.nextMove=day+5+Math.floor(random(g)*4);
}
function agentTurn(g,w,a,day){
 const trust=initMemory(g).actors.agent,access=careerAccess(g);
 a.goalProgress+=a.motivation/13;
 if(access.agentFrozen||trust.resentment>=40){
  decide(w,a,g,day,'withheld-contact',a.name+' не повідомив про новий контакт клубу.');
  signal(g,'npcAgentSecret',2,{agent:a.id},'npc-agent-withheld-'+day);
 }else{
  const clubs=CLUBS.filter(c=>c.id!==g.clubId&&!g.offers.some(o=>o.clubId===c.id));
  if(clubs.length && g.offers.length<3){
   const weighted=clubs.sort((a,b)=>Math.abs(a.power-(g.reputation*.32+57))-Math.abs(b.power-(g.reputation*.32+57)));
   const c=select(g,weighted.slice(0,Math.min(3,weighted.length)));
   const wage=Math.round((1300+c.power*38+g.reputation*26)*(0.87+trust.trust/400)/100)*100;
   const offer={id:'npc-offer-'+g.season+'-'+day+'-'+c.id,clubId:c.id,
    wage,bonus:Math.round((c.power*85+g.reputation*30)/100)*100,until:g.year+2,
    expiresWeek:Math.min(14,g.week+2),negotiated:false};
   g.offers.push(offer);
   w.transferRumors.unshift({day,clubId:c.id,offerId:offer.id,actor:a.id});
   w.transferRumors=w.transferRumors.slice(0,25);
   decide(w,a,g,day,'private-offer',a.name+' самостійно відкрив переговори з '+c.name+'.');
   signal(g,'npcAgentContact',1,{clubId:c.id,agent:a.id},'npc-agent-contact-'+day);
  }else{
   decide(w,a,g,day,'networking',a.name+' розширив контакти в інших клубах.');
  }
 }
 a.nextMove=day+7+Math.floor(random(g)*5);
}
function teammateTurn(g,w,a,day){
 const rival=w.people.rival;
 a.goalProgress+=a.motivation/16;
 const captainMemory=initMemory(g).actors.captain;
 if(captainMemory.resentment>30||rival.goalProgress>=60){
  interest(g,rival,7);
  decide(w,a,g,day,'backed-rival',a.name+' підтримав конкурента за місце в складі.');
  signal(g,'npcCaptainAlliance',2,{captain:a.id,rival:rival.id},'npc-captain-side-'+day);
 }else{
  decide(w,a,g,day,'team-meeting',a.name+' організував зустріч команди без тренера.');
  signal(g,'npcTeamBond',2,{captain:a.id},'npc-captain-meeting-'+day);
 }
 a.nextMove=day+6+Math.floor(random(g)*5);
}
function rivalTurn(g,w,a,day){
 a.goalProgress+=a.motivation/11;
 if(a.goal==='transfer'&&a.clubId===g.clubId){
   const destination=select(g,CLUBS.filter(c=>c.id!==g.clubId));
   a.clubId=destination.id;a.goal='new-club';a.goalProgress=12;
   w.moves++;
   decide(w,a,g,day,'transferred',a.name+' самостійно підписав контракт із '+destination.name+'.');
   a.nextMove=day+12+Math.floor(random(g)*5);
   return;
 }
 if(a.clubId!==g.clubId){
   a.goalProgress=Math.min(100,a.goalProgress);
   decide(w,a,g,day,'other-team',a.name+' виступає за інший клуб і розвиває свою кар’єру.');
   a.nextMove=day+13;return;
 }
 const coach=initMemory(g).actors.coach;
 if(a.goalProgress>=83 && coach.trust<74){
  a.goalProgress=0;
  decide(w,a,g,day,'asked-for-start',a.name+' попросив тренера дати йому більше ігрового часу.');
  signal(g,'npcRivalCompetition',1,{rival:a.id},'npc-rival-challenge-'+day);
 }else if(a.goalProgress>=95){
  a.goalProgress=24;
  a.goal='transfer';
  decide(w,a,g,day,'found-agent',a.name+' почав переговори з іншим клубом.');
  signal(g,'npcRivalTransfer',2,{rival:a.id},'npc-rival-transfer-'+day);
 }else {
  interest(g,a,4);
  decide(w,a,g,day,'trained-alone',a.name+' тренується окремо, щоб обійти тебе в конкуренції.');
 }
 a.nextMove=day+6+Math.floor(random(g)*4);
}
function socialTurn(g,w,a,day){
 const person=a.id.slice(7),isPartner=person===g.personal?.personId;
 a.goalProgress+=a.motivation/14;
 // Their own jobs, money and ambitions continue even while not dating player.
 const ambitions={
  sofia:'отримала архітектурний проєкт',marta:'домовилася про новий музичний контракт',
  anna:'отримала пропозицію розвивати ресторан',daniel:'планує професійну фотозйомку за кордоном'
 };
 if(isPartner){
  a.relationshipStatus=g.personal.stage;
  const memory=initMemory(g).actors['partner:'+person];
  if((memory?.resentment||0)>35 || g.personal.trust<38){
   decide(w,a,g,day,'relationship-distance',a.name+' самостійно вирішив(ла) взяти дистанцію.');
   signal(g,'npcPartnerDistance',1,{actor:a.id,partnerId:person},'npc-partner-distance-'+day);
  }else if(a.goalProgress>=65){
   a.goalProgress=0;
   const other=select(g,CLUBS.filter(c=>c.id!==g.clubId));
   a.targetCity=other.city;
   decide(w,a,g,day,'career-offer',a.name+' '+ambitions[person]+' у місті '+other.city+'.');
   signal(g,'npcPartnerCareer',1,{actor:a.id,partnerId:person,city:other.city},'npc-partner-career-'+day);
  }else{
   a.stress=clamp(a.stress+4);
   decide(w,a,g,day,'independent-evening',a.name+' провів(ла) вечір із друзями, не чекаючи твого рішення.');
   signal(g,'npcPartnerPlans',2,{actor:a.id,partnerId:person},'npc-partner-plans-'+day);
  }
 }else{
  a.wealth+=120+Math.floor(random(g)*180);
  a.stress=clamp(a.stress+(random(g)<.4?-4:3));
  if(a.goalProgress>=100){a.goalProgress=0;a.targetCity=select(g,CLUBS).city;w.moves++;
   decide(w,a,g,day,'own-career',a.name+' самостійно змінив(ла) кар’єрні плани.');
  }else decide(w,a,g,day,'working',a.name+' продовжує свою професійну кар’єру.');
 }
 a.nextMove=day+(isPartner?7:12)+Math.floor(random(g)*5);
}
function runActor(g,w,a,day){
 if(a.role==='coach')coachTurn(g,w,a,day);
 else if(a.role==='agent')agentTurn(g,w,a,day);
 else if(a.role==='captain')teammateTurn(g,w,a,day);
 else if(a.role==='rival')rivalTurn(g,w,a,day);
 else if(a.role==='social')socialTurn(g,w,a,day);
 else if(a.role==='teammate'){
  a.goalProgress+=a.motivation/12;
  interest(g,a,5);
  decide(w,a,g,day,'teammate-work',a.name+' готується боротися за лідерство в роздягальні.');
  a.nextMove=day+8+Math.floor(random(g)*4);
 }
}
/**
 * Simulates elapsed calendar days exactly once, capped to prevent a
 * corrupted/future save from locking up a phone. At most 2 public incidents
 * per 7 days; non-visible NPC work still advances internal state.
 */
export function advanceNpcWorld(g){
 const w=initNpcWorld(g),today=storyDay(g);
 if(today<=w.lastDay)return w;
 const elapsed=Math.min(today-w.lastDay,112),from=today-elapsed;
 for(let day=from+1;day<=today;day++){
  const pendingToday=g.story.pending.filter(x=>x.kind?.startsWith('npc')&&x.due>=day&&x.due<=day+7).length;
  const due=Object.values(w.people).filter(a=>a.nextMove<=day).sort((a,b)=>a.nextMove-b.nextMove);
  let scheduled=0;
  for(const a of due){
   // Social characters not connected to player still progress off-screen.
   if(pendingToday+scheduled>=3 && a.role!=='social') {
    a.goalProgress+=a.motivation/35;a.nextMove=day+2;continue;
   }
   const before=g.story.pending.length;
   runActor(g,w,a,day);
   if(g.story.pending.length>before)scheduled++;
  }
 }
 w.lastDay=today;
 return w;
}
export function npcSnapshot(g){
 const w=initNpcWorld(g);
 return {
  people:Object.values(w.people).map(p=>({id:p.id,name:p.name,age:p.age,role:p.role,trait:p.trait,goal:p.goal,
   motivation:Math.round(p.motivation),last:p.history?.[0]?.description||null,city:p.targetCity||CLUB_BY_ID[p.clubId]?.city||''})),
  news:w.news.slice(0,15),rumors:w.transferRumors.slice(0,5),
  partner:g.personal?.personId||null,
  changes:w.moves
 };
}
