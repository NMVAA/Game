/**
 * Football Life / Personal Life 21+
 * Connected, consent-first adult relationships with consequences for football,
 * contracts, finance, careers, the press and trust. Never explicit.
 * Adds story.adult lazily; existing save format/key is unchanged.
 */
import {CONTACTS} from './data.js';
import {remember,currentPartnerId,queueArc,storyDay} from './memory.js';

const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const contact=id=>CONTACTS.find(p=>p.id===id);
const dice=g=>{g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;};
const choose=(g,arr)=>arr[Math.floor(dice(g)*arr.length)];
const choice=(label,sub,id)=>({label,sub,id});
const event=(id,tag,title,text,a,b,major=false)=>({id,tag,title,text,a,b,major});
const add=(g,changes)=>{
 for(const [key,value] of Object.entries(changes)){
  if(key==='money')g.money=Math.max(0,g.money+value);
  else g[key]=clamp((g[key]??0)+value);
 }
};
const relation=(g,changes)=>{
 for(const [key,value] of Object.entries(changes))g.personal[key]=clamp((g.personal[key]??0)+value);
 g.personal.quietDays=0;
};
const impact=(g,person,key,detail,changes={})=>{
 const id='partner:'+person;
 remember(g,id,key,detail,changes);
};
const trace=(g,id,text)=>{
 const s=initAdultLife(g);
 s.history.unshift({id,text,day:storyDay(g)});
 s.history=s.history.slice(0,45);
 g.feed.unshift({text,type:'personal',season:g.season,week:g.week,day:g.day});
 g.feed=g.feed.slice(0,34);
};
const delayed=(g,type,days,person,extra={})=>
 queueArc(g,'adult'+type,days,{personId:person,...extra},
  'adult-'+type+'-'+person+'-'+storyDay(g)+'-'+initAdultLife(g).history.length);
export function initAdultLife(g){
 if(!g.story)throw Error('Спершу розпочни кар’єру');
 if(g.story.adult?.people)return g.story.adult;
 const state={people:{},history:[],lastDay:-1,choiceCount:0,privacyRisk:0,
  lastScene:'',lastChoiceDay:-1,visibleAfter:'',rumours:0};
 for(const p of CONTACTS.filter(p=>p.age>=21)){
  state.people[p.id]={
   age:p.age,independence:p.id==='marta'?86:p.id==='sofia'?75:p.id==='anna'?69:73,
   needForTrust:p.id==='sofia'?83:p.id==='anna'?78:p.id==='daniel'?70:64,
   intimacyComfort:48,sharedBoundaries:45,emotionalSafety:50,
   discretion:p.id==='marta'?38:68,publicity:30,workPressure:30,
   workSupported:0,commitment:0,hiddenHistory:0,circle:48,
   lastTalk:-1,lastScene:'',lastEncounter:0
  };
 }
 g.story.adult=state;return state;
}
const current=g=>{
 const id=g.personal?.personId;
 if(!id)return null;
 const s=initAdultLife(g),p=contact(id);
 if(!p || p.age<21)return null;
 return {id,person:p,values:s.people[id]};
};
const sensitivity=g=>{
 const a=current(g);
 if(!a)return 0;
 return a.values.needForTrust*.35 + (100-(g.personal?.trust||50))*.35 + a.values.hiddenHistory*.3;
};
function named(g,type){
 const ctx=current(g);if(!ctx)return null;
 const {id,person:p,values:val}=ctx;
 const stage=g.personal.stage;
 const day=storyDay(g),r=g.personal;
 if(type==='relationship'){
  if(r.tension>=72)return event('adultCrisis','КРИЗА · 21+',p.name+' хоче чесності',
   'Старі образи накопичилися. '+p.name+' відмовляється вдавати, що все добре.',
   choice('Вислухати без виправдань','Повернення довіри потребує часу','adult:crisis:listen'),
   choice('Взяти дистанцію','Більше свободи, ризик розриву','adult:crisis:leave'),true);
  if(stage==='acquaintance'){
   return event('adultFlirt','ЗНАЙОМСТВО · 21+',p.name+' пропонує побачення',
    'Між вами виникла симпатія. '+p.name+' хоче зрозуміти, чи поважатимеш ти особисті межі.',
    choice('Поговорити відверто','+довіра, повільніший розвиток','adult:flirt:honest'),
    choice('Запросити на вечірку','+хімія, ризик поспіху','adult:flirt:party'));
  }
  const pool=[
   event('adultBoundaries','БЛИЗЬКІСТЬ · 21+','Розмова перед близькістю',
    p.name+' пропонує обговорити взаємну згоду, комфорт і приватність до спільної ночі.',
    choice('Обговорити межі','+безпека, +довіра','adult:boundaries:talk'),
    choice('Відкласти близькість','Жодного тиску, +повага','adult:boundaries:wait')),
   event('adultIntimacy','ІНТИМНІСТЬ · 21+','Ніч удвох',
    p.name+' готовий(а) до близькості, якщо ви обоє цього хочете. Завтра важливий матч.',
    choice('Провести ніч разом','Взаємна згода, -відпочинок','adult:intimacy:yes'),
    choice('Відпочити окремо','+відновлення, межі збережено','adult:intimacy:no')),
   event('adultPrivacy','ПРИВАТНІСТЬ · 21+','Фото після побачення',
    p.name+' хоче опублікувати спільне фото. Тренер просив уникати публічності перед матчем.',
    choice('Дозволити фото','+відкритість, увага преси','adult:privacy:public'),
    choice('Зберегти приватність','Менше чуток, важлива розмова','adult:privacy:private')),
   event('adultWork','ДОРОСЛЕ ЖИТТЯ · 21+','Кар’єра партнера важлива',
    p.name+' має професійну подію саме в день твоєї клубної зустрічі.',
    choice('Підтримати партнера','+довіра, ризик для клубу','adult:work:partner'),
    choice('Виконати вимогу клубу','+кар’єра, ризик образи','adult:work:club')),
   event('adultFinances','СПІЛЬНІ ГРОШІ · 21+','Витрати й незалежність',
    p.name+' пропонує розподілити витрати. Твоя зарплата значно більша.',
    choice('Обговорити бюджет','+рівність, +довіра','adult:finance:fair'),
    choice('Платити за все самому','+комфорт, нерівні очікування','adult:finance:cover')),
   event('adultFriends','ДРУЗІ · 21+','У кожного свій вечір',
    p.name+' хоче піти до друзів окремо. Ти давно не бачив партнера.',
    choice('Підтримати свободу','+повага, +довіра','adult:friends:trust'),
    choice('Попросити побути разом','Можлива близькість або напруга','adult:friends:together')),
   event('adultHonesty','ВІДВЕРТІСТЬ · 21+','Незручна розмова',
    'На вечірці з тобою фліртували. '+p.name+' ставить пряме запитання.',
    choice('Розповісти чесно','+довіра, складна розмова','adult:honesty:truth'),
    choice('Приховати зустріч','Менше напруги зараз, ризик','adult:honesty:hide'))
  ];
  const choices=pool.filter(e=>e.id!==val.lastScene);
  const picked=choose(g,choices.length?choices:pool);
  val.lastScene=picked.id;
  return picked;
 }
 if(type==='night'){
  if(stage==='acquaintance')return null;
  const pool=[
   event('adultNightClub','НІЧНЕ ЖИТТЯ · 21+','VIP-запрошення після матчу',
    'Відомий організатор кличе тебе на закриту вечірку. Преса вже знає місце.',
    choice('Піти на вечірку','+знайомства, ризик витоку','adult:night:party'),
    choice('Залишитися вдома','+відновлення, менше ризику','adult:night:home')),
   event('adultSecret','СПОКУСА · 21+','Таємне запрошення',
    'Інша доросла людина пропонує приватну зустріч. Ти перебуваєш у стосунках.',
    choice('Погодитися на зустріч','Потенційна зрада, пізні наслідки','adult:secret:meet'),
    choice('Відмовитися','+лояльність, збереження довіри','adult:secret:decline'),true),
   event('adultPressure','ПРЕСА · 21+','Журналіст шукає сенсацію',
    'Репортер пропонує гроші за подробиці особистого життя твого партнера.',
    choice('Відмовити журналісту','+лояльність, менше грошей','adult:press:refuse'),
    choice('Дати невинне інтерв’ю','+дохід, ризик перекручення','adult:press:interview'))
  ];
  const pool2=pool.filter(e=>e.id!==val.lastScene);
  const picked=choose(g,pool2.length?pool2:pool);
  val.lastScene=picked.id;
  return picked;
 }
 return null;
}
export function adultRelationshipScene(g){
 const ctx=current(g);if(!ctx)return null;
 const a=initAdultLife(g),now=storyDay(g);
 if(a.lastChoiceDay===now)return null;
 // Allow existing milestone scenes, but make adult relationship development
 // substantial and varied over repeated days.
 if(['acquaintance'].includes(g.personal.stage))return named(g,'relationship');
 if(g.personal.tension>=72)return named(g,'relationship');
 if(now%3===0 || (ctx.values.hiddenHistory>=15 && now%2===0))return named(g,'relationship');
 return null;
}
export function adultNightScene(g){
 const ctx=current(g);if(!ctx)return null;
 const a=initAdultLife(g),now=storyDay(g);
 if(a.lastChoiceDay===now || g.personal.stage==='acquaintance')return null;
 if(now%3===1 || a.privacyRisk>=40 && now%2===1)return named(g,'night');
 return null;
}
export function adultPendingScene(g,item){
 const p=item.payload?.personId;
 if(p && p!==g.personal?.personId && item.kind!=='adultMediaLeak')return null;
 const ctx=current(g),name=ctx?.person.name||'Партнер';
 switch(item.kind){
  case 'adultAftercare':
   return event('adultAftercare','БЛИЗЬКІСТЬ · НАСЛІДКИ',name+' хоче поговорити',
    'Після спільної ночі партнер хоче обговорити комфорт, взаємні очікування та особисті межі.',
    choice('Вислухати уважно','+емоційна безпека й довіра','adult:aftercare:listen'),
    choice('Дати особистий простір','Повага до темпу, менше близькості','adult:aftercare:space'));
  case 'adultPhoto':
   return event('adultPhoto','ПРЕСА · НАСЛІДКИ','Фото стало публічним',
    'Публікація з побачення викликала чутки. Спонсор вимагає пояснення перед новим контрактом.',
    choice('Захистити приватність','+довіра, конфлікт зі спонсором','adult:photo:protect'),
    choice('Зробити публічну заяву','Репутація під контролем, ризик сварки','adult:photo:statement'),true);
  case 'adultWorkUltimatum':
   return event('adultWorkUltimatum','КАР’ЄРА · НАСЛІДКИ',name+' втомився(лася) чекати',
    'Партнер двічі переносив свої плани заради футболу. Тепер пропонує жити окремо.',
    choice('Домовитися про час','Зобов’язання і шанс примирення','adult:ultimatum:promise'),
    choice('Не змінювати пріоритетів','Ризик розриву, +форма','adult:ultimatum:career'),true);
  case 'adultSecretDiscovery':
   return event('adultSecretDiscovery','ЗРАДА · НАСЛІДКИ','Таємниця розкривається',
    name+' знайшов(ла) підтвердження зустрічі. Попередні заперечення лише погіршують ситуацію.',
    choice('Зізнатися повністю','Боляче зараз, шанс чесного виходу','adult:discovery:admit'),
    choice('Продовжити приховувати','Можливий розрив і скандал','adult:discovery:deny'),true);
  case 'adultMediaLeak':
   return event('adultMediaLeak','ПРИВАТНІСТЬ · РИЗИК','Особисте життя в заголовках',
    'Журналісти публікують чутки після закритої вечірки. Агент хвилюється за контракт.',
    choice('Поставити межі пресі','+приватність, репутаційний ризик','adult:media:boundaries'),
    choice('Дати контрольований коментар','Вплив на спонсорів, -приватність','adult:media:reply'),true);
  case 'adultBudget':
   return event('adultBudget','ФІНАНСИ · НАСЛІДКИ',name+' повертається до бюджету',
    'Нерівні витрати породили образу. Партнер наполягає на прозорих домовленостях.',
    choice('Домовитися про бюджет','+довіра, менше особистих грошей','adult:budget:agree'),
    choice('Відкласти суперечку','Короткий спокій, нові витрати','adult:budget:delay'));
  case 'adultRepair':
   return event('adultRepair','ДОВІРА · ДОВГІ НАСЛІДКИ','Чи можливе примирення?',
    name+' не забув(ла) попередній конфлікт. Одна зустріч не відновить усі обіцянки.',
    choice('Почати з чесності','Тривалий шлях до довіри','adult:repair:honesty'),
    choice('Пожити окремо','Більше простору, ризик розриву','adult:repair:separate'),true);
  default:return null;
 }
}
export function resolveAdultChoice(g,id){
 const parts=id.split(':'),type=parts[1],action=parts[2];
 const ctx=current(g);
 if(!ctx)return {ok:false,message:'Особиста історія змінилася. Ця ситуація вже недоступна.'};
 const {id:personId,values:v,person:p}=ctx;
 const state=initAdultLife(g),day=storyDay(g);
 const result=message=>{
  state.lastChoiceDay=day;state.choiceCount++;state.lastScene=type;
  trace(g,type+':'+action,message);
  return {ok:true,message};
 };
 const loyalty=(key,description,change)=>impact(g,personId,key,description,change);
 if(type==='flirt'){
  if(action==='honest'){
   v.sharedBoundaries=clamp(v.sharedBoundaries+15);
   v.emotionalSafety=clamp(v.emotionalSafety+9);
   relation(g,{trust:9,bond:6});loyalty('first_boundaries','Ти говорив про особисті межі від першого побачення.',{trust:6,affinity:4});
   return result('Відверта розмова створила безпечний початок стосунків.');
  }
  v.intimacyComfort=clamp(v.intimacyComfort+7);relation(g,{bond:13,trust:-3});
  add(g,{energy:-13,money:-Math.min(180,g.money),morale:6});
  delayed(g,'MediaLeak',3,personId);
  return result('Вечірка зблизила вас, але привернула увагу сторонніх людей.');
 }
 if(type==='boundaries'){
  if(action==='talk'){
   v.sharedBoundaries=clamp(v.sharedBoundaries+20);
   v.emotionalSafety=clamp(v.emotionalSafety+15);
   relation(g,{trust:11,bond:5,tension:-7});
   loyalty('talked_consent','Ти відкрито обговорив згоду, комфорт і особисті межі.',{trust:9,loyalty:6,resentment:-5});
   delayed(g,'Aftercare',2,personId);
   return result('Взаємна згода й розмова про комфорт зміцнили близькість.');
  }
  v.emotionalSafety=clamp(v.emotionalSafety+7);
  relation(g,{trust:6,tension:-5});
  loyalty('respected_not_now','Ти погодився відкласти близькість без тиску.',{trust:7,resentment:-5});
  return result('Ви обоє поважаєте власний темп. Партнер пам’ятатиме це.');
 }
 if(type==='intimacy'){
  if(action==='yes'){
   if(v.intimacyComfort<20||g.personal.trust<18)return {ok:false,message:'Зараз партнери не почуваються достатньо комфортно для близькості.'};
   v.intimacyComfort=clamp(v.intimacyComfort+11);
   v.emotionalSafety=clamp(v.emotionalSafety+4);
   relation(g,{bond:10,trust:4,tension:-4});
   add(g,{energy:-12,morale:5});
   loyalty('consensual_closeness','Ви провели ніч разом за взаємною згодою.',{trust:4,affinity:7});
   delayed(g,'Aftercare',2,personId);
   return result('Ви провели близьку ніч удвох. Наступного дня з’явилися нові очікування.');
  }
  v.emotionalSafety=clamp(v.emotionalSafety+7);relation(g,{trust:6,tension:-3});add(g,{energy:12,stress:-4});
  loyalty('accepted_boundaries','Ти чесно попросив відпочинку замість близькості.',{trust:5});
  return result('Ви обрали відпочинок. Межі не стали приводом для конфлікту.');
 }
 if(type==='privacy'){
  if(action==='public'){
   state.privacyRisk=clamp(state.privacyRisk+20);v.publicity=clamp(v.publicity+20);
   relation(g,{bond:8,trust:3});
   add(g,{reputation:3,stress:3});
   delayed(g,'Photo',3,personId);
   return result('Фото зміцнило відчуття відкритості, але зацікавило пресу.');
  }
  v.discretion=clamp(v.discretion+10);relation(g,{trust:5,tension:2});
  loyalty('discussed_publicity','Ви домовлялися про приватність спільних фото.',{trust:6});
  return result('Фото залишилося приватним. Ви домовилися обговорювати публічність разом.');
 }
 if(type==='work'){
  if(action==='partner'){
   v.workSupported=clamp(v.workSupported+16);v.workPressure=clamp(v.workPressure-6);
   relation(g,{trust:10,bond:6});
   add(g,{form:-3,energy:-8,stress:3});
   impact(g,personId,'supported_job','Ти підтримав професійну подію партнера.',{trust:7,loyalty:9});
   rememberCoach(g);
   return result('Партнер відчув підтримку. Тренер поставив питання про твою дисципліну.');
  }
  v.workPressure=clamp(v.workPressure+14);
  relation(g,{trust:-6,tension:9});
  add(g,{form:4,energy:-7});
  loyalty('skipped_career_event','Ти пропустив важливу професійну подію партнера.',{trust:-8,resentment:11});
  delayed(g,'WorkUltimatum',8,personId);
  return result('Тренер задоволений. Партнер сприйняв твій вибір як байдужість.');
 }
 if(type==='finance'){
  if(action==='fair'){
   v.workSupported=clamp(v.workSupported+6);
   v.commitment=clamp(v.commitment+5);
   relation(g,{trust:8,tension:-5});
   add(g,{money:-Math.min(g.money,120)});
   loyalty('fair_budget','Ти домовився про рівноправний спільний бюджет.',{trust:9,loyalty:5});
   return result('Ви обрали спільні правила витрат. Суперечка втратила гостроту.');
  }
  v.hiddenHistory=clamp(v.hiddenHistory+6);
  add(g,{money:-Math.min(g.money,600)});
  relation(g,{bond:7,trust:-3});
  delayed(g,'Budget',7,personId);
  return result('Щедрість допомогла сьогодні, але невисловлені очікування залишилися.');
 }
 if(type==='friends'){
  if(action==='trust'){
   v.circle=clamp(v.circle+9);v.independence=clamp(v.independence+3);
   relation(g,{trust:8,tension:-6});
   loyalty('respected_social_circle','Ти поважав окремих друзів та особистий час партнера.',{trust:7,loyalty:4});
   return result('Ти підтримав окреме соціальне життя партнера. Довіра зросла.');
  }
  if(g.personal.trust>=56){
   relation(g,{trust:3,bond:7});
   return result('Ви домовилися про інший спільний вечір без сварки.');
  }
  v.hiddenHistory=clamp(v.hiddenHistory+8);relation(g,{trust:-7,tension:10});
  delayed(g,'Repair',5,personId);
  return result('Розмова перетворилася на ревнощі. Партнер просить більше свободи.');
 }
 if(type==='honesty'){
  if(action==='truth'){
   v.emotionalSafety=clamp(v.emotionalSafety+10);
   relation(g,{trust:11,tension:-6});
   loyalty('truth_about_flirt','Ти чесно розповів про чужий флірт.',{trust:10,resentment:-4});
   return result('Твоя чесність запобігла чуткам. Партнер запам’ятав розмову.');
  }
  v.hiddenHistory=clamp(v.hiddenHistory+18);state.privacyRisk=clamp(state.privacyRisk+6);
  relation(g,{trust:-8,tension:7});
  delayed(g,'SecretDiscovery',5,personId);
  return result('Розмову відкладено. Пізніше ця деталь може зруйнувати довіру.');
 }
 if(type==='night'){
  if(action==='party'){
   add(g,{money:-Math.min(g.money,370),energy:-17,stress:7,morale:7});
   state.privacyRisk=clamp(state.privacyRisk+19);
   delayed(g,'MediaLeak',3,personId);
   return result('Вечірка подарувала нові знайомства. Журналісти зацікавилися твоїм оточенням.');
  }
  add(g,{energy:18,stress:-6});relation(g,{trust:4,tension:-3});
  return result('Ти відпочив і уникнув зайвої уваги перед матчем.');
 }
 if(type==='secret'){
  if(action==='meet'){
   v.hiddenHistory=clamp(v.hiddenHistory+28);state.privacyRisk=clamp(state.privacyRisk+25);
   relation(g,{trust:-10,tension:6});
   add(g,{stress:12,energy:-10,morale:5});
   loyalty('secret_appointment','Ти приховав приватну зустріч з іншою дорослою людиною.',{trust:-10,resentment:12,loyalty:-8});
   delayed(g,'SecretDiscovery',4,personId);
   return result('Таємна зустріч відбулася. Її наслідки ще не закінчилися.');
  }
  relation(g,{trust:7,tension:-3});v.emotionalSafety=clamp(v.emotionalSafety+5);
  loyalty('declined_secrecy','Ти відмовився від таємної зустрічі.',{trust:7,loyalty:8});
  return result('Ти обрав прозорі стосунки. Ніхто не втратив своєї свободи.');
 }
 if(type==='press'){
  if(action==='refuse'){
   relation(g,{trust:8});state.privacyRisk=clamp(state.privacyRisk-9);
   impact(g,personId,'protected_private_life','Ти захистив особисту інформацію партнера від преси.',{trust:10,loyalty:8});
   return result('Ти не продав приватні подробиці. Партнер відчув підтримку.');
  }
  add(g,{money:500,reputation:3});
  state.privacyRisk=clamp(state.privacyRisk+13);
  delayed(g,'MediaLeak',5,personId);
  return result('Інтерв’ю принесло гроші. Редакція може перекрутити твої слова.');
 }
 if(type==='aftercare'){
  if(action==='listen'){
   v.emotionalSafety=clamp(v.emotionalSafety+14);
   relation(g,{trust:9,bond:5,tension:-4});
   loyalty('heard_aftercare','Ти уважно вислухав партнера після близькості.',{trust:10,affinity:5});
   return result('Партнер відчув турботу. Ваші очікування стали зрозумілішими.');
  }
  v.emotionalSafety=clamp(v.emotionalSafety+5);relation(g,{trust:3});
  return result('Партнер отримав потрібний простір. Розмову можна продовжити пізніше.');
 }
 if(type==='photo'){
  if(action==='protect'){
   relation(g,{trust:11});add(g,{reputation:-2,stress:5});
   state.privacyRisk=clamp(state.privacyRisk-17);
   delayed(g,'MediaLeak',9,personId);
   return result('Ти захистив партнера. Спонсор став уважніше перевіряти репутацію.');
  }
  add(g,{reputation:6,stress:3});relation(g,{trust:-6,tension:7});
  v.publicity=clamp(v.publicity+8);
  return result('Заява заспокоїла пресу, але партнер не погодився з формулюванням.');
 }
 if(type==='ultimatum'){
  if(action==='promise'){
   relation(g,{trust:6,tension:-7});add(g,{energy:-9,stress:5});
   v.workSupported=clamp(v.workSupported+8);
   delayed(g,'Repair',8,personId);
   return result('Ти пообіцяв узгоджувати час. Партнер спостерігає за діями.');
  }
  relation(g,{trust:-15,bond:-12,tension:16});add(g,{form:6,stress:6});
  loyalty('chose_work_again','Ти вдруге обрав футбол замість спільних планів.',{trust:-12,resentment:15});
  delayed(g,'Repair',7,personId);
  return result('Форма зросла. Партнер серйозно розглядає окреме життя.');
 }
 if(type==='discovery'){
  if(action==='admit'){
   v.hiddenHistory=clamp(v.hiddenHistory-20);
   relation(g,{trust:-17,bond:-12,tension:15});add(g,{stress:16,morale:-8});
   loyalty('admitted_secrecy','Ти визнав приховану зустріч після викриття.',{trust:-15,resentment:20});
   delayed(g,'Repair',9,personId);
   return result('Правду сказано, але повернення довіри потребуватиме багатьох рішень.');
  }
  v.hiddenHistory=clamp(v.hiddenHistory+23);
  relation(g,{trust:-24,tension:23});
  state.privacyRisk=clamp(state.privacyRisk+25);
  delayed(g,'MediaLeak',6,personId);
  delayed(g,'Repair',9,personId);
  return result('Заперечення збільшили недовіру. Ризик публічного скандалу зростає.');
 }
 if(type==='media'){
  if(action==='boundaries'){
   state.privacyRisk=clamp(state.privacyRisk-22);
   relation(g,{trust:6});
   add(g,{reputation:-3,stress:4});
   return result('Ти попросив пресу поважати приватність. Деякі спонсори незадоволені.');
  }
  add(g,{reputation:5,stress:6});
  state.privacyRisk=clamp(state.privacyRisk+12);
  relation(g,{trust:-4,tension:6});
  return result('Коментар знизив тиск зараз, але відкрив деталі для подальших питань.');
 }
 if(type==='budget'){
  if(action==='agree'){
   add(g,{money:-Math.min(g.money,220)});
   relation(g,{trust:10,tension:-8});
   loyalty('budget_repaired','Ви погодили чесні правила фінансів.',{trust:9,resentment:-8});
   return result('Ви домовилися про бюджет. Суперечка завершена без приниження.');
  }
  relation(g,{trust:-7,tension:8});
  delayed(g,'Repair',8,personId);
  return result('Відкладена розмова продовжила фінансовий конфлікт.');
 }
 if(type==='repair'){
  if(action==='honesty'){
   relation(g,{trust:10,tension:-16,bond:4});
   v.hiddenHistory=clamp(v.hiddenHistory-10);
   loyalty('long_repair','Ти почав послідовно повертати довіру.',{trust:9,resentment:-10});
   return result('Перша чесна розмова допомогла. Старі рани не зникли миттєво.');
  }
  const breaking=g.personal.trust<25||g.personal.tension>81;
  if(breaking){
   loyalty('adult_separation','Ваші стосунки завершилися після довгої кризи.',{trust:-5,resentment:8});
   g.personal={personId:null,stage:'single',bond:0,trust:55,tension:5,quietDays:0};
   add(g,{morale:-12,stress:11});
   return result('Партнер завершив стосунки. Рішення залишило слід у репутації та пам’яті.');
  }
  relation(g,{bond:-8,tension:3});add(g,{stress:-2});
  return result('Ви тимчасово живете окремо. Майбутнє ще не визначено.');
 }
 return {ok:false,message:'Ситуація більше не доступна.'};
}
function rememberCoach(g){
 remember(g,'coach','missed_club_for_partner','Ти пропустив клубну зустріч заради професійної події партнера.',{trust:-7,resentment:6});
 queueArc(g,'memorySelection',7,{},'adult-work-coach-'+storyDay(g));
}
export function adultSnapshot(g){
 const s=initAdultLife(g);
 const ctx=current(g);
 return {
  active:ctx?{name:ctx.person.name,age:ctx.person.age,
   values:{...ctx.values},bond:g.personal.bond,trust:g.personal.trust,tension:g.personal.tension,
   stage:g.personal.stage}:null,
  privacyRisk:s.privacyRisk,choices:s.choiceCount,history:s.history.slice(0,9)
 };
}
