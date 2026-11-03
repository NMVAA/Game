import {CLUBS,CLUB_BY_ID,CONTACTS,CONTACT_BY_ID,POSITIONS,TRAINING,formatCash} from './data.js';
import {newGame,gameClock,scorePlayer,train,meet,relationshipAction,recover,negotiate,acceptOffer,rejectOffer,nextDay,beginMatch,matchAction} from './engine.js';
import {initMemory,remember,memoryOf,currentPartnerId,makePromise,resolvePromise,queueArc,markArc,updateMemoryClock,careerAccess} from './memory.js';
import {initNpcWorld,advanceNpcWorld} from './npc.js';
import {npcScene,resolveNpcChoice} from './npc-scenes.js';

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
 if(g.story?.version===3){initMemory(g);initNpcWorld(g);return g.story;}
 // Migrate existing Football Life careers without replacing their decisions,
 // money, relationships, previous scandals or scheduled story events.
 if(g.story?.version===2){
   g.story.version=3;
   g.story.pending ||= [];g.story.flags ||= {};g.story.journal ||= [];
   initMemory(g);initNpcWorld(g);
   return g.story;
 }
 g.story={version:3,step:0,dayKey:'',pending:[],flags:{},journal:[],
   agentTrust:58,clubTrust:58,media:22,privacy:68,temptation:0,sponsor:0,
   scandal:0,financialPressure:0,romanceHeat:0,focus:55,agentDeal:false,
   lastEvent:'',matches:0};
 initMemory(g);initNpcWorld(g);return g.story;
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
 const due=g.story.pending.map((p,i)=>({p,i})).filter(x=>x.p.due<=dateNum(g)).sort((a,b)=>a.p.due-b.p.due||a.i-b.i);
 if(!due.length)return null;
 const item=g.story.pending.splice(due[0].i,1)[0];
 if(item.payload?.actor?.startsWith('partner:')&&item.payload.actor!==currentPartnerId(g)){
   markArc(g,item);return pendingEvent(g);
 }
 if(item.kind?.startsWith('npcPartner')&&item.payload?.partnerId!==g.personal?.personId){
   markArc(g,item);return pendingEvent(g);
 }
 markArc(g,item);
 if(item.kind?.startsWith('npc')){
   const autonomous=npcScene(g,item);
   return autonomous||pendingEvent(g);
 }
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
 case 'memoryPromise':
  return event('memoryPromise','ОБІЦЯНКИ · ПАМ’ЯТЬ','Ти дав слово, яке пам’ятають',
    name+' очікує на обіцяну зустріч. Тренер одночасно викликає тебе на додаткову підготовку.',
    opt('Дотримати обіцянку','Довіра близької людини, менше сил','promise:keep'),
    opt('Поставити футбол вище','Сильніший зв’язок із тренером, образа вдома','promise:break'),true);
 case 'memoryBoard':
  return event('memoryBoard','КЛУБ · РОЗСЛІДУВАННЯ','Керівництво пам’ятає домовленість',
    'Після таємних переговорів клуб отримав подробиці. Тренер ставить пряме запитання про твою лояльність.',
    opt('Визнати домовленість','Можливе примирення, фінансовий ризик','board:honest'),
    opt('Захищати агента','Клуб запам’ятає брехню','board:cover'),true);
 case 'memoryEvidence':
  return event('memoryEvidence','КЛУБ · ПІДТВЕРДЖЕННЯ','З’явилися докази',
    'Журналісти оприлюднили факти, які суперечать твоїм попереднім словам. Агент просить мовчати.',
    opt('Виправити свідчення','Втрата обличчя зараз, шанс повернути довіру','evidence:admit'),
    opt('Звинуватити агента','Конфлікт з представником','evidence:blame'),true);
 case 'memoryAgent':
  return event('memoryAgent','АГЕНТ · НАСЛІДКИ','Агент пам’ятає недовіру',
    'Твій представник затримує інформацію про клуби. Старі образи впливають на майбутні контракти.',
    opt('Відновити співпрацю','Розмова й часткове примирення','agent:repair'),
    opt('Змінити агента','Витрати, нові можливості','agent:replace'),true);
 case 'memorySelection':
  return event('memorySelection','ТАКТИКА · СКЛАД','Тренер обирає стартовий склад',
    'Старі конфлікти вплинули на твою позицію. Капітан готовий висловитися на твою підтримку.',
    opt('Попросити шанс','Ризик відмови, можлива довіра','selection:request'),
    opt('Прийняти конкуренцію','Час на тренування, менше напруги','selection:accept'),true);
 case 'memoryTeam':
  return event('memoryTeam','РОЗДЯГАЛЬНЯ · КОНФЛІКТ','Команда розділилася',
    'Капітан пригадав ваш конфлікт. Частина футболістів підтримує його перед важливим матчем.',
    opt('Поговорити з капітаном','Визнати образу й повернути довіру','team:apologize'),
    opt('Відстояти свою позицію','Більше напруги, власний авторитет','team:challenge'),true);
 case 'memoryRelationship':
  return event('memoryRelationship','СТОСУНКИ · ПАМ’ЯТЬ',name+' пам’ятає обіцянки',
    'Попередні обіцянки, переїзди та пропущені вечори накопичилися. Зараз слова важливіші за подарунки.',
    opt('Вислухати без виправдань','+довіра, -час і сили','memory:listen'),
    opt('Поставити межі','+самостійність, ризик розриву','memory:boundaries'),true);
 case 'memoryRelocation':
  return event('memoryRelocation','ТРАНСФЕР · ДАЛЕКІ НАСЛІДКИ','Нове місто, нові правила',
    'Партнер і клуб по-різному оцінюють твій переїзд. Один із них чекає на компроміс.',
    opt('Домовитися з партнером','Гроші й час проти стабільності','relocation:family'),
    opt('Зосередитись на футболі','Ризик образи, більше підтримки клубу','relocation:club'),true);
 case 'memoryOpportunity':
  return event('memoryOpportunity','КАР’ЄРА · ВИНАГОРОДА','Стару лояльність оцінили',
    'Тренер пам’ятає, як ти підтримав команду. Тобі пропонують роль у важливому матчі.',
    opt('Взяти відповідальність','+форма, -енергія, шанс на ріст','opportunity:lead'),
    opt('Залишитися командним гравцем','+довіра команди, стабільність','opportunity:team'));
 case 'investment':
  return event('investment','ФІНАНСИ · НАСЛІДКИ','Ризикована інвестиція',
    'Твоя інвестиція змінилася в ціні. Агент пропонує зафіксувати результат або ризикнути.',
    opt('Продати актив','Фіксація прибутку чи збитку','invest:sell'),
    opt('Тримати далі','Висока волатильність','invest:hold'));
 default:return null;
 }
}
function agent(g){
 const access=careerAccess(g);
 if(access.agentFrozen)return event('agentFreeze','АГЕНТ · ПАМ’ЯТЬ','Агент припинив співпрацю',
   'Накопичені образи заблокували переговори. Поки конфлікт не вирішено, нові пропозиції надходять повільніше.',
   opt('Налагодити відносини','Примирення коштує довіри до себе','agent:repair'),
   opt('Найняти іншого агента','€900, новий старт','agent:replace'),true);
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
 const personMemory=currentPartnerId(g)?memoryOf(g,currentPartnerId(g)):null;
 if(personMemory?.resentment>=55&&r.stage!=='acquaintance'){
   return event('rememberedHurt','СТОСУНКИ · НАКОПИЧЕНЕ','Старий конфлікт повернувся',
     p.name+' пам’ятає невиконані обіцянки. Навіть щирі побачення більше не вирішують проблему.',
     opt('Відверто вислухати','Довге примирення, -час','memory:listen'),
     opt('Зробити паузу','Можливе розставання','memory:boundaries'),true);
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
 updateMemoryClock(g);
 advanceNpcWorld(g);
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
 if(id.startsWith('npc:'))result=resolveNpcChoice(g,id);
 else if(id.startsWith('train:')){
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
   if(code==='negotiate'){
     result=negotiate(g,offer.id);
     if(result.ok)remember(g,'agent','negotiation','Ти вимагав для себе кращі умови.',{trust:result.message?.includes('підвищен')?4:-3,loyalty:2});
   }
   if(code==='reject'){
     remember(g,'agent','offer_rejected','Ти відхилив роботу агента.',{trust:-5,resentment:5});
     result=rejectOffer(g,offer.id);
   }
   if(code==='accept'){
     const previousClub=g.clubId;
     result=acceptOffer(g,offer.id);
     if(result.ok){
       remember(g,'agent','offer_signed','Агент допоміг підписати контракт.',{trust:7,loyalty:8});
       remember(g,'coach','departure_'+previousClub,'Ти залишив команду.',{trust:-5,resentment:6});
       if(g.personal.personId){postpone(g,'move',2);queueArc(g,'memoryRelocation',14,{actor:currentPartnerId(g)},'relocate-'+dateNum(g));}
       stat(g,{stress:7});
     }
   }
  }
  if(code==='negotiate')advance=false;
 }
 else if(id.startsWith('relation:')){
   const action=id.slice(9);
   if(['commit','live','marry'].includes(action)){
     result=relationshipAction(g,action);
     if(result.ok&&currentPartnerId(g)){
       remember(g,currentPartnerId(g),'commit_'+action,'Ти погодився на спільний важливий крок.',{trust:8,loyalty:8,affinity:5});
       if(makePromise(g,currentPartnerId(g),'shared-time','Проводити час разом навіть у насиченому сезоні.',6))
         queueArc(g,'memoryPromise',6,{actor:currentPartnerId(g)},'partner-time-'+dateNum(g));
     }
   }else if(['delay','separate','postpone'].includes(action)){
     social(g,{bond:-5,tension:7});stat(g,{stress:2});
     if(currentPartnerId(g))remember(g,currentPartnerId(g),'delayed_commitment','Ти відклав важливе рішення.',{trust:-5,resentment:7});
   }
 }
 else if(id==='date:dinner'){
   result=g.daily.social?{ok:true,message:'Сьогодні ви вже бачилися. Завтра буде новий шанс.'}:relationshipAction(g,'date');
   if(result.ok&&currentPartnerId(g))remember(g,currentPartnerId(g),'shared_evening','Ти організував побачення.',{trust:4,affinity:6});
 }
 else if(id==='date:talk'){
   result=g.daily.social?{ok:true,message:'Ви вже поговорили сьогодні. Не квап події.'}:relationshipAction(g,'talk');
   if(result.ok&&currentPartnerId(g))remember(g,currentPartnerId(g),'talked_honestly','Ти знайшов час для щирої розмови.',{trust:7,resentment:-4});
 }
 else if(id==='intimacy:yes'){
  // Explicit mutual consent, off-screen intimacy, adult characters only.
  social(g,{bond:9,trust:3,tension:-4});stat(g,{energy:-8,morale:5});
  s.romanceHeat=cap(s.romanceHeat+9);
  if(currentPartnerId(g))remember(g,currentPartnerId(g),'mutual_consent','Близькість була за взаємною згодою.',{trust:5,affinity:4});
  result={ok:true,message:'Ви провели близьку ніч разом за взаємною згодою.'};
 }
 else if(id==='intimacy:no'){social(g,{trust:5,tension:-2});stat(g,{energy:5});
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'respected_boundaries','Ти поділився своїми межами.',{trust:7,resentment:-3});
   result={ok:true,message:'Особисті межі поважаються. Довіра зросла.'};}
 else if(id==='secret:accept'){
   social(g,{trust:-6,tension:4});
   stat(g,{energy:-10,morale:7,stress:8});
   setFlag(g,'secretLiaison',true);
   s.scandal=cap(s.scandal+16);
   s.romanceHeat=cap(s.romanceHeat+8);
   postpone(g,'affairExposure',2+Math.floor(roll(g)*4));
   if(s.sponsor)postpone(g,'sponsorThreat',5);
    if(currentPartnerId(g)){
      remember(g,currentPartnerId(g),'secret_affair','Ти приховав від партнера зустріч з іншою дорослою людиною.',{trust:-11,resentment:16,loyalty:-10});
      queueArc(g,'memoryRelationship',13,{actor:currentPartnerId(g)},'secret-'+dateNum(g));
    }
   result={ok:true,message:'Взаємна близькість залишилася таємницею лише на деякий час.'};
 }
 else if(id==='secret:decline'){
   social(g,{trust:7,tension:-4});
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'rejected_secret','Ти відмовився від ризикованої зустрічі.',{trust:7,loyalty:9});
   stat(g,{morale:-2,stress:-3});
   result={ok:true,message:'Ти не порушив довіри партнера. Запрошення залишилося в минулому.'};
 }
 else if(id==='affair:confess'){
   setFlag(g,'secretLiaison',false);
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'affair_confessed','Ти зізнався у зраді; наслідки залишаються надовго.',{trust:-22,resentment:25,loyalty:-12});
   social(g,{trust:-23,bond:-16,tension:19});
   stat(g,{stress:17,morale:-9});
   s.scandal=cap(s.scandal-8);
   if(g.personal.bond<15){relationshipAction(g,'breakup');}
 }
 else if(id==='affair:deny'){
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'affair_denied','Ти продовжив приховувати правду.',{trust:-17,resentment:20});
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
 else if(id==='captain:challenge'){stat(g,{morale:4,stress:5});s.clubTrust=cap(s.clubTrust-12);postpone(g,'mentor',3);
   remember(g,'captain','public_clash','Ти публічно посварився з капітаном.',{trust:-13,resentment:19,loyalty:-5});
   queueArc(g,'memoryTeam',9,{},'row-'+dateNum(g));}
 else if(id==='captain:private'){s.clubTrust=cap(s.clubTrust+8);stat(g,{morale:-2,reputation:1});
   remember(g,'captain','private_talk','Ти обрав приватну розмову.',{trust:11,loyalty:10,resentment:-8});
   queueArc(g,'memoryOpportunity',12,{},'support-'+dateNum(g));}
 else if(id==='coach:stay'){
   stat(g,{energy:-16,form:3});
   remember(g,'coach','extra_session','Ти залишився на додаткове тренування.',{trust:12,loyalty:9});
   if(currentPartnerId(g)){
     social(g,{tension:6,bond:-3});
     if(makePromise(g,currentPartnerId(g),'shared-time','Провести обіцяний вечір разом.',3))
       queueArc(g,'memoryPromise',3,{actor:currentPartnerId(g)},'promise-'+dateNum(g));
   }else queueArc(g,'memoryOpportunity',9,{},'practice-'+dateNum(g));
 }
 else if(id==='coach:leave'){
   remember(g,'coach','left_practice','Ти пропустив додаткову роботу заради особистих планів.',{trust:-10,resentment:9});
   queueArc(g,'memorySelection',8,{},'lineup-'+dateNum(g));
   if(currentPartnerId(g)){social(g,{bond:8});remember(g,currentPartnerId(g),'kept_date','Ти дотримав особистої домовленості.',{trust:8,affinity:6,loyalty:6});}
   else stat(g,{energy:5});
 }
 else if(id==='interview:open'){s.media=cap(s.media+12);s.privacy=cap(s.privacy-14);stat(g,{reputation:3,stress:3});
   remember(g,'press','public_interview','Ти публічно обговорив приватні питання.',{affinity:6,trust:4});
   if(roll(g)<.24)postpone(g,'agentLeak',3);
 }
 else if(id==='interview:quiet'){s.privacy=cap(s.privacy+6);s.media=cap(s.media-3);}
 else if(id==='agent:yes'){
   s.agentDeal=true;stat(g,{stress:4});postpone(g,'agentLeak',3);
   remember(g,'agent','secret_pact','Ти погодився на конфіденційну угоду з агентом.',{trust:12,loyalty:9});
   remember(g,'coach','secret_negotiations','Ти не повідомив тренеру про переговори.',{trust:-4,resentment:5});
   queueArc(g,'memoryBoard',11,{},'board-deal-'+dateNum(g));
 }
 else if(id==='agent:no'){
   s.agentDeal=false;s.privacy=cap(s.privacy+6);
   remember(g,'agent','rejected_pact','Ти відмовився від закритої угоди.',{trust:-8,resentment:6});
   queueArc(g,'memoryAgent',8,{},'agent-distance-'+dateNum(g));
 }
 else if(id==='sponsor:meet'){postpone(g,'sponsor',2);stat(g,{stress:2});}
 else if(id==='sponsor:skip')stat(g,{form:3,reputation:-1});
 else if(id==='photo:honest'){s.scandal=cap(s.scandal-20);s.privacy=cap(s.privacy-8);stat(g,{reputation:-4,stress:5});if(partner(g))social(g,{trust:6,tension:3});}
 else if(id==='photo:deny'){s.scandal=cap(s.scandal+22);stat(g,{reputation:1,stress:8});postpone(g,'partnerDoubt',3);}
 else if(id==='sponsor:accept'){stat(g,{money:5200,reputation:5});s.sponsor=1;s.privacy=cap(s.privacy-10);}
 else if(id==='sponsor:reject'){s.privacy=cap(s.privacy+5);stat(g,{morale:2});}
 else if(id==='leak:investigate'){stat(g,{stress:7});
   remember(g,'agent','investigated_leak','Ти відкрито звинуватив агента у витоку інформації.',{trust:-15,resentment:17});
   if(roll(g)<.55){s.scandal=cap(s.scandal-12);result={ok:true,message:'Розслідування виявило непрофесійність агента.'};}
   queueArc(g,'memoryAgent',8,{},'leak-agent-'+dateNum(g));
 }
 else if(id==='leak:quiet'){s.scandal=cap(s.scandal+8);stat(g,{stress:-3});
   remember(g,'agent','covered_leak','Ти захистив агента попри чутки.',{trust:7,loyalty:10});
   if(roll(g)<.45)postpone(g,'photo',4);
   queueArc(g,'memoryBoard',13,{},'board-leak-'+dateNum(g));
 }
 else if(id==='doubt:truth'){social(g,{trust:7,tension:14,bond:-3});s.scandal=cap(s.scandal-9);}
 else if(id==='doubt:hide'){social(g,{trust:-19,tension:19});s.scandal=cap(s.scandal+8);}
 else if(id==='rehab:rest'){stat(g,{energy:19,form:-5,stress:-6});}
 else if(id==='rehab:play'){stat(g,{form:4,energy:-23,stress:10});if(roll(g)<.4)stat(g,{form:-10,energy:-10});}
 else if(id==='mentor:talk'){s.clubTrust=cap(s.clubTrust+11);stat(g,{morale:4});
   remember(g,'captain','reconciled','Ти спробував помиритися з капітаном.',{trust:13,resentment:-14,loyalty:8});
 }
 else if(id==='mentor:stand'){s.clubTrust=cap(s.clubTrust-12);stat(g,{reputation:2,stress:3});
   remember(g,'captain','defied_mentor','Ти наполіг на своїй позиції після конфлікту.',{trust:-10,resentment:14});
   queueArc(g,'memoryTeam',10,{},'mentor-row-'+dateNum(g));
 }
 else if(id==='move:compromise'){if(g.money>=850)stat(g,{money:-850});social(g,{trust:12,bond:6,tension:-7});
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'move_together','Ти врахував плани партнера при переїзді.',{trust:12,affinity:8,loyalty:12,resentment:-7});
 }
 else if(id==='move:career'){social(g,{trust:-13,bond:-9,tension:15});stat(g,{form:4});
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'move_alone','Ти поставив кар’єру вище спільних планів.',{trust:-13,resentment:17,loyalty:-11});
   queueArc(g,'memoryRelationship',15,{actor:currentPartnerId(g)},'move-backlash-'+dateNum(g));
 }
 else if(id==='finance:invest'){if(g.money>=900){stat(g,{money:-900});setFlag(g,'investment',900);postpone(g,'investment',4);}else result={ok:false,message:'Немає €900 для інвестиції.'};}
 else if(id==='finance:save')stat(g,{stress:-2});
 else if(id==='invest:sell'){const change=roll(g)<.5?-230:520;stat(g,{money:900+change});setFlag(g,'investment',0);result={ok:true,message:'Ти закрив інвестицію: '+(change>=0?'+':'')+formatCash(change)+'.'};}
 else if(id==='invest:hold'){if(roll(g)<.52)stat(g,{money:70});else stat(g,{stress:5});postpone(g,'investment',5);}
 else if(id==='night:party'){
  stat(g,{money:-Math.min(g.money,340),morale:9,energy:-16,stress:6});s.media=cap(s.media+9);
  if(partner(g)){
    social(g,{tension:10});
    remember(g,currentPartnerId(g),'unannounced_party','Ти не попередив партнера про нічну вечірку.',{trust:-6,resentment:10});
  }
  if(roll(g)<.32){postpone(g,'photo',2);s.scandal=cap(s.scandal+11);}
 }
 else if(id==='night:home'){stat(g,{energy:15,stress:-7});s.clubTrust=cap(s.clubTrust-2);
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'rest_at_home','Ти обрав тихий вечір удома.',{trust:3,affinity:4});
 }
 else if(id==='night:rest')stat(g,{energy:20,stress:-10});
 else if(id==='night:extra'){stat(g,{form:5,energy:-13,stress:4});if(g.energy<40)postpone(g,'rehab',2);}
 else if(id==='night:media'){stat(g,{reputation:4,stress:5});s.privacy=cap(s.privacy-11);if(roll(g)<.2)postpone(g,'agentLeak',4);}
 else if(id==='night:private'){s.privacy=cap(s.privacy+9);stat(g,{morale:1});}
 else if(id==='public:talk'){s.scandal=cap(s.scandal-12);stat(g,{reputation:-2,stress:3});}
 else if(id==='public:ignore'){s.scandal=cap(s.scandal+9);stat(g,{stress:5});}
 else if(id==='promise:keep'){
   const p=resolvePromise(g,'shared-time','kept',currentPartnerId(g));
   if(p){stat(g,{energy:-12,money:-Math.min(g.money,130),stress:-4,morale:3});social(g,{bond:5,tension:-5});}
   result={ok:true,message:p?'Партнер запам’ятав, що ти дотримав слова.':'Час разом покращив ваші стосунки.'};
 }
 else if(id==='promise:break'){
   const p=resolvePromise(g,'shared-time','broken',currentPartnerId(g));
   stat(g,{form:4,energy:-5,stress:5});
   remember(g,'coach','kept_training_priority','Ти поставив тренування вище особистої обіцянки.',{trust:5,loyalty:4});
   if(p)queueArc(g,'memoryRelationship',9,{actor:currentPartnerId(g)},'broken-promise-'+dateNum(g));
   result={ok:true,message:'Тренер задоволений. Образа партнера може повернутися пізніше.'};
 }
 else if(id==='board:honest'){
   remember(g,'coach','board_truth','Ти чесно відповів клубу про переговори.',{trust:7,resentment:-5});
   remember(g,'agent','revealed_confidentiality','Ти відкрив таємну угоду керівництву.',{trust:-9,resentment:10});
   stat(g,{reputation:-3,stress:8});
   if(memoryOf(g,'coach').trust>=56)queueArc(g,'memoryOpportunity',15,{},'board-honesty-'+dateNum(g));
   result={ok:true,message:'Клуб цінує відвертість. Агент більше не повністю тобі довіряє.'};
 }
 else if(id==='board:cover'){
   remember(g,'coach','covered_secret','Ти приховав від клубу домовленість.',{trust:-13,resentment:18});
   remember(g,'agent','guarded_secret','Ти захистив агента перед керівництвом.',{trust:9,loyalty:9});
   queueArc(g,'memoryEvidence',14,{},'board-evidence-'+dateNum(g));
   stat(g,{stress:10});
   result={ok:true,message:'Ти виграв час. Але клуб продовжив збирати документи.'};
 }
 else if(id==='evidence:admit'){
   remember(g,'coach','corrected_testimony','Ти визнав приховані деталі після викриття.',{trust:4,resentment:-7});
   remember(g,'press','correction','Ти офіційно змінив попередню заяву.',{trust:-4,resentment:5});
   stat(g,{reputation:-9,stress:12});
   queueArc(g,'memorySelection',10,{},'lineup-after-evidence-'+dateNum(g));
   result={ok:true,message:'Тренер бачить спробу виправити помилку, але місце у складі під загрозою.'};
 }
 else if(id==='evidence:blame'){
   remember(g,'agent','blamed_for_secret','Ти переклав відповідальність на агента.',{trust:-20,resentment:23});
   remember(g,'coach','agent_blame','Ти звинуватив агента замість пояснень.',{trust:-6,resentment:10});
   queueArc(g,'memoryAgent',10,{},'agency-fallout-'+dateNum(g));
   result={ok:true,message:'Агент скоротив контакти, а клуб продовжує сумніватися.'};
 }
 else if(id==='agent:repair'){
   stat(g,{money:-Math.min(g.money,160),stress:-3});
   remember(g,'agent','repaired_working_relationship','Ти визнав минулі конфлікти й відновив робочий контакт.',{trust:19,resentment:-21,loyalty:8});
   result={ok:true,message:'Агент відновлює переговори, хоча попередні образи ще не зникли.'};
 }
 else if(id==='agent:replace'){
   const m=initMemory(g),old=m.actors.agent;
   m.actors['former-agent-'+dateNum(g)]={...old,memories:[...old.memories]};
   m.actors.agent={trust:57,affinity:50,resentment:0,loyalty:0,memories:[],lastContact:dateNum(g)};
   s.agentTrust=57;s.agentDeal=false;
   stat(g,{money:-Math.min(g.money,900),stress:7});
   remember(g,'agent','new_representation','Новий агент почав працювати з тобою.',{trust:2});
   queueArc(g,'memoryOpportunity',12,{},'new-agent-'+dateNum(g));
   result={ok:true,message:'Ти змінив агента. Старий конфлікт залишився частиною твоєї історії.'};
 }
 else if(id==='selection:request'){
   const captain=memoryOf(g,'captain');
   const support=(captain?.loyalty||0)>12 || (captain?.trust||0)>65;
   remember(g,'coach','requested_starting_place','Ти попросив ще один шанс у стартовому складі.',
     support?{trust:13,resentment:-11}:{trust:-5,resentment:7});
   stat(g,support?{form:6,stress:-2}:{stress:9,form:-3});
   result={ok:true,message:support?'Капітан підтримав тебе. Тренер дав шанс.':'Тренер не переконаний. Старі конфлікти все ще впливають.'};
 }
 else if(id==='selection:accept'){
   remember(g,'coach','accepted_rotation','Ти спокійно прийняв конкуренцію за склад.',{trust:5,resentment:-5});
   stat(g,{form:4,energy:-9,stress:-5});
   result={ok:true,message:'Тренер помітив твою дисципліну. Повернення в основу ще потрібно заслужити.'};
 }
 else if(id==='team:apologize'){
   remember(g,'captain','apologized_for_conflict','Ти визнав свою участь у конфлікті.',{trust:13,resentment:-20,loyalty:10});
   remember(g,'coach','resolved_dressing_room','Ти спробував заспокоїти роздягальню.',{trust:4});
   if(memoryOf(g,'captain').loyalty>=10)queueArc(g,'memoryOpportunity',13,{},'captain-reconciliation-'+dateNum(g));
   result={ok:true,message:'Капітан поступово повертає довіру. Команда запам’ятала твою реакцію.'};
 }
 else if(id==='team:challenge'){
   remember(g,'captain','escalated_conflict','Ти знову протистояв капітану перед командою.',{trust:-13,resentment:19});
   remember(g,'coach','unstable_dressing_room','Ти посилив конфлікт у роздягальні.',{trust:-8,resentment:8});
   stat(g,{stress:10,reputation:1});
   queueArc(g,'memorySelection',8,{},'captain-rotation-'+dateNum(g));
   result={ok:true,message:'Частина команди підтримує тебе, але тренер переглядає склад.'};
 }
 else if(id==='memory:listen'){
   const p=currentPartnerId(g);
   if(p)remember(g,p,'reconciliation','Ти вислухав претензії й визнав старі образи.',{trust:12,resentment:-26,loyalty:7});
   stat(g,{energy:-9,morale:3,stress:3});
   result={ok:true,message:'Примирення почалося. Однієї розмови не досить, щоб стерти минуле.'};
 }
 else if(id==='memory:boundaries'){
   const p=currentPartnerId(g);
   if(p)remember(g,p,'new_boundaries','Ти обрав дистанцію замість примирення.',{trust:-12,resentment:12,loyalty:-8});
   stat(g,{form:3,stress:4});
   if(g.personal.personId&&g.personal.trust<18){
     const departed=currentPartnerId(g);
     remember(g,departed,'relationship_end','Невиконані обіцянки призвели до розриву.',{loyalty:-10});
     relationshipAction(g,'breakup');
     result={ok:true,message:'Стосунки завершилися. Цей досвід залишиться в пам’яті персонажа.'};
   }else result={ok:true,message:'Дистанція дала свободу, але поглибила недовіру.'};
 }
 else if(id==='relocation:family'){
   stat(g,{money:-Math.min(g.money,700),energy:-8});
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'compromised_on_relocation','Ти домовлявся про спільний переїзд.',{trust:10,loyalty:11,resentment:-8});
   result={ok:true,message:'Ви знайшли компроміс щодо нового міста. Переїзд коштував грошей і часу.'};
 }
 else if(id==='relocation:club'){
   remember(g,'coach','prioritized_new_club','Ти повністю зосередився на новій команді.',{trust:7,loyalty:6});
   if(currentPartnerId(g))remember(g,currentPartnerId(g),'ignored_relocation_needs','Ти не врахував плани партнера після переїзду.',{trust:-14,resentment:18,loyalty:-9});
   stat(g,{form:5,stress:3});
   if(currentPartnerId(g))queueArc(g,'memoryRelationship',13,{actor:currentPartnerId(g)},'relocation-argument-'+dateNum(g));
   result={ok:true,message:'Тренер задоволений. Партнер почувається чужим у новому місті.'};
 }
 else if(id==='opportunity:lead'){
   remember(g,'coach','accepted_responsibility','Ти взяв на себе лідерство у важливому матчі.',{trust:6,loyalty:5});
   remember(g,'captain','helped_team','Ти допоміг команді в складний момент.',{trust:3,loyalty:6});
   stat(g,{form:6,energy:-13,stress:5});
   result={ok:true,message:'Ти отримав більше довіри, але навантаження та очікування зросли.'};
 }
 else if(id==='opportunity:team'){
   remember(g,'captain','shared_spotlight','Ти підтримав команду замість особистих амбіцій.',{trust:8,loyalty:10,resentment:-4});
   remember(g,'coach','team_first','Ти поставив командний результат вище власного статусу.',{trust:6});
   stat(g,{morale:5,energy:-5});
   result={ok:true,message:'Команда пам’ятатиме, що ти поділився відповідальністю.'};
 }
 else if(id==='match:wait'||id==='match:recover'){advance=false;if(id==='match:recover')stat(g,{energy:5});}
 if(!result.ok){return result;}
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
 // Advance other characters on the in-game calendar, never the wall clock.
 advanceNpcWorld(g);
 if(g.personal.personId&&g.personal.tension>=90&&roll(g)<.3){
   social(g,{bond:-12,trust:-9});
   postpone(g,'partnerDoubt',1);
 }
 return {ok:true,message:summary,scene:before};
}
export function restartStory(g){ensureStory(g);g.story.step=0;g.story.dayKey='';g.story.active=null;}
