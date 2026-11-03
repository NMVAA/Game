import {CLUBS,CLUB_BY_ID,CONTACTS,CONTACT_BY_ID,POSITIONS,TRAINING,formatCash} from './data.js';
import {newGame,gameClock,scorePlayer,train,meet,relationshipAction,recover,negotiate,acceptOffer,rejectOffer,nextDay,beginMatch,matchAction} from './engine.js';

const cap=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const roll=g=>{g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;};
const pick=(g,a)=>a[Math.floor(roll(g)*a.length)];
const dateNum=g=>(g.season-1)*98+(g.week-1)*7+g.day;
const partner=g=>CONTACT_BY_ID[g.personal.personId];
const skillNames={finishing:'удари',passing:'передачі',speed:'швидкість',defense:'відбір'};
const event=(id,tag,title,text,a,b,major=false)=>({id,tag,title,text,a,b,major});
const opt=(label,sub,id)=>({label,sub,id});
const stat=(g,values)=>{for(const [k,v] of Object.entries(values)){if(k==='money')g.money=Math.max(0,g.money+v);else g[k]=cap((g[k]||0)+v)};};
const social=(g,values)=>{for(const [k,v] of Object.entries(values))g.personal[k]=cap((g.personal[k]||0)+v);g.personal.quietDays=0;};
const timeline=(g,description,kind='story')=>{g.feed.unshift({text:description,type:kind,season:g.season,week:g.week,day:g.day});g.feed=g.feed.slice(0,35);};
const postpone=(g,kind,days,payload={})=>g.story.pending.push({kind,due:dateNum(g)+days,payload});
const setFlag=(g,name,value=true)=>g.story.flags[name]=value;
const flag=(g,name)=>g.story.flags[name];
function record(g,label,result){
  g.story.journal.unshift({day:gameClock(g),choice:label,outcome:result});
  g.story.journal=g.story.journal.slice(0,32);
  timeline(g,result,'story');
}
export function ensureStory(g){
 if(g.story?.version===2)return g.story;
 g.story={version:2,step:0,dayKey:'',pending:[],flags:{},journal:[],
   agentTrust:58,clubTrust:58,media:22,privacy:68,temptation:0,sponsor:0,
   scandal:0,financialPressure:0,romanceHeat:0,focus:55,agentDeal:false,
   lastEvent:'',matches:0};
 return g.story;
}
function training(g){
 const role=POSITIONS.find(x=>x.id===g.position)?.focus||'passing';
 const alternative=role==='finishing'?'speed':role==='speed'?'passing':role==='passing'?'defense':'passing';
 if(g.energy<19||g.daily.trained){
   return event('training-rest','ПІДГОТОВКА','Тренер спостерігає',
     'Ти втомлений після насиченого тижня. Відновлення чи відеоаналіз?',
     opt('Фізичне відновлення','Менше ризику травми','train:rest'),
     opt('Розбір помилок','Зросте дисципліна','train:study'));
 }
 return event('training','ТРЕНУВАННЯ','Тренер чекає рішення',
   'Конкурент претендує на твоє місце. Розвиватимеш сильну сторону чи станеш універсальнішим?',
   opt('Відпрацювати '+skillNames[role],'+профільна навичка, -енергія','train:'+role),
   opt('Розвивати '+skillNames[alternative],'+універсальність, -енергія','train:'+alternative));
}
function pendingEvent(g){
 const index=g.story.pending.findIndex(x=>x.due<=dateNum(g));
 if(index<0)return null;
 const item=g.story.pending.splice(index,1)[0];
 const name=partner(g)?.name||'партнер';
 switch(item.kind){
 case 'photo':
  return event('photo','ПРЕСА · НАСЛІДКИ','Фото потрапило в мережу',
    'Після нічної зустрічі преса опублікувала твоє фото. Клуб вимагає пояснень.',
    opt('Визнати помилку','-репутація зараз, +довіра','photo:honest'),
    opt('Все заперечувати','Ризик нових викриттів','photo:deny'),true);
 case 'sponsor':
  return event('sponsor','БРЕНД · КОНТРАКТ','Спонсор перевіряє репутацію',
    'Бренд пропонує вигідний контракт, але хоче контролювати твою поведінку поза полем.',
    opt('Підписати умови','+дохід, -свобода','sponsor:accept'),
    opt('Відмовитися','+приватність, без бонусу','sponsor:reject'));
 case 'agentLeak':
  return event('agentLeak','ІНТРИГА · АГЕНТ','З’явився витік переговорів',
    'Конфіденційні цифри зарплати опублікували журналісти. Підозра падає на твого агента.',
    opt('Вимагати розслідування','Конфлікт з агентом','leak:investigate'),
    opt('Зам’яти історію','Менше розголосу зараз','leak:quiet'),true);
 case 'partnerDoubt':
  return event('partnerDoubt','СТОСУНКИ · ДОВІРА',name+' знає про чутки',
    'Твій партнер почув суперечливу версію вечора. Потрібна відверта розмова.',
    opt('Розповісти правду','Ризик болісної реакції','doubt:truth'),
    opt('Приховати деталі','Ризик втратити довіру','doubt:hide'),true);
 case 'rehab':
  return event('rehab','ЗДОРОВ’Я · НАСЛІДКИ','Навантаження дало збій',
    'Лікар помічає перевтому. Продовження повного навантаження може погіршити стан.',
    opt('Знизити навантаження','+здоров’я, -форма','rehab:rest'),
    opt('Продовжити тренування','+форма, ризик травми','rehab:play'));
 case 'mentor':
  return event('mentor','КОМАНДА · НАСЛІДКИ','Капітан запам’ятав рішення',
    'Після попереднього конфлікту капітан пропонує поговорити без присутності тренера.',
    opt('Піти на компроміс','+довіра команди','mentor:talk'),
    opt('Наполягти на своєму','+характер, ризик сварки','mentor:stand'));
 case 'move':
  return event('move','СТОСУНКИ · ПЕРЕЇЗД','Новий клуб, старі обіцянки',
    'Після трансферу близька людина не впевнена, що хоче залишити своє місто.',
    opt('Шукати спільне рішення','-гроші, +довіра','move:compromise'),
    opt('Поставити кар’єру першою','+фокус, -близькість','move:career'),true);
 case 'affairExposure':
  return event('affairExposure','ОСОБИСТЕ · ВИКРИТТЯ','Таємниця більше не таємниця',
    'Близька людина дізналася про таємну зустріч. Слова можуть не врятувати ваші стосунки.',
    opt('Сказати всю правду','Втрата довіри, шанс примирення','affair:confess'),
    opt('Заперечувати','Відкладена криза довіри','affair:deny'),true);
 case 'sponsorThreat':
  return event('sponsorThreat','КОНТРАКТ · КОНФЛІКТ','Спонсор ставить ультиматум',
    'Після скандалу спонсор вимагає публічного вибачення або погрожує розірвати контракт.',
    opt('Визнати відповідальність','Менше доходу, шанс зберегти угоду','sponsor:apology'),
    opt('Відмовитися','Свобода, фінансовий удар','sponsor:walk'),true);
 case 'investment':
  return event('investment','ФІНАНСИ · НАСЛІДКИ','Ризикована інвестиція',
    'Твоя інвестиція змінилася в ціні. Агент пропонує зафіксувати результат або ризикнути.',
    opt('Продати актив','Фіксація прибутку чи збитку','invest:sell'),
    opt('Тримати далі','Висока волатильність','invest:hold'));
 default:return null;
 }
}
function agent(g){
 const offer=g.offers?.[0];
 if(offer){
   const club=CLUB_BY_ID[offer.clubId];
   return event('offer','ТРАНСФЕР · АГЕНТ',club.name+' зробив пропозицію',
     'Зарплата '+formatCash(offer.wage)+' на тиждень. Бонус '+formatCash(offer.bonus)+'. Переїзд змінить твоє життя.',
     offer.negotiated?opt('Підписати','Нова команда й місто','offer:accept'):opt('Вимагати більше','Переговори можуть зірватися','offer:negotiate'),
     offer.negotiated?opt('Відхилити','Зберегти нинішній контракт','offer:reject'):opt('Підписати одразу','Без додаткових переговорів','offer:accept'));
 }
 const scenarios=[
 event('captain','РОЗДЯГАЛЬНЯ','Капітан незадоволений','Після тренування капітан публічно критикує твою дисципліну.',
   opt('Відповісти різко','+впевненість, -довіра','captain:challenge'),
   opt('Поговорити наодинці','+довіра, -гордість','captain:private')),
 event('coach','КЛУБ · РЕПУТАЦІЯ','Тренер пропонує вибір','Тренер просить залишитися після заняття. Увечері тебе чекають особисті плани.',
   opt('Залишитися','+довіра клубу, -енергія','coach:stay'),
   opt('Дотримати особисту обіцянку','+близькість, -довіра клубу','coach:leave')),
 event('interview','МЕДІА · РИЗИК','Незручне запитання журналіста','Журналіст питає про твою зарплату та стосунки з тренером.',
   opt('Відповісти відкрито','+публічність, ризик чуток','interview:open'),
   opt('Захистити приватність','+приватність, менше уваги','interview:quiet')),
 event('agentDeal','АГЕНТ · ІНТРИГА','Агент хоче ексклюзивність','Агент пропонує таємну угоду за швидший доступ до трансферів.',
   opt('Погодитися','+можливості, ризик витоку','agent:yes'),
   opt('Відмовитися','Менше ризику, слабший агент','agent:no')),
 event('sponsorIntro','КОМЕРЦІЯ','Перший великий бренд','Бренд цікавиться тобою після кількох яскравих виступів.',
   opt('Піти на зустріч','+потенційний дохід','sponsor:meet'),
   opt('Віддати час тренуванням','+фокус, менше реклами','sponsor:skip'))
 ];
 if(g.story.agentTrust<30)return scenarios[3];
 if(g.story.clubTrust<28)return scenarios[0];
 if(g.reputation>=27&&roll(g)<.3)return scenarios[4];
 return scenarios[Math.floor(roll(g)*scenarios.length)];
}
function life(g){
 const p=partner(g),r=g.personal;
 if(!p){
  const candidates=CONTACTS.filter(c=>c.age>=21);
  const a=candidates[(g.week+g.day)%candidates.length],b=candidates[(g.week+g.day+2)%candidates.length];
  return event('meet','ОСОБИСТЕ · 21+','Вечір із новими знайомствами',
    'Двоє дорослих людей запрошують тебе на зустріч. Вибір змінить твою особисту історію.',
    opt(a.name+', '+a.age,a.job+' · '+a.vibe,'meet:'+a.id),
    opt(b.name+', '+b.age,b.job+' · '+b.vibe,'meet:'+b.id));
 }
 if(r.tension>=65)return event('fight','СТОСУНКИ · КРИЗА','Довіра на межі',
   p.name+' говорить про дистанцію та нерозуміння. Один вечір може змінити ваші стосунки.',
   opt('Визнати свою відповідальність','+довіра, -его','fight:listen'),
   opt('Взяти паузу','Більше свободи, менше близькості','fight:distance'),true);
 if(r.stage==='acquaintance'&&r.bond>=40&&r.trust>=35)return event('commit','СТОСУНКИ · ВИБІР','Звичайні побачення вже не достатні',
    p.name+' хоче зрозуміти, чи готовий ти до серйозних стосунків.',
    opt('Стати парою','+близькість, нові обов’язки','relation:commit'),
    opt('Не поспішати','+свобода, ризик дистанції','relation:delay'));
 if(r.stage==='relationship'&&r.bond>=66&&r.trust>=52)return event('moveIn','СТОСУНКИ · СПІЛЬНЕ ЖИТТЯ','Ключі від однієї квартири',
    p.name+' пропонує жити разом. Це зблизить вас, але обмежить свободу.',
    opt('Погодитися','+стабільність, -приватність','relation:live'),
    opt('Залишити різні домівки','+свобода, -близькість','relation:separate'));
 if(r.stage==='living'&&r.bond>=87&&r.trust>=70)return event('wedding','СТОСУНКИ · ШЛЮБ','Час вирішити майбутнє',
    p.name+' розмірковує про шлюб. Публічність, контракт і кар’єра впливають на рішення.',
    opt('Зробити пропозицію','+сімейна стабільність, витрати','relation:marry'),
    opt('Відкласти рішення','+фокус на кар’єрі, ризик сварки','relation:postpone'),true);
 const cases=[
   ...(r.stage!=='acquaintance'&&g.story.romanceHeat>5?[
     event('secret','СПОКУСА · 21+','Таємне запрошення',
       'Доросла знайома пропонує провести ніч разом. Відвертість може коштувати нинішніх стосунків.',
       opt('Прийняти запрошення','Ризик зради та розголосу','secret:accept'),
       opt('Відмовитися','Менше драми, +довіра','secret:decline'),true)
   ]:[]),
   event('date','РОМАНТИКА · 21+','Довгоочікуване побачення',p.name+' звільнив вечір. Ти вирішуєш, як його провести.',
    opt('Влаштувати вечерю','€180, +близькість','date:dinner'),opt('Поговорити вдома','Без витрат, +довіра','date:talk')),
   event('intimacy','БЛИЗЬКІСТЬ · 21+','Ніч лише для вас',p.name+' пропонує провести ніч разом. Важливі взаємна згода, довіра та особисті межі.',
    opt('Погодитися','Тепла ніч за взаємною згодою','intimacy:yes'),opt('Обрати спокійний вечір','Повага до власних меж','intimacy:no')),
   event('travel','ПОДОРОЖ · 21+','Запрошення на вихідні',p.name+' хоче провести вихідні разом. Завтра важливе тренування.',
    opt('Поїхати','+стосунки, -форма, витрати','travel:yes'),opt('Залишитися на базі','+форма, ризик образи','travel:no')),
   event('jealousy','СТОСУНКИ · ЗАПИТАННЯ','Новий підписник у соцмережах',p.name+' запитує про активне листування з незнайомою людиною.',
    opt('Пояснити листування','+чесність, -приватність','jealousy:explain'),opt('Змінити тему','+приватність, -довіра','jealousy:dodge'))
 ];
 return pick(g,cases);
}
function night(g){
 const s=g.story;
 if(g.money>=900&&g.reputation>=34&&roll(g)<.24)return event('investment','ГРОШІ · РИЗИК','Друг пропонує інвестицію',
   'Є можливість вкласти €900 у ризикований проєкт. Результат стане відомий пізніше.',
   opt('Інвестувати €900','Можливий прибуток або збиток','finance:invest'),
   opt('Тримати гроші','Без ризику, без доходу','finance:save'));
 if(s.scandal>35&&roll(g)<.45)return event('public','РЕПУТАЦІЯ · НАСЛІДКИ','Журналісти чекають на відповідь',
   'Преса повернулася до чуток про твоє життя. Мовчання теж має ціну.',
   opt('Дати коментар','Можна відновити довіру','public:talk'),
   opt('Проігнорувати пресу','Ризик нової хвилі чуток','public:ignore'));
 return pick(g,[
  event('nightlife','НІЧНЕ ЖИТТЯ · 21+','Команда кличе у клуб',
    'Після перемоги колеги запрошують на вечірку. Вранці тренування.',
    opt('Приєднатися','+команда, -енергія, ризик','night:party'),
    opt('Поїхати додому','+відновлення, -зв’язки','night:home')),
  event('recovery','ДОЗВІЛЛЯ','Тіло просить відпочинку',
    'Ти відчуваєш втому й напруження перед наступними іграми.',
    opt('Відпочинок і сон','+енергія, -стрес','night:rest'),
    opt('Додаткове тренування','+форма, ризик перевтоми','night:extra')),
  event('publicity','РЕПУТАЦІЯ','Нічний дзвінок редактора',
    'Редактор пропонує ексклюзивне інтерв’ю про футбольну кар’єру та особисте життя.',
    opt('Погодитися','+популярність, -приватність','night:media'),
    opt('Відмовитися','+приватність, менше впізнаваності','night:private'))
 ]);
}
function match(g){
 if(!g.match){const r=beginMatch(g);if(!r.ok)return event('waiting','МАТЧ','Поки немає матчу',r.message,
   opt('Дочекатися гри','Наступний день','match:wait'),opt('Зайнятися відновленням','Трохи енергії','match:recover'));}
 const m=g.match,pair=[['pass','dribble'],['press','pass'],['shoot','pass'],['dribble','shoot']][m.turns%4];
 const names={pass:'Зіграти в пас',dribble:'Піти в обіграш',press:'Включити пресинг',shoot:'Пробити по воротах'};
 const hints={pass:'Стабільність і шанс асисту',dribble:'Ризик, шанс загострити атаку',press:'Повернення м’яча',shoot:'Шанс забити або втратити момент'};
 return event('match','МАТЧ · '+m.minute+'′',
   CLUB_BY_ID[m.home].name+' — '+CLUB_BY_ID[m.away].name,
   'Рахунок '+m.homeGoals+':'+m.awayGoals+'. Твоя оцінка '+m.rating.toFixed(1)+'. Ти вирішуєш наступний епізод.',
   opt(names[pair[0]],hints[pair[0]],'match:'+pair[0]),opt(names[pair[1]],hints[pair[1]],'match:'+pair[1]));
}
function limited(s,max){const words=String(s).trim().split(/\s+/);return words.slice(0,max).join(' ');}
export function getScene(g){
 ensureStory(g);
 if(g.match||g.day===6)return match(g);
 const today=dateNum(g),s=g.story;
 if(s.dayKey!==String(today)){s.dayKey=String(today);s.step=0;s.active=null;}
 if(s.active)return s.active;
 let scene;
 if(s.step===0)scene=training(g);
 else if(s.step===1)scene=pendingEvent(g)||agent(g);
 else if(s.step===2)scene=life(g);
 else scene=night(g);
 scene.text=limited(scene.text,scene.major?100:20);
 s.active=scene;
 return scene;
}
export function makeCareer(form){const g=newGame(form);ensureStory(g);return g;}
export function takeChoice(g,side){
 ensureStory(g);
 const s=g.story,scene=getScene(g),selected=scene[side===0?'a':'b'];
 if(!selected)return {ok:false,message:'Немає такого рішення.'};
 const id=selected.id;
 let result={ok:true,message:'Рішення прийнято.'},advance=true;
 if(id.startsWith('train:')){
  const skill=id.slice(6);
  if(skill==='rest')stat(g,{energy:11,stress:-3,form:-1});
  else if(skill==='study')stat(g,{morale:2,reputation:1,energy:-2});
  else result=train(g,skill);
  s.focus=cap(s.focus+(skill==='rest'?0:3));
 }
 else if(id.startsWith('meet:'))result=g.daily.social?{ok:true,message:'Ти вже провів час із людьми сьогодні. Знайомство відкладається.'}:meet(g,id.slice(5));
 else if(id.startsWith('match:')){
  const action=id.slice(6);
  if(action==='wait'){result=nextDay(g);}
  else if(action==='recover'){stat(g,{energy:9});}
  else result=matchAction(g,action);
  advance=false;
  if(result.finished){s.matches++;s.step=0;s.dayKey='';}
 }
 else if(id.startsWith('offer:')){
  const code=id.slice(6),offer=g.offers?.[0];
  if(offer){
   if(code==='negotiate')result=negotiate(g,offer.id);
   if(code==='reject')result=rejectOffer(g,offer.id);
   if(code==='accept'){
    result=acceptOffer(g,offer.id);
    if(result.ok&&g.personal.personId)postpone(g,'move',2);
    if(result.ok){stat(g,{stress:7});s.agentTrust=cap(s.agentTrust+3);}
   }
  }
  if(code==='negotiate')advance=false;
 }
 else if(id.startsWith('relation:')){
  const action=id.slice(9);
  if(['commit','live','marry'].includes(action))result=relationshipAction(g,action);
  else if(action==='delay'||action==='separate'||action==='postpone'){social(g,{bond:-5,tension:7});stat(g,{stress:2});}
 }
 else if(id==='date:dinner'){
   result=g.daily.social?{ok:true,message:'Сьогодні ви вже бачилися. Завтра буде новий шанс.'}:relationshipAction(g,'date');
 }
 else if(id==='date:talk')result=g.daily.social?{ok:true,message:'Ви вже поговорили сьогодні. Не квап події.'}:relationshipAction(g,'talk');
 else if(id==='intimacy:yes'){
  // Explicit mutual consent, off-screen intimacy, adult characters only.
  social(g,{bond:9,trust:3,tension:-4});stat(g,{energy:-8,morale:5});
  s.romanceHeat=cap(s.romanceHeat+9);
  result={ok:true,message:'Ви провели близьку ніч разом за взаємною згодою.'};
 }
 else if(id==='intimacy:no'){social(g,{trust:5,tension:-2});stat(g,{energy:5});result={ok:true,message:'Особисті межі поважаються. Довіра зросла.'};}
 else if(id==='secret:accept'){
   social(g,{trust:-6,tension:4});
   stat(g,{energy:-10,morale:7,stress:8});
   setFlag(g,'secretLiaison',true);
   s.scandal=cap(s.scandal+16);
   s.romanceHeat=cap(s.romanceHeat+8);
   postpone(g,'affairExposure',2+Math.floor(roll(g)*4));
   if(s.sponsor)postpone(g,'sponsorThreat',5);
   result={ok:true,message:'Взаємна близькість залишилася таємницею лише на деякий час.'};
 }
 else if(id==='secret:decline'){
   social(g,{trust:7,tension:-4});
   stat(g,{morale:-2,stress:-3});
   result={ok:true,message:'Ти не порушив довіри партнера. Запрошення залишилося в минулому.'};
 }
 else if(id==='affair:confess'){
   setFlag(g,'secretLiaison',false);
   social(g,{trust:-23,bond:-16,tension:19});
   stat(g,{stress:17,morale:-9});
   s.scandal=cap(s.scandal-8);
   if(g.personal.bond<15){relationshipAction(g,'breakup');}
 }
 else if(id==='affair:deny'){
   social(g,{trust:-16,tension:18});
   s.scandal=cap(s.scandal+15);
   postpone(g,'partnerDoubt',3);
 }
 else if(id==='sponsor:apology'){
   s.scandal=cap(s.scandal-14);stat(g,{money:-Math.min(g.money,900),reputation:-3,morale:-3});
 }
 else if(id==='sponsor:walk'){
   s.sponsor=0;stat(g,{money:-Math.min(g.money,2800),reputation:-4,stress:12});
   result={ok:true,message:'Спонсор припинив співпрацю. Твоя свобода має фінансову ціну.'};
 }
 else if(id==='travel:yes'){if(g.money>=520){stat(g,{money:-520,energy:-17,form:-4,morale:6});social(g,{bond:15,trust:3});}else result={ok:false,message:'Зараз не вистачає коштів на поїздку.'};}
 else if(id==='travel:no'){stat(g,{form:4,energy:-7});social(g,{bond:-5,tension:6});}
 else if(id==='jealousy:explain'){social(g,{trust:9,tension:-9});s.privacy=cap(s.privacy-5);}
 else if(id==='jealousy:dodge'){social(g,{trust:-10,tension:14});postpone(g,'partnerDoubt',2);}
 else if(id==='fight:listen'){social(g,{trust:13,bond:5,tension:-19});stat(g,{stress:6});}
 else if(id==='fight:distance'){social(g,{trust:-11,bond:-12,tension:9});s.privacy=cap(s.privacy+6);if(g.personal.bond<15){result=relationshipAction(g,'breakup');}}
 else if(id==='captain:challenge'){stat(g,{morale:4,stress:5});s.clubTrust=cap(s.clubTrust-12);postpone(g,'mentor',3);}
 else if(id==='captain:private'){s.clubTrust=cap(s.clubTrust+8);stat(g,{morale:-2,reputation:1});}
 else if(id==='coach:stay'){s.clubTrust=cap(s.clubTrust+13);stat(g,{energy:-16,form:3});if(partner(g))social(g,{tension:6,bond:-3});}
 else if(id==='coach:leave'){s.clubTrust=cap(s.clubTrust-7);if(partner(g))social(g,{bond:8});else stat(g,{energy:5});}
 else if(id==='interview:open'){s.media=cap(s.media+12);s.privacy=cap(s.privacy-14);stat(g,{reputation:3,stress:3});if(roll(g)<.24)postpone(g,'agentLeak',3);}
 else if(id==='interview:quiet'){s.privacy=cap(s.privacy+6);s.media=cap(s.media-3);}
 else if(id==='agent:yes'){s.agentTrust=cap(s.agentTrust+12);s.agentDeal=true;stat(g,{stress:4});postpone(g,'agentLeak',3);}
 else if(id==='agent:no'){s.agentTrust=cap(s.agentTrust-7);s.agentDeal=false;s.privacy=cap(s.privacy+6);}
 else if(id==='sponsor:meet'){postpone(g,'sponsor',2);stat(g,{stress:2});}
 else if(id==='sponsor:skip')stat(g,{form:3,reputation:-1});
 else if(id==='photo:honest'){s.scandal=cap(s.scandal-20);s.privacy=cap(s.privacy-8);stat(g,{reputation:-4,stress:5});if(partner(g))social(g,{trust:6,tension:3});}
 else if(id==='photo:deny'){s.scandal=cap(s.scandal+22);stat(g,{reputation:1,stress:8});postpone(g,'partnerDoubt',3);}
 else if(id==='sponsor:accept'){stat(g,{money:5200,reputation:5});s.sponsor=1;s.privacy=cap(s.privacy-10);}
 else if(id==='sponsor:reject'){s.privacy=cap(s.privacy+5);stat(g,{morale:2});}
 else if(id==='leak:investigate'){s.agentTrust=cap(s.agentTrust-16);stat(g,{stress:7});if(roll(g)<.55){s.scandal=cap(s.scandal-12);result={ok:true,message:'Розслідування виявило непрофесійність агента.'};}}
 else if(id==='leak:quiet'){s.scandal=cap(s.scandal+8);stat(g,{stress:-3});if(roll(g)<.45)postpone(g,'photo',4);}
 else if(id==='doubt:truth'){social(g,{trust:7,tension:14,bond:-3});s.scandal=cap(s.scandal-9);}
 else if(id==='doubt:hide'){social(g,{trust:-19,tension:19});s.scandal=cap(s.scandal+8);}
 else if(id==='rehab:rest'){stat(g,{energy:19,form:-5,stress:-6});}
 else if(id==='rehab:play'){stat(g,{form:4,energy:-23,stress:10});if(roll(g)<.4)stat(g,{form:-10,energy:-10});}
 else if(id==='mentor:talk'){s.clubTrust=cap(s.clubTrust+11);stat(g,{morale:4});}
 else if(id==='mentor:stand'){s.clubTrust=cap(s.clubTrust-12);stat(g,{reputation:2,stress:3});}
 else if(id==='move:compromise'){if(g.money>=850)stat(g,{money:-850});social(g,{trust:12,bond:6,tension:-7});}
 else if(id==='move:career'){social(g,{trust:-13,bond:-9,tension:15});stat(g,{form:4});}
 else if(id==='finance:invest'){if(g.money>=900){stat(g,{money:-900});setFlag(g,'investment',900);postpone(g,'investment',4);}else result={ok:false,message:'Немає €900 для інвестиції.'};}
 else if(id==='finance:save')stat(g,{stress:-2});
 else if(id==='invest:sell'){const change=roll(g)<.5?-230:520;stat(g,{money:900+change});setFlag(g,'investment',0);result={ok:true,message:'Ти закрив інвестицію: '+(change>=0?'+':'')+formatCash(change)+'.'};}
 else if(id==='invest:hold'){if(roll(g)<.52)stat(g,{money:70});else stat(g,{stress:5});postpone(g,'investment',5);}
 else if(id==='night:party'){
  stat(g,{money:-Math.min(g.money,340),morale:9,energy:-16,stress:6});s.media=cap(s.media+9);
  if(partner(g))social(g,{tension:10});
  if(roll(g)<.32){postpone(g,'photo',2);s.scandal=cap(s.scandal+11);}
 }
 else if(id==='night:home'){stat(g,{energy:15,stress:-7});s.clubTrust=cap(s.clubTrust-2);}
 else if(id==='night:rest')stat(g,{energy:20,stress:-10});
 else if(id==='night:extra'){stat(g,{form:5,energy:-13,stress:4});if(g.energy<40)postpone(g,'rehab',2);}
 else if(id==='night:media'){stat(g,{reputation:4,stress:5});s.privacy=cap(s.privacy-11);if(roll(g)<.2)postpone(g,'agentLeak',4);}
 else if(id==='night:private'){s.privacy=cap(s.privacy+9);stat(g,{morale:1});}
 else if(id==='public:talk'){s.scandal=cap(s.scandal-12);stat(g,{reputation:-2,stress:3});}
 else if(id==='public:ignore'){s.scandal=cap(s.scandal+9);stat(g,{stress:5});}
 else if(id==='match:wait'||id==='match:recover'){advance=false;if(id==='match:recover')stat(g,{energy:5});}
 if(!result.ok){s.active=null;return result;}
 const before=scene.title;
 const summary=result.message==='Рішення прийнято.'?selected.sub:result.message;
 record(g,before+' — '+selected.label,summary);
 s.lastEvent=scene.id;
 s.active=null;
 if(advance){
   if(s.step>=3){
     const next=nextDay(g);
     if(next.ok){s.step=0;s.dayKey='';}
     else{s.step=0;s.dayKey='';}
   }else s.step++;
 }
 if(s.sponsor&&s.scandal>48&&!s.flags.sponsorCrisis){setFlag(g,'sponsorCrisis',true);postpone(g,'sponsorThreat',2);}
 if(g.personal.personId&&g.personal.tension>=90&&roll(g)<.3){
   social(g,{bond:-12,trust:-9});
   postpone(g,'partnerDoubt',1);
 }
 return {ok:true,message:summary,scene:before};
}
export function restartStory(g){ensureStory(g);g.story.step=0;g.story.dayKey='';g.story.active=null;}
