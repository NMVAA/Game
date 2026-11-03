/**
 * Named, branching plotlines for Football Life.
 *
 * Not random standalone cards: every plot has a durable instance, its own
 * stage/choice history, a climax, a resolution and a later aftereffect.
 *
 * Everything advances in GAME days, not wall-clock time. Existing saves
 * preserve their key and schema; plot state is only created when first used.
 */
import {CONTACT_BY_ID} from './data.js';
import {PLOT_LIBRARY,PLOT_PHASES} from './plot-stories.js';
import {queueArc,remember,currentPartnerId,storyDay,initMemory} from './memory.js';
import {initNpcWorld} from './npc.js';

const clamp=(x,low=0,high=100)=>Math.max(low,Math.min(high,x));
const byId=Object.fromEntries(PLOT_LIBRARY.map(plot=>[plot.id,plot]));
const planDays=[2,4,5,6,14,24];
const feedback=(g,text)=>{
  g.feed.unshift({text,type:'story',season:g.season,week:g.week,day:g.day});
  g.feed=g.feed.slice(0,34);
};
export function initPlots(g){
 if(!g.story)throw Error('Історію футболіста не створено');
 if(!g.story.plots){
  g.story.plots={
   schema:1,threads:{},order:[],history:[],nextSerial:0,
   lastLaunchDay:-30,completed:[],activeScene:null
  };
 }
 const state=g.story.plots;
 state.threads ||= {}; state.order ||= []; state.history ||= [];
 state.completed ||= [];
 return state;
}
function findPartnerName(t){
 return t.partnerId?CONTACT_BY_ID[t.partnerId]?.name||'Партнер':'партнер';
}
function renderText(raw,thread,g){
 const partnerName=findPartnerName(thread);
 const final=thread.ending||'попередні рішення залишили слід';
 return String(raw).replaceAll('{partner}',partnerName)
  .replaceAll('{ending}',final).replaceAll('{club}',g.clubId||'клуб');
}
const eligible=(g,p)=>{
 if(p.requiresPartner && !g.personal?.personId)return false;
 // Stories are unique within a career until all episodes complete; this is
 // intentional, so their outcomes continue to matter next season.
 return !initPlots(g).order.some(id=>initPlots(g).threads[id]?.key===p.id);
};
const pendingCount=g=>g.story.pending.filter(p=>p.kind==='plotScene').length;
const activeCount=g=>Object.values(initPlots(g).threads).filter(t=>t.status==='active').length;
function launch(g,def){
 const state=initPlots(g),day=storyDay(g);
 const threadId='thread-'+(++state.nextSerial)+'-'+def.id;
 const thread={id:threadId,key:def.id,name:def.name,category:def.category,
  started:day,stage:0,status:'active',partnerId:g.personal?.personId||null,
  support:30,heat:0,evidence:0,path:[],history:[],
  ending:null,lastOutcome:null,lastDecision:null,nextDue:day};
 state.threads[threadId]=thread;state.order.push(threadId);
 state.lastLaunchDay=day;
 queueArc(g,'plotScene',0,{threadId,stage:0},'plot-'+threadId+'-0');
 return thread;
}
export function advancePlots(g){
 const plots=initPlots(g),day=storyDay(g);
 // One launch every 14 days, max two simultaneous unresolved major stories.
 if(day-plots.lastLaunchDay<14 || activeCount(g)>=2 || pendingCount(g)>=3)return plots;
 const next=PLOT_LIBRARY.find(p=>eligible(g,p));
 if(next)launch(g,next);
 return plots;
}
export function plotScene(g,item){
 const {threadId,stage}=item.payload||{};
 const thread=initPlots(g).threads[threadId],def=thread&&byId[thread.key];
 if(!thread||!def||thread.status==='completed'||thread.stage!==stage)return null;
 const beat=def.beats[stage];
 if(!beat)return null;
 const choiceBefore=thread.path[stage-1];
 const text=Array.isArray(beat.text)?beat.text[choiceBefore===1?1:0]:beat.text;
 const base={
  id:'plot-'+thread.key+'-'+stage,
  tag:'СЮЖЕТ · '+def.name,
  title:beat.title,
  text:renderText(text,thread,g),
  a:{label:beat.left.label,sub:beat.left.sub,id:'plot:'+threadId+':'+stage+':0'},
  b:{label:beat.right.label,sub:beat.right.sub,id:'plot:'+threadId+':'+stage+':1'},
  art:beat.art||def.art,
  major:stage===4||stage===6,
  plot:{
    name:def.name,category:def.category,key:def.id,
    phase:PLOT_PHASES[stage],chapter:stage+1,total:7,
    ongoing:stage<5,aftermath:stage>=5,ending:thread.ending
  }
 };
 return base;
}
function applyEffects(g,t,fx,stage,side){
 if(!fx)return;
 if(fx.g)for(const [key,delta] of Object.entries(fx.g)){
   if(key==='money')g.money=Math.max(0,Math.round((g.money||0)+delta));
   else if(typeof g[key]==='number')g[key]=clamp(g[key]+delta);
 }
 if(fx.s)for(const [key,delta] of Object.entries(fx.s)){
   const old=g.story[key]||0;g.story[key]=clamp(old+delta);
 }
 if(fx.t)for(const [key,delta] of Object.entries(fx.t)){
   if(typeof t[key]==='number')t[key]=clamp(t[key]+delta,0,200);
 }
 // Consequences for a specific relationship: never silently transfer trust
 // to a different partner after a breakup.
 if(fx.p && t.partnerId===g.personal?.personId){
   for(const [key,delta] of Object.entries(fx.p)){
     if(typeof g.personal[key]==='number')g.personal[key]=clamp(g.personal[key]+delta);
   }
   g.personal.quietDays=0;
 }
 if(fx.m)for(const record of fx.m){
   const id=record.actor==='partner'?(t.partnerId?'partner:'+t.partnerId:null):record.actor;
   if(!id)continue;
   const deltas={...record};delete deltas.actor;
   remember(g,id,'plot-'+t.key+'-'+stage+'-'+side,
     t.name+': '+(side===0?'перший':'другий')+' вибір на етапі '+PLOT_PHASES[stage]+'.',
     deltas);
 }
 if(fx.n){
   const world=initNpcWorld(g),rival=world.people.rival;
   if(rival)for(const [key,value] of Object.entries(fx.n)){
     if(key==='rival')rival.goalProgress=clamp((rival.goalProgress||0)+value,0,100);
   }
 }
 if(fx.q?.kind){
   const payload={...fx.q.payload};
   if(t.partnerId){
    if(fx.q.kind.startsWith('npcPartner'))payload.partnerId=t.partnerId;
    if(fx.q.kind.startsWith('adult'))payload.personId=t.partnerId;
    if(fx.q.kind==='memoryRelationship')payload.actor='partner:'+t.partnerId;
   }
   queueArc(g,fx.q.kind,fx.q.days||8,payload,
     'plot-side-'+t.id+'-'+stage+'-'+side+'-'+fx.q.kind);
 }
}
function afterPlotClimax(g,t,successful){
 // A real aftermath remains even if the immediate crisis is over.
 const backfire={
  shadow:'memoryAgent',derby:'photo',city:'memoryRelationship',
  armband:'memorySelection',limit:'rehab',truth:'adultMediaLeak',
  budget:'adultBudget',witness:'memoryTeam'
 };
 if(!successful){
  const kind=backfire[t.key],payload={};
  if(t.partnerId){
    if(kind==='memoryRelationship')payload.actor='partner:'+t.partnerId;
    if(kind.startsWith('adult'))payload.personId=t.partnerId;
  }
  if(kind)queueArc(g,kind,16,payload,'plot-climax-backfire-'+t.id);
 }else if(['shadow','armband','limit','witness'].includes(t.key)){
  queueArc(g,'memoryOpportunity',17,{},'plot-earned-opportunity-'+t.id);
 }
}
export function resolvePlotChoice(g,id){
 const chunks=id.split(':'),threadId=chunks[1],step=Number(chunks[2]),side=Number(chunks[3]);
 const state=initPlots(g),t=state.threads[threadId],def=t&&byId[t.key];
 if(!t||!def||step!==t.stage||![0,1].includes(side))
   return {ok:false,message:'Цей розділ уже завершився.'};
 const beat=def.beats[step],chosen=side===0?beat.left:beat.right;
 if(!chosen)return {ok:false,message:'Варіант недоступний.'};
 applyEffects(g,t,chosen.effects,step,side);
 t.path.push(side);
 const outcome=renderText(chosen.message,t,g);
 t.history.unshift({day:storyDay(g),stage:step+1,phase:PLOT_PHASES[step],
   decision:chosen.label,outcome});
 t.history=t.history.slice(0,24);
 t.lastDecision=chosen.label;t.lastOutcome=outcome;
 state.history.unshift({threadId:t.id,name:t.name,day:storyDay(g),
   stage:step+1,phase:PLOT_PHASES[step],decision:chosen.label,outcome});
 state.history=state.history.slice(0,90);
 feedback(g,t.name+' · '+PLOT_PHASES[step]+': '+outcome);
 if(step===4){
  const success=(t.support+t.evidence*.46-t.heat)>=33;
  t.ending=def.ending[success?0:1];
  afterPlotClimax(g,t,success);
 }
 t.stage++;
 if(t.stage<7){
  t.status=t.stage>=5?'aftermath':'active';
  const delay=planDays[step]||9;
  t.nextDue=storyDay(g)+delay;
  queueArc(g,'plotScene',delay,{threadId:t.id,stage:t.stage},'plot-'+t.id+'-'+t.stage);
 }else{
  t.status='completed';t.finished=storyDay(g);t.nextDue=null;
  state.completed.unshift(t.id);
  // Two unrelated stories can share the same theme, but the individual past
  // decisions and verdicts remain attached to their named plot.
 }
 return {ok:true,message:outcome,plot:{
  name:t.name,chapter:step+1,total:7,ending:t.ending
 }};
}
export function plotSnapshot(g){
 const state=initPlots(g),day=storyDay(g);
 return {
  total:PLOT_LIBRARY.length,
  started:state.order.length,
  completed:state.completed.length,
  threads:state.order.map(id=>state.threads[id]).filter(Boolean).map(t=>({
   id:t.id,key:t.key,name:t.name,category:t.category,status:t.status,
   started:t.started,chapter:Math.min(t.stage+1,7),total:7,
   phase:PLOT_PHASES[Math.min(t.stage,6)],
   ending:t.ending,nextDays:t.nextDue==null?null:Math.max(0,t.nextDue-day),
   last:t.lastOutcome,
   past:t.history.slice(0,7)
  })).reverse(),
  recent:state.history.slice(0,16),
  nextUnlocked:PLOT_LIBRARY.filter(x=>eligible(g,x)).map(x=>x.name)
 };
}
export const plotTitles=PLOT_LIBRARY.map(({id,name,category})=>({id,name,category}));
