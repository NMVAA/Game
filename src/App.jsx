import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AnimatePresence,animate,motion,useMotionValue,useTransform} from 'motion/react';
import {CLUBS,CLUB_BY_ID,POSITIONS,formatCash} from '../data.js';
import {loadGame,saveGame,gameClock,scorePlayer} from '../engine.js';
import {ensureStory,getScene,makeCareer,takeChoice} from '../story.js';
import {memorySummary} from '../memory.js';
import {npcSnapshot} from '../npc.js';
import {adultSnapshot} from '../adult-life.js';
import {artForScene,artUrl} from './scene-art.js';
import {plotSnapshot} from '../plot-engine.js';
import {captureOutcomeState,describeChoiceOutcome} from './outcome.js';

const clamp=(value)=>Math.max(0,Math.min(100,Number(value)||0));
const HERO_ART=artUrl('stadium_tunnel');
const kinds={
 training:'stadium','training-rest':'stadium',match:'stadium',waiting:'stadium',captain:'stadium',coach:'stadium',mentor:'stadium',rehab:'stadium',
 offer:'contract',agentDeal:'contract',agentLeak:'contract',sponsor:'contract',sponsorIntro:'contract',investment:'contract',move:'contract',
 meet:'romance',date:'romance',intimacy:'romance',travel:'romance',jealousy:'romance',fight:'romance',commit:'romance',moveIn:'romance',wedding:'romance',partnerDoubt:'romance',secret:'romance',affairExposure:'romance',
 photo:'media',public:'media',publicity:'media',interview:'media',sponsorThreat:'media',nightlife:'night',recovery:'night',
 memoryBoard:'contract',memoryEvidence:'media',memoryAgent:'contract',memoryPromise:'romance',memorySelection:'stadium',
 memoryTeam:'stadium',memoryRelationship:'romance',rememberedHurt:'romance',memoryRelocation:'romance',
 memoryOpportunity:'stadium',agentFreeze:'contract',
 adultFlirt:'romance',adultCrisis:'romance',adultBoundaries:'romance',adultIntimacy:'romance',
 adultPrivacy:'media',adultWork:'romance',adultFinances:'contract',adultFriends:'night',
 adultHonesty:'romance',adultNightClub:'night',adultSecret:'night',adultPressure:'media',
 adultAftercare:'romance',adultPhoto:'media',adultWorkUltimatum:'romance',adultSecretDiscovery:'romance',
 adultMediaLeak:'media',adultBudget:'contract',adultRepair:'romance',
 npcCoachContest:'stadium',npcCoachPromotion:'stadium',npcCoachDrill:'stadium',
 npcAgentSecret:'contract',npcAgentContact:'contract',npcCaptainAlliance:'stadium',npcTeamBond:'stadium',
 npcRivalCompetition:'stadium',npcRivalTransfer:'contract',npcPartnerDistance:'romance',
 npcPartnerCareer:'romance',npcPartnerPlans:'romance'
};
const palettes={
 stadium:['#193d31','#b8f56d','#0e271d'],
 contract:['#3b4030','#f4d19a','#172820'],
 romance:['#40314e','#f0b4b9','#1d2135'],
 media:['#263c51','#c0deff','#142231'],
 night:['#20264c','#bdb4ff','#13182e']
};
const toneFor=scene=>{
 if(scene?.plot) return ({
   stadium_tunnel:'stadium',training:'stadium',recovery:'stadium',
   nightlife:'night',romance:'romance',intimacy:'romance',
   conflict:'romance',transfer:'contract',press:'media',contract:'contract'
 })[scene.art]||'contract';
 return kinds[scene?.id]||'contract';
};
function getSaved(){return loadGame();}

function Artwork({kind,match}){
 const palette=palettes[kind],bright=palette[1];
 return <svg className="artwork" viewBox="0 0 480 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
   <linearGradient id="bg-a" x1="0" y1="0" x2="0" y2="1"><stop stopColor={palette[0]}/><stop offset="1" stopColor={palette[2]}/></linearGradient>
   <radialGradient id="glow-a"><stop stopColor={bright} stopOpacity=".36"/><stop offset="1" stopColor={bright} stopOpacity="0"/></radialGradient>
   <pattern id="grain-a" width="27" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r=".6" fill="white" opacity=".15"/><circle cx="14" cy="18" r=".5" fill="white" opacity=".15"/></pattern>
  </defs>
  <rect width="480" height="520" fill="url(#bg-a)"/>
  <ellipse cx="244" cy="160" rx="260" ry="210" fill="url(#glow-a)"/>
  {kind==='stadium'&&<>
    <path d="M-30 190Q240 -10 510 190V360H-30Z" fill="#244934"/>
    {Array.from({length:12},(_,i)=><path key={i} d={'M-30 '+(177+i*13)+' Q240 '+(6+i*16)+' 510 '+(177+i*13)} fill="none" stroke="#d0eed0" strokeOpacity=".075" strokeWidth="5"/>)}
    <path d="M-40 357H520L490 520H-10Z" fill="#21533a"/>
    <path d="M-50 415H520M95 357L143 520M384 357L333 520" fill="none" stroke="#deead0" strokeOpacity=".45" strokeWidth="3"/>
    <circle cx="240" cy="185" r="31" fill="#d0c3a7"/>
    <path d="M204 220Q240 205 278 224L304 353Q244 376 181 350Z" fill={bright}/>
    <path d="M211 250L154 319M270 248L329 318M204 349L185 457M278 349L294 457" stroke={bright} strokeWidth="21" strokeLinecap="round"/>
    <circle cx="343" cy="442" r="22" fill="#f9f9eb" stroke="#1b2923" strokeWidth="5"/>
    <path d="M345 424L330 440 345 457 360 440Z" fill="#294039"/>
    {match&&<g><rect x="18" y="80" width="122" height="41" rx="10" fill="#082417"/><text x="79" y="106" fill="#d7f7dc" textAnchor="middle" fontSize="16" fontWeight="800">MATCH DAY</text></g>}
   </>}
  {kind==='romance'&&<>
    <circle cx="367" cy="98" r="55" fill="#e5ccba" opacity=".64"/>
    {Array.from({length:12},(_,i)=><g key={i}><rect x={i*44-20} y={218-(i%4)*22} width="42" height="300" fill={i%2?'#26283e':'#30283e'}/><path d={'M'+(i*44-8)+' 270v10m13 0v10m-13 24v10m13 0v10'} stroke="#f5c6a8" opacity=".46" strokeWidth="4"/></g>)}
    <rect x="0" y="398" width="480" height="130" fill="#202b34"/>
    <path d="M0 397H480" stroke="#9697a4" strokeWidth="9"/>
    <circle cx="172" cy="232" r="34" fill="#bca095"/><path d="M128 270Q170 249 212 278L236 520H103Z" fill="#8e829e"/>
    <circle cx="313" cy="223" r="32" fill="#c6a390"/><path d="M274 263Q312 247 353 274L372 520H248Z" fill="#628787"/>
    <path d="M211 346Q245 337 274 344" fill="none" stroke="#c6a394" strokeWidth="18" strokeLinecap="round"/>
   </>}
  {kind==='contract'&&<>
    {Array.from({length:10},(_,i)=><rect key={i} x={i*56-15} y={215-(i%3)*28} width="48" height="320" fill={i%2?'#2b3b30':'#354039'}/>)}
    <ellipse cx="245" cy="471" rx="330" ry="100" fill="#1a3227"/>
    <g transform="translate(145 132) rotate(-8 104 140)">
      <rect width="210" height="288" rx="12" fill="#e0d8bf"/>
      <rect x="21" y="30" width="165" height="21" rx="3" fill="#677c70"/>
      {Array.from({length:7},(_,i)=><rect key={i} x="22" y={77+i*23} width={i%2?124:162} height="6" rx="3" fill="#697f75" opacity=".62"/>)}
      <circle cx="155" cy="230" r="24" fill="none" stroke="#b9a16f" strokeWidth="7"/>
    </g>
    <path d="M62 520Q118 376 189 384L268 470 339 440Q404 462 459 520" fill="#465a45"/>
   </>}
  {kind==='media'&&<>
    {Array.from({length:10},(_,i)=><rect key={i} x={i*58-20} y={185-(i%3)*33} width="54" height="320" fill={i%2?'#2b4259':'#20364a'}/>)}
    <circle cx="347" cy="110" r="130" fill="#f4e2cc" opacity=".15"/>
    <path d="M0 430H480V520H0Z" fill="#1a2936"/>
    <rect x="148" y="285" width="197" height="103" rx="14" fill="#2b4c62" stroke="#b3c6d1" strokeWidth="7"/>
    <circle cx="238" cy="336" r="39" fill="#7891a1" stroke="#ccdde2" strokeWidth="11"/><circle cx="238" cy="336" r="18" fill="#193346"/>
    <rect x="306" y="261" width="44" height="24" rx="4" fill="#d9e7ee"/>
    <path d="M150 386L110 520M342 386L385 520" stroke="#9daeb5" strokeWidth="12"/>
    <circle cx="80" cy="118" r="7" fill="white"/><path d="M80 88V148M50 118H110" stroke="white" strokeOpacity=".75" strokeWidth="4"/>
   </>}
  {kind==='night'&&<>
    <circle cx="359" cy="100" r="43" fill="#ead8c7" opacity=".65"/>
    {Array.from({length:13},(_,i)=><g key={i}><rect x={i*43-14} y={202-(i%4)*24} width="38" height="328" fill={i%2?'#232a47':'#1b203d'}/><rect x={i*43+2} y={263-(i%3)*13} width="7" height="19" fill="#d3a5e5" opacity=".5"/></g>)}
    <path d="M0 430Q240 365 480 430V520H0Z" fill="#171d37"/>
    <path d="M0 469Q240 412 480 478" fill="none" stroke="#aa8ad1" strokeWidth="12"/>
    <circle cx="240" cy="258" r="32" fill="#d0a9a6"/>
    <path d="M196 306Q240 282 286 307L321 520H160Z" fill="#67628c"/>
    {Array.from({length:12},(_,i)=><circle key={i} cx={(i*67)%475} cy={26+(i*47)%160} r={i%2?2:3} fill="#d5cdff" opacity=".8"/>)}
   </>}
  <rect width="480" height="520" fill="url(#grain-a)"/>
 </svg>;
}
function Header({game,onJournal,onMenu}){
 const c=CLUB_BY_ID[game.clubId];
 return <header className="header">
  <div className="brand"><span className="brand-mark">FL<b>·</b></span><div className="club-info"><strong>{c?.name||'Клуб'}</strong><small>{gameClock(game)}</small></div></div>
  <div className="header-actions"><span className="cash">{formatCash(game.money)}</span><button type="button" className="menu-return" onClick={onMenu} aria-label="Повернутися до головного меню">Меню</button><button type="button" className="journal-btn" onClick={onJournal} aria-label="Історія рішень">☷</button></div>
 </header>;
}
function Meter({label,value,warn}){
 return <div className="meter"><div><small>{label}</small><b>{Math.round(clamp(value))}%</b></div><i><em style={{width:clamp(value)+'%',background:warn?'#f5a48f':'#b8f56d'}}/></i></div>;
}
function Journal({game,onClose}){
 const s=ensureStory(game),mem=memorySummary(game),world=npcSnapshot(game),adult=adultSnapshot(game),plots=plotSnapshot(game);
 return <motion.div className="journal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
  <motion.section className="journal-panel" role="dialog" aria-modal="true" aria-label="Історія та наслідки" initial={{y:85}} animate={{y:0}} exit={{y:85}} transition={{type:'spring',stiffness:300,damping:28}} onClick={e=>e.stopPropagation()}>
    <div className="journal-title"><div><small>FOOTBALL LIFE</small><h2>Твої наслідки</h2></div><button type="button" onClick={onClose}>✕</button></div>
    <div className="journal-stats"><span>Рейтинг <b>{scorePlayer(game)}</b></span><span>Клуб <b>{Math.round(s.clubTrust)}%</b></span><span>Агент <b>{Math.round(s.agentTrust)}%</b></span><span>Скандали <b>{Math.round(s.scandal)}%</b></span></div>
    <details className="plot-details" open>
     <summary>СЮЖЕТНІ ЛАНЦЮГИ <span>{plots.started}/{plots.total} розпочато · {plots.completed} завершено</span></summary>
     <div className="plot-list">
      {plots.threads.length?plots.threads.map(t=>
       <article className={'plot-entry state-'+t.status} key={t.id}>
        <div className="plot-entry-head"><b>{t.name}</b>
         <span>{t.status==='completed'?'Завершено':t.status==='aftermath'?'Післянаслідки':'У розвитку'}</span></div>
        <div className="plot-entry-step"><small>{t.category} · {t.phase}</small><strong>{t.chapter} / {t.total}</strong></div>
        <div className="plot-entry-progress"><i style={{width:((t.status==='completed'?7:t.chapter-1)/7*100)+'%'}}/></div>
        {t.ending&&<p className="plot-ending">Фінал: {t.ending}</p>}
        {t.last&&<p>{t.last}</p>}
        {t.nextDays!==null&&<small>Наступна глава через {t.nextDays} ігрових днів</small>}
       </article>):<p className="plot-none">Перший сюжет відкриється на початку кар’єри.</p>}
     </div>
     <div className="plot-next"><strong>НАСТУПНІ СЮЖЕТИ</strong>
       <p>{plots.nextUnlocked.length?plots.nextUnlocked.join(' · '):'Усі основні історії вже відкрито'}</p>
     </div>
    </details>
    <details className="memory-details"><summary>ПАМ’ЯТЬ ПЕРСОНАЖІВ <span>{mem.promises.length} обіцянок · {mem.consequences} майбутніх наслідків</span></summary>
      <div className="memory-actors">
      {mem.actors.filter(a=>a.id==='coach'||a.id==='agent'||a.id==='captain'||a.id.startsWith('partner:')).map(a=>
        <div className="memory-actor" key={a.id}>
          <div><b>{a.label}</b><span>Довіра {a.trust}% · Образа {a.resentment}%</span></div>
          <p>{a.last}</p>
        </div>)}
      </div>
      {mem.promises.length>0&&<div className="memory-promises"><strong>НЕВИКОНАНІ ОБІЦЯНКИ</strong>{mem.promises.map(p=><p key={p.id}>{p.label}: {p.text}</p>)}</div>}
      <div className="memory-access"><span>Тренер: {mem.access.selection}</span><span>Агент: {mem.access.agentStatus}</span></div>
    </details>
    <details className="adult-details">
      <summary>ОСОБИСТЕ ЖИТТЯ 21+ <span>{adult.choices} рішень · Ризик чуток {Math.round(adult.privacyRisk)}%</span></summary>
      {adult.active?
      <div className="adult-overview">
       <strong>{adult.active.name}, {adult.active.age} · {({acquaintance:'Знайомство',relationship:'Стосунки',living:'Спільне життя',married:'Шлюб'})[adult.active.stage]||'Особисте життя'}</strong>
       <div className="adult-meters">
        <span>Довіра <b>{Math.round(adult.active.trust)}%</b></span>
        <span>Близькість <b>{Math.round(adult.active.bond)}%</b></span>
        <span>Комфорт <b>{Math.round(adult.active.values.intimacyComfort)}%</b></span>
        <span>Особисті межі <b>{Math.round(adult.active.values.sharedBoundaries)}%</b></span>
        <span>Підтримка роботи <b>{Math.round(adult.active.values.workSupported)}%</b></span>
        <span>Напруга <b>{Math.round(adult.active.tension)}%</b></span>
       </div>
       <p>Стосунки залежать від взаємної згоди, чесності, свободи та кар’єрних рішень обох людей.</p>
      </div>:
      <p className="adult-empty">Зараз ти вільний. Нове знайомство може змінити твій світ.</p>}
      <div className="adult-history">
       {adult.history.map((h,i)=><div key={i}><small>Ігровий день {h.day}</small><p>{h.text}</p></div>)}
      </div>
     </details>
    <details className="npc-details">
      <summary>ЖИВИЙ СВІТ <span>{world.news.length} останніх дій NPC</span></summary>
      <div className="npc-characters">
        {world.people.filter(p=>p.role==='coach'||p.role==='agent'||p.role==='captain'||p.role==='rival'||(p.role==='social'&&p.id==='social:'+world.partner)).map(p=>
         <article className="npc-person" key={p.id}>
          <div><b>{p.name}</b><small>{({coach:'Тренер',agent:'Агент',captain:'Капітан',rival:'Конкурент',social:'Партнер'})[p.role]||p.role} · {p.age} років</small></div>
          <p>Мета: {({ 'league-success':'Результат команди','higher-fees':'Вигідні контракти','dressing-room':'Єдність команди','starting-eleven':'Потрапити до основи','architecture':'Архітектурна кар’єра','music':'Музична кар’єра','business':'Власний бізнес','creative-work':'Творча кар’єра'})[p.goal]||p.goal}</p>
          <span>{p.last?'Остання дія: '+p.last:'Поки планує наступні кроки'}</span>
         </article>)}
      </div>
      <div className="npc-news">{world.news.slice(0,7).map((entry,i)=><div key={i}><small>Ігровий день {entry.day}</small><p>{entry.text}</p></div>)}</div>
    </details>
    <div className="journal-scroll">{s.journal?.length?s.journal.map((entry,i)=><article key={i}><small>{entry.day}</small><b>{entry.choice}</b><p>{entry.outcome}</p></article>):<p>Перше рішення ще попереду.</p>}</div>
    <p className="journal-note">Рішення можуть мати наслідки через кілька ігрових днів. Усі романтичні персонажі — дорослі 21+.</p>
  </motion.section>
 </motion.div>;
}
function SwipeCard({scene,onChoice}){
 const x=useMotionValue(0);
 const rotate=useTransform(x,[-310,0,310],[-11,0,11]);
 const scale=useTransform(x,[-250,0,250],[1.035,1,1.035]);
 const left=useTransform(x,[-210,-45,0],[1,.04,0]);
 const right=useTransform(x,[0,45,210],[0,.04,1]);
 const lock=useRef(false);
 const kind=toneFor(scene);
 const artwork=artForScene(scene,kind);
 const choose=useCallback(side=>{
  if(lock.current)return;
  lock.current=true;
  navigator.vibrate?.(15);
  const distance=side===0?-Math.max(window.innerWidth,450):Math.max(window.innerWidth,450);
  animate(x,distance,{duration:.22,ease:'easeIn'}).then(()=>{
    const accepted=onChoice(side);
    if(accepted===false)animate(x,0,{type:'spring',stiffness:400,damping:32}).then(()=>{lock.current=false;});
  });
 },[x,onChoice]);
 const endDrag=(_event,info)=>{
  if(info.offset.x< -98||info.velocity.x< -720)choose(0);
  else if(info.offset.x>98||info.velocity.x>720)choose(1);
  else animate(x,0,{type:'spring',stiffness:430,damping:31});
 };
 return <motion.div className={'scene-card tone-'+kind} drag="x" dragConstraints={{left:0,right:0}} dragElastic={.86} dragMomentum={false} onDragEnd={endDrag}
   style={{x,rotate,scale}} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.94}} transition={{duration:.2}}>
   <Artwork kind={kind} match={scene.id==='match'}/>
   <div className={'scene-photo scene-photo-'+kind+' scene-art-'+artwork} aria-hidden="true">
     <img src={artUrl(artwork)} alt="" draggable={false} loading="eager" decoding="async"/>
   </div>
   <motion.div className="drag-choice left" style={{opacity:left}}><span>← ОБРАНО</span><b>{scene.a.label}</b></motion.div>
   <motion.div className="drag-choice right" style={{opacity:right}}><span>ОБРАНО →</span><b>{scene.b.label}</b></motion.div>
   <div className="scenario-copy">
     {scene.plot&&<div className="plot-chapter"><span>{scene.plot.phase}</span>
       <b>{scene.plot.name} · {scene.plot.chapter}/{scene.plot.total}</b>
     </div>}
     <div className="scenario-tag">{scene.tag}<span>21+</span></div><h1>{scene.title}</h1><p className={scene.major?'long':''}>{scene.text}</p></div>
 </motion.div>;
}
function Controls({game,scene,onChoice}){
 const match=scene.id==='match',step=match?(game.match?.turns||0):game.story.step,maximum=match?12:4;
 return <div className="controls">
  <div className="progress"><span>{match?'МАТЧ':'ТВІЙ ДЕНЬ'}</span><div><i style={{width:Math.min(100,step/maximum*100)+'%'}}/></div><b>{Math.min(maximum,step+1)} / {maximum}</b></div>
  <div className="meters"><Meter label="ЕНЕРГІЯ" value={game.energy}/><Meter label="РЕПУТАЦІЯ" value={game.reputation}/><Meter label="ДОВІРА" value={game.personal.personId?game.personal.trust:game.story.clubTrust}/><Meter label="СТРЕС" value={game.stress} warn/></div>
  <div className="swipe-instructions"><span>← ПРОВЕДИ ЛІВОРУЧ</span><span>ПРОВЕДИ ПРАВОРУЧ →</span></div>
  <div className="choices">
   <button className="choice choice-left" onClick={()=>onChoice(0)} aria-label={'Вибрати '+scene.a.label}><span>←</span><strong>{scene.a.label}</strong><small>{scene.a.sub}</small></button>
   <button className="choice choice-right" onClick={()=>onChoice(1)} aria-label={'Вибрати '+scene.b.label}><span>→</span><strong>{scene.b.label}</strong><small>{scene.b.sub}</small></button>
  </div>
 </div>;
}

function ChoiceOutcome({outcome,onContinue}){
 const {changes,delayed,plot}=outcome;
 return <motion.div className="choice-outcome-overlay" role="dialog" aria-modal="true" aria-label="Результат твого рішення"
  initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.18}}>
  <motion.div className="choice-outcome-sheet" initial={{y:32,scale:.96}} animate={{y:0,scale:1}}
   exit={{y:18,opacity:0}} transition={{type:'spring',stiffness:340,damping:30}}>
   <div className="outcome-kicker">РЕЗУЛЬТАТ ВИБОРУ</div>
   {plot&&<div className="outcome-story">{plot.name} · Розділ {plot.chapter}/{plot.total}</div>}
   <p className="outcome-situation">{outcome.context}</p>
   <h2>{outcome.choice}</h2>
   <div className="outcome-main">{outcome.message}</div>
   <section className="outcome-section" aria-label="Зміни показників">
    <h3>Що змінилося</h3>
    {changes.length?
     <div className="outcome-effects">{changes.map(effect=><div className={'outcome-effect '+(effect.impact>0?'benefit':effect.impact<0?'cost':'neutral')} key={effect.key}>
       <span>{effect.label}</span><b>{effect.value}</b>
      </div>)}</div>:
      <p className="outcome-empty">Зараз основні показники не змінилися.</p>}
    {outcome.totalChanges>changes.length&&<small className="outcome-more">Ще {outcome.totalChanges-changes.length} змін у журналі персонажа.</small>}
   </section>
   <section className="outcome-section" aria-label="Майбутні наслідки">
    <h3>Що буде далі</h3>
    {delayed.length?
      <div className="outcome-future">{delayed.map((a,i)=><div key={i}><span>{a.label}</span>
       <b>{a.days===0?'Незабаром':a.days===1?'Через 1 день':'Через '+a.days+' дн.'}</b>
      </div>)}</div>:
      <p className="outcome-empty">Нових відкладених подій поки не заплановано. Попередні рішення залишаються в історії.</p>}
    {plot?.ending&&<div className="outcome-verdict">Підсумок сюжету: <strong>{plot.ending}</strong></div>}
   </section>
   <button className="outcome-continue" type="button" onClick={onContinue}>
     ДАЛІ ДО ІСТОРІЇ <span>→</span>
   </button>
   <p className="outcome-auto">Наступна картка відкриється автоматично.</p>
   <div className="outcome-timer" aria-hidden="true"><i/></div>
  </motion.div>
 </motion.div>;
}

function StartMenu({saved,onContinue,onNew}){
 const exists=!!saved;
 const club=saved&&CLUB_BY_ID[saved.clubId];
 return <div className="start-menu">
  <div className="start-atmosphere" aria-hidden="true"><img src={HERO_ART} alt="" className="menu-cover-image" draggable={false}/><div className="menu-spotlight"/><div className="menu-field"><i/><i/><i/></div></div>
  <div className="start-content">
   <div className="menu-heading"><span className="menu-overline">FOOTBALL / LIFE / 21+</span><div className="menu-brand">FL<span>·</span></div>
    <h1>Твоя кар’єра.<br/><em>Твої наслідки.</em></h1>
    <p>Футбол, близькі люди, великі рішення. Дві сторони кожної історії.</p>
   </div>
   <div className="menu-actions">
    {exists&&<div className="save-card"><small>ЗБЕРЕЖЕНА КАР’ЄРА</small><b>{saved.name} · {club?.name||'Клуб'}</b>
      <span>Сезон {saved.season} · Тиждень {saved.week} · {saved.age} років</span>
      <span>Матчів {saved.career?.matches??0} · Капітал {formatCash(saved.money||0)}</span></div>}
    <button className="menu-primary" onClick={onContinue} disabled={!exists}>ПРОДОВЖИТИ <span>→</span></button>
    <button className="menu-secondary" onClick={onNew}>НОВА КАР’ЄРА <span>＋</span></button>
    <small className="menu-footnote">{exists?'Нова кар’єра замінить сейв тільки після підтвердження.':'Збереження ще немає. Створи футболіста, щоб розпочати.'}</small>
   </div>
  </div>
 </div>;
}
function Setup({onStart,onBack,hasSave}){
 const [name,setName]=useState('Алекс'),[position,setPosition]=useState('ST'),[clubId,setClubId]=useState(CLUBS[0].id);
 const [confirm,setConfirm]=useState(false);
 const submit=e=>{e.preventDefault();if(hasSave){setConfirm(true);return;}onStart({name,position,clubId});};
 return <div className="setup">
  <div className="setup-hero"><button className="setup-back" type="button" onClick={onBack}>← МЕНЮ</button>
   <span>НОВА КАР’ЄРА / 21+</span><div className="setup-logo">FL<b>·</b></div>
   <h1>Створи свого<br/>футболіста.</h1>
   <p>Розпочни нову історію. Твої рішення змінюватимуть футбольне й особисте життя.</p>
  </div>
  <form className="setup-form" onSubmit={submit}>
   <label>ІМ’Я ФУТБОЛІСТА<input value={name} onChange={e=>setName(e.target.value)} required maxLength={24}/></label>
   <label>АМПЛУА<select value={position} onChange={e=>setPosition(e.target.value)}>{POSITIONS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>ПЕРШИЙ КЛУБ<select value={clubId} onChange={e=>setClubId(e.target.value)}>{CLUBS.slice(0,4).map(c=><option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}</select></label>
   <button type="submit">РОЗПОЧАТИ КАР’ЄРУ →</button>
   <small>{hasSave?'Поточна кар’єра поки збережена. Для заміни потрібне підтвердження.':'Усі романтичні персонажі 21+. Без дітей. Прогрес зберігається на цьому пристрої.'}</small>
  </form>
  {confirm&&<div className="replace-shade" role="dialog" aria-modal="true" aria-label="Підтвердити нову кар’єру">
    <div className="replace-dialog"><span>УВАГА</span><h2>Почати заново?</h2>
      <p>Нова кар’єра замінить поточний сейв на цьому пристрої. Цю дію неможливо скасувати.</p>
      <button type="button" className="replace-confirm" onClick={()=>{setConfirm(false);onStart({name,position,clubId});}}>ТАК, ПОЧАТИ ЗАНОВО</button>
      <button type="button" className="replace-cancel" onClick={()=>setConfirm(false)}>СКАСУВАТИ</button>
    </div>
   </div>}
 </div>;
}
export default function App(){
 const [savedCareer,setSavedCareer]=useState(getSaved);
 const [game,setGame]=useState(null);
 const [screen,setScreen]=useState('menu');
 const [revision,setRevision]=useState(0);
 const [journal,setJournal]=useState(false);
 const [notice,setNotice]=useState('');
 const [outcome,setOutcome]=useState(null);
 const timeout=useRef(null);
 const lastChoice=useRef(0);
 const scene=useMemo(()=>game?getScene(game):null,[game,revision]);
 // getScene advances autonomous plans by in-game days; persist them even if
 // the player closes the PWA before making the next decision.
 useEffect(()=>{if(game&&scene)saveGame(game);},[game,revision,scene]);
 const sceneKey=game&&scene?[game.season,game.week,game.day,game.story?.step,game.match?.turns||0,scene.id,revision].join('-'):'intro';
 const flash=useCallback(message=>{setNotice(message);clearTimeout(timeout.current);timeout.current=setTimeout(()=>setNotice(''),2100);},[]);
 useEffect(()=>{
   if(!outcome)return;
   const id=setTimeout(()=>setOutcome(null),6200);
   return()=>clearTimeout(id);
 },[outcome]);
 const decide=useCallback(side=>{
  if(!game||journal||outcome)return false;
  if(performance.now()-lastChoice.current<280)return false;
  try{
    const shownScene=scene;
    const before=captureOutcomeState(game);
    const result=takeChoice(game,side);
    if(result.ok){
     lastChoice.current=performance.now();
     const summary=describeChoiceOutcome(before,game,shownScene,side,result);
     saveGame(game);
     setGame({...game});setRevision(n=>n+1);
     setNotice('');setOutcome(summary);
     return true;
    }
    flash(result.message||'Зараз це рішення недоступне.');return false;
  }catch(error){console.error(error);flash('Не вдалося завершити вибір. Спробуй ще раз.');return false;}
 },[game,journal,outcome,scene,flash]);
 useEffect(()=>{
  const onKey=e=>{
   if(e.target instanceof Element&&e.target.closest('input,select,textarea'))return;
   if(journal||!game||outcome)return;
   if(e.key==='ArrowLeft'){e.preventDefault();decide(0);}
   if(e.key==='ArrowRight'){e.preventDefault();decide(1);}
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[decide,game,journal,outcome]);
 useEffect(()=>()=>clearTimeout(timeout.current),[]);
 const continueCareer=()=>{
   const old=loadGame()||savedCareer;
   if(!old){setScreen('create');return;}
   setGame(old);setJournal(false);setNotice('');setOutcome(null);
   setScreen('play');setRevision(n=>n+1);
 };
 const newCareer=values=>{
   const created=makeCareer(values);
   saveGame(created);
   setSavedCareer(created);setGame(created);
   setJournal(false);setNotice('');setOutcome(null);setScreen('play');setRevision(n=>n+1);
 };
 if(screen==='menu')return <StartMenu saved={savedCareer} onContinue={continueCareer} onNew={()=>setScreen('create')}/>;
 if(screen==='create')return <Setup hasSave={!!savedCareer} onBack={()=>setScreen('menu')} onStart={newCareer}/>;
 if(!game)return <StartMenu saved={savedCareer} onContinue={continueCareer} onNew={()=>setScreen('create')}/>;
 return <div className={'app-shell tone-'+toneFor(scene)}>
  <Header game={game} onJournal={()=>setJournal(true)} onMenu={()=>{saveGame(game);setSavedCareer(game);setJournal(false);setOutcome(null);setGame(null);setScreen('menu');}}/>
  <main className="stage">
   <div className="stack" aria-hidden="true"><div/><div/></div>
   <AnimatePresence mode="wait"><SwipeCard key={sceneKey} scene={scene} onChoice={decide}/></AnimatePresence>
  </main>
  <Controls game={game} scene={scene} onChoice={decide}/>
  <AnimatePresence>{notice&&<motion.div className="notice" key={notice} role="status" initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>{notice}</motion.div>}</AnimatePresence>
  <AnimatePresence>{journal&&<Journal game={game} onClose={()=>setJournal(false)}/>}</AnimatePresence>
  <AnimatePresence>{outcome&&<ChoiceOutcome key={outcome.context+'-'+outcome.choice+'-'+revision} outcome={outcome} onContinue={()=>setOutcome(null)}/>}</AnimatePresence>
 </div>;
}
