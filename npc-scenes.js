/**
 * Player-facing consequences of decisions initiated by autonomous characters.
 * Each scene has exactly two choices. Runtime narratives are capped by story.js.
 * No save migrations, timers, external services or additional dependencies.
 */
import {CLUB_BY_ID} from './data.js';
import {remember,queueArc,careerAccess,currentPartnerId} from './memory.js';
import {initNpcWorld} from './npc.js';

const cap=(n,min=0,max=100)=>Math.max(min,Math.min(max,n));
const event=(id,tag,title,text,a,b,major=false)=>({id,tag,title,text,a,b,major});
const choice=(label,sub,id)=>({label,sub,id});
const say=(g,message,type='story')=>{
  g.feed.unshift({text:message,type,season:g.season,week:g.week,day:g.day});
  g.feed=g.feed.slice(0,34);
};
const stat=(g,change)=>{for(const [k,v] of Object.entries(change))g[k]=cap((g[k]||0)+v)};
const relating=(g,change)=>{
 for(const [k,v] of Object.entries(change))g.personal[k]=cap((g.personal[k]||0)+v);
 g.personal.quietDays=0;
};
export function npcScene(g,item){
 const kind=item.kind;
 const club=CLUB_BY_ID[item.payload?.clubId];
 const city=item.payload?.city||'іншому місті';
 switch(kind){
 case 'npcCoachContest':
  return event(kind,'ТРЕНЕР · ВЛАСНЕ РІШЕННЯ','Тренер довіряє конкуренту',
   'Тренер самостійно випробував Максима Коваля. Твоє місце у стартовому складі під загрозою.',
   choice('Вимагати шанс','Можливий конфлікт або основа','npc:coach:demand'),
   choice('Довести на тренуванні','+форма, менше сил','npc:coach:work'));
 case 'npcCoachPromotion':
  return event(kind,'ТРЕНЕР · ІНІЦІАТИВА','Тренер пропонує роль лідера',
   'Після розмови з капітаном тренер вирішив дати тобі більше відповідальності.',
   choice('Взяти лідерство','+вплив, більше тиску','npc:coach:lead'),
   choice('Залишитися гравцем','Спокійніше, менше впливу','npc:coach:steady'));
 case 'npcCoachDrill':
  return event(kind,'ТРЕНЕР · НОВІ УМОВИ','Тренер змінив навантаження',
   'Без твоєї участі тренер запровадив додаткові заняття для гравців.',
   choice('Працювати більше','+форма, -енергія','npc:coach:drill'),
   choice('Попросити відновлення','+енергія, ризик невдоволення','npc:coach:recovery'));
 case 'npcAgentSecret':
  return event(kind,'АГЕНТ · ПРИХОВАНІ ПЛАНИ','Агент приховав переговори',
   'Через минулий конфлікт агент замовчав контакти з іншим клубом.',
   choice('Вимагати прозорості','Можливий розрив співпраці','npc:agent:confront'),
   choice('Дати ще шанс','+довіра, ризик повторення','npc:agent:trust'),true);
 case 'npcAgentContact':
  return event(kind,'АГЕНТ · НОВИЙ КОНТРАКТ','Агент діяв без дозволу',
   'Агент сам почав переговори з '+(club?.name||'іншим клубом')+'. Пропозиція вже готова.',
   choice('Розглянути контракт','Винагорода і можливий переїзд','npc:agent:review'),
   choice('Залишитися тут','Лояльність клубу, відмова агенту','npc:agent:stay:'+(club?.id||'')));
 case 'npcCaptainAlliance':
  return event(kind,'РОЗДЯГАЛЬНЯ · СОЮЗИ','Капітан підтримав суперника',
   'Капітан сам став на бік Максима Коваля та вплинув на думку тренера.',
   choice('Домовитися','Повернути прихильність капітана','npc:captain:talk'),
   choice('Вступити в конкуренцію','+амбіції, напруга в команді','npc:captain:compete'));
 case 'npcTeamBond':
  return event(kind,'РОЗДЯГАЛЬНЯ · ПЛАНИ','Капітан організував зустріч',
   'Команда збирається без тренера. Капітан чекає на твоє рішення.',
   choice('Приєднатися','+командний зв’язок, -час','npc:captain:join'),
   choice('Пропустити','+відпочинок, менша довіра','npc:captain:skip'));
 case 'npcRivalCompetition':
  return event(kind,'КОНКУРЕНЦІЯ · СКЛАД','Максим вимагає твого місця',
   'Максим Коваль тренувався додатково й попросив тренера випустити його в основі.',
   choice('Боротися за основу','+форма, ризик перевтоми','npc:rival:train'),
   choice('Зберігати спокій','Більше сил, ризик лави запасних','npc:rival:ignore'));
 case 'npcRivalTransfer':
  return event(kind,'ТРАНСФЕРИ · КОНКУРЕНТИ','Максим шукає інший клуб',
   'Максим Коваль самостійно розпочав трансферні переговори. Його відхід звільнить місце.',
   choice('Підтримати перехід','Менша конкуренція, старі образи','npc:rival:support'),
   choice('Переконати залишитися','Командний зв’язок, конкуренція','npc:rival:retain'));
 case 'npcPartnerDistance':
  return event(kind,'СТОСУНКИ · РІШЕННЯ ПАРТНЕРА','Партнер хоче побути окремо',
   'Накопичені образи змусили партнера самостійно взяти дистанцію.',
   choice('Поважати рішення','Час для відновлення довіри','npc:partner:space'),
   choice('Наполягати на розмові','Шанс примирення, ризик розриву','npc:partner:press'),true);
 case 'npcPartnerCareer':
  return event(kind,'СТОСУНКИ · ВЛАСНА КАР’ЄРА','Партнер отримав роботу',
   'Партнер сам знайшов кар’єрну можливість у місті '+city+'. Твої футбольні плани не враховано.',
   choice('Шукати компроміс','Витрати та більша довіра','npc:partner:compromise'),
   choice('Залишитися у клубі','+кар’єра, ризик віддалення','npc:partner:career'),true);
 case 'npcPartnerPlans':
  return event(kind,'СТОСУНКИ · ВЛАСНЕ ЖИТТЯ','Партнер має свої плани',
   'Партнер домовився про зустріч із друзями. У вас різні очікування від спільного вечора.',
   choice('Підтримати свободу','Повага й взаємна довіра','npc:partner:support'),
   choice('Обговорити час разом','Шанс домовитися або посваритися','npc:partner:discuss'));
 default:return null;
 }
}
export function resolveNpcChoice(g,id){
 const parts=id.split(':'),[,actor,action,subject]=parts;
 const w=initNpcWorld(g);
 const p=currentPartnerId(g);
 const coach=w.people.coach,agent=w.people.agent,captain=w.people.captain,rival=w.people.rival,partner=w.people['social:'+g.personal?.personId];
 const outcome=message=>{say(g,message,actor==='partner'?'personal':'football');return {ok:true,message};};
 if(actor==='coach'){
   if(action==='demand'){
     const backed=careerAccess(g).guaranteedMinutes;
     remember(g,'coach','demanded_start','Ти наполягав на своєму місці у складі.',backed?{trust:5,loyalty:4}:{trust:-11,resentment:11});
     stat(g,{stress:8,morale:backed?5:-4});
     if(!backed)queueArc(g,'memorySelection',7,{},'npc-demand-'+g.season+'-'+g.week+'-'+g.day);
     return outcome(backed?'Тренер дав шанс завдяки попередній довірі.':'Тренер запам’ятав ультиматум і пообіцяв переглянути склад.');
   }
   if(action==='work'){
     stat(g,{form:6,energy:-17,stress:3});
     remember(g,'coach','accepted_rivalry','Ти відповів конкуренції роботою.',{trust:7,loyalty:7,resentment:-4});
     rival.goalProgress=cap(rival.goalProgress-13);
     return outcome('Твоя форма зросла. Конкурент відчуває тиск.');
   }
   if(action==='lead'){
     remember(g,'coach','leadership','Ти взяв відповідальність за команду.',{trust:11,loyalty:11});
     remember(g,'captain','shared_responsibility','Ти погодився допомогти лідеру команди.',{trust:5,loyalty:6});
     stat(g,{stress:9,morale:6});return outcome('Лідерська роль приносить довіру та додатковий тиск.');
   }
   if(action==='steady'){
     remember(g,'coach','declined_captaincy','Ти відмовився від додаткової відповідальності.',{trust:-4});
     stat(g,{stress:-8,energy:7});return outcome('Тренер доручив відповідальність іншому гравцю.');
   }
   if(action==='drill'){
     stat(g,{form:6,energy:-21,stress:5});
     remember(g,'coach','took_extra_drills','Ти виконав нову програму тренувань.',{trust:7});
     return outcome('Сильне навантаження покращило форму, але накопичило втому.');
   }
   if(action==='recovery'){
     stat(g,{energy:15,form:-2,stress:-5});
     remember(g,'coach','requested_recovery','Ти попросив послабити навантаження.',{trust:-5,resentment:5});
     return outcome('Ти відновив сили, але тренер запам’ятав прохання.');
   }
 }
 if(actor==='agent'){
   if(action==='confront'){
     remember(g,'agent','demanded_disclosure','Ти вимагав повідомляти про всі переговори.',{trust:-8,resentment:13});
     stat(g,{stress:7});
     queueArc(g,'memoryAgent',5,{},'npc-agent-row-'+g.season+'-'+g.week+'-'+g.day);
     return outcome('Агент визнав приховані контакти. Співпраця опинилася під загрозою.');
   }
   if(action==='trust'){
     remember(g,'agent','second_chance','Ти дав агенту другий шанс.',{trust:8,loyalty:6,resentment:-6});
     stat(g,{stress:-4});return outcome('Агент повернувся до роботи, але ти не знаєш усіх його контактів.');
   }
   if(action==='review'){
     remember(g,'agent','reviewed_unasked_offer','Ти погодився розглянути переговори, розпочаті без дозволу.',{trust:5});
     stat(g,{morale:3,stress:3});
     return outcome('Пропозиція залишилася відкритою. Наступна розмова визначить контракт.');
   }
   if(action==='stay'){
     const before=g.offers.length;
     g.offers=g.offers.filter(o=>o.clubId!==subject || !o.id.startsWith('npc-offer-'));
     remember(g,'agent','refused_unasked_offer','Ти відмовився від переговорів, які агент розпочав сам.',{trust:-5,resentment:6});
     remember(g,'coach','club_loyalty','Ти залишився в клубі попри нову пропозицію.',{trust:7,loyalty:7});
     return outcome(before>g.offers.length?'Ти відхилив неузгоджену пропозицію. Тренер оцінив лояльність.':'Ти обрав лояльність нинішньому клубу.');
   }
 }
 if(actor==='captain'){
   if(action==='talk'){
     remember(g,'captain','sought_alliance','Ти запропонував капітану обговорити конкуренцію.',{trust:10,loyalty:6,resentment:-7});
     rival.goalProgress=cap(rival.goalProgress+3);
     return outcome('Капітан готовий вислухати тебе, але конкурент не зупиняється.');
   }
   if(action==='compete'){
     remember(g,'captain','challenged_alliance','Ти вступив у боротьбу проти рішення капітана.',{trust:-11,resentment:13});
     remember(g,'coach','tense_dressing_room','Конфлікт у роздягальні посилився.',{trust:-4});
     stat(g,{form:4,energy:-9,stress:8});return outcome('Ти став сильнішим, але союзники конкурента віддалилися.');
   }
   if(action==='join'){
     remember(g,'captain','team_evening','Ти приєднався до зустрічі команди.',{trust:9,loyalty:9});
     stat(g,{energy:-6,morale:5});
     return outcome('Команда стала ближчою. Твої слова капітан запам’ятає.');
   }
   if(action==='skip'){
     remember(g,'captain','missed_team_evening','Ти пропустив зустріч, організовану капітаном.',{trust:-5,resentment:4});
     stat(g,{energy:8,stress:-4});return outcome('Ти відновив сили, але втратив спільний вечір.');
   }
 }
 if(actor==='rival'){
   if(action==='train'){
     stat(g,{form:8,energy:-20,stress:5});
     rival.goalProgress=cap(rival.goalProgress-19);
     remember(g,'coach','outtrained_rival','Ти відповів на конкуренцію додатковими тренуваннями.',{trust:7,loyalty:4});
     return outcome('Твої шанси на старт зросли, але перевтома загрожує формі.');
   }
   if(action==='ignore'){
     stat(g,{energy:10,stress:-3});
     rival.goalProgress=cap(rival.goalProgress+26);
     remember(g,'coach','ignored_competition','Ти проігнорував конкуренцію за місце в складі.',{trust:-8,resentment:8});
     queueArc(g,'memorySelection',6,{},'npc-rival-bench-'+g.season+'-'+g.week+'-'+g.day);
     return outcome('Конкурент посилив позиції перед тренером. Твоє місце під ризиком.');
   }
   if(action==='support'){
     rival.goalProgress=0;rival.goal='transfer';rival.nextMove+=10;
     remember(g,'captain','supported_rival_transfer','Ти підтримав рішення конкурента змінити команду.',{trust:-2});
     stat(g,{morale:5});
     return outcome('Максим продовжує переговори. Конкуренція може зменшитися.');
   }
   if(action==='retain'){
     rival.goalProgress=cap(rival.goalProgress+12);
     remember(g,'captain','defended_teammate','Ти попросив конкурента залишитися в команді.',{trust:8,loyalty:6});
     stat(g,{morale:2});return outcome('Максим вирішив поки залишитися. Команда цінує твою підтримку.');
   }
 }
 if(actor==='partner'){
   if(!p||!partner)return {ok:false,message:'Ця подія вже неактуальна після завершення стосунків.'};
   if(action==='space'){
     remember(g,p,'respected_distance','Ти поважав самостійне рішення партнера.',{trust:7,resentment:-11});
     relating(g,{tension:-10,bond:-3});
     return outcome('Партнер отримав простір. Відновлення довіри потребуватиме часу.');
   }
   if(action==='press'){
     const wasTense=g.personal.tension>64;
     remember(g,p,'pressured_discussion','Ти наполягав на розмові попри прохання про дистанцію.',{trust:-11,resentment:16});
     relating(g,{tension:10,bond:-6});
     if(wasTense&&g.personal.trust<19){
       // Preserve the NPC's own independent decision to end a relationship.
       w.people['social:'+g.personal.personId].relationshipStatus='separated';
       g.personal={personId:null,stage:'single',bond:0,trust:55,tension:5,quietDays:0};
       stat(g,{morale:-12,stress:13});
       return outcome('Партнер завершив стосунки. Історія конфлікту залишилася в пам’яті.');
     }
     return outcome('Розмова посилила напругу. Партнер пам’ятатиме тиск.');
   }
   if(action==='compromise'){
     g.money=Math.max(0,g.money-Math.min(g.money,650));
     remember(g,p,'respected_own_career','Ти врахував окремі кар’єрні амбіції партнера.',{trust:12,loyalty:12,resentment:-6});
     relating(g,{bond:6,stress:0});stat(g,{energy:-7});
     partner.goalProgress=cap(partner.goalProgress+13);
     return outcome('Ви домовилися про спільні плани. Це коштувало грошей і часу.');
   }
   if(action==='career'){
     remember(g,p,'dismissed_job_offer','Ти проігнорував професійну пропозицію партнера.',{trust:-14,resentment:17,loyalty:-8});
     stat(g,{form:5,stress:5});
     queueArc(g,'memoryRelationship',11,{actor:p},'npc-partner-job-'+g.season+'-'+g.week+'-'+g.day);
     return outcome('Ти залишився у клубі. Партнер розглядає життя окремо.');
   }
   if(action==='support'){
     remember(g,p,'respected_independence','Ти підтримав особистий час і друзів партнера.',{trust:8,resentment:-5});
     relating(g,{tension:-5});
     return outcome('Партнер оцінив підтримку й збереже власні плани.');
   }
   if(action==='discuss'){
     const good=g.personal.trust>=53;
     remember(g,p,'negotiated_evening','Ви обговорили межі та спільний час.',good?{trust:8,affinity:6,resentment:-4}:{trust:-4,resentment:7});
     stat(g,{stress:good?-2:5});return outcome(good?'Ви домовилися без конфлікту.':'Низька довіра перетворила розмову на суперечку.');
   }
 }
 return {ok:false,message:'Ця дія поки недоступна.'};
}
