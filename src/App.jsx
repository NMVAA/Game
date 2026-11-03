import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AnimatePresence,animate,motion,useMotionValue,useTransform} from 'motion/react';
import {CLUBS,CLUB_BY_ID,POSITIONS,formatCash} from '../data.js';
import {loadGame,saveGame,gameClock,scorePlayer} from '../engine.js';
import {ensureStory,getScene,makeCareer,takeChoice} from '../story.js';

const clamp=(value)=>Math.max(0,Math.min(100,Number(value)||0));
const kinds={
 training:'stadium','training-rest':'stadium',match:'stadium',waiting:'stadium',captain:'stadium',coach:'stadium',mentor:'stadium',rehab:'stadium',
 offer:'contract',agentDeal:'contract',agentLeak:'contract',sponsor:'contract',sponsorIntro:'contract',investment:'contract',move:'contract',
 meet:'romance',date:'romance',intimacy:'romance',travel:'romance',jealousy:'romance',fight:'romance',commit:'romance',moveIn:'romance',wedding:'romance',partnerDoubt:'romance',secret:'romance',affairExposure:'romance',
 photo:'media',public:'media',publicity:'media',interview:'media',sponsorThreat:'media',nightlife:'night',recovery:'night'
};
const palettes={
 stadium:['#193d31','#b8f56d','#0e271d'],
 contract:['#3b4030','#f4d19a','#172820'],
 romance:['#40314e','#f0b4b9','#1d2135'],
 media:['#263c51','#c0deff','#142231'],
 night:['#20264c','#bdb4ff','#13182e']
};
const toneFor=scene=>kinds[scene?.id]||'contract';
function getSaved(){const game=loadGame();if(game)ensureStory(game);return game;}

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
function Header({game,onJournal}){
 const c=CLUB_BY_ID[game.clubId];
 return <header className="header">
  <div className="brand"><span className="brand-mark">FL<b>·</b></span><div className="club-info"><strong>{c?.name||'Клуб'}</strong><small>{gameClock(game)}</small></div></div>
  <div className="header-actions"><span className="cash">{formatCash(game.money)}</span><button type="button" className="journal-btn" onClick={onJournal} aria-label="Історія рішень">☷</button></div>
 </header>;
}
function Meter({label,value,warn}){
 return <div className="meter"><div><small>{label}</small><b>{Math.round(clamp(value))}%</b></div><i><em style={{width:clamp(value)+'%',background:warn?'#f5a48f':'#b8f56d'}}/></i></div>;
}
function Journal({game,onClose}){
 const s=ensureStory(game);
 return <motion.div className="journal-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
  <motion.section className="journal-panel" role="dialog" aria-modal="true" aria-label="Історія та наслідки" initial={{y:85}} animate={{y:0}} exit={{y:85}} transition={{type:'spring',stiffness:300,damping:28}} onClick={e=>e.stopPropagation()}>
    <div className="journal-title"><div><small>FOOTBALL LIFE</small><h2>Твої наслідки</h2></div><button type="button" onClick={onClose}>✕</button></div>
    <div className="journal-stats"><span>Рейтинг <b>{scorePlayer(game)}</b></span><span>Клуб <b>{Math.round(s.clubTrust)}%</b></span><span>Агент <b>{Math.round(s.agentTrust)}%</b></span><span>Скандали <b>{Math.round(s.scandal)}%</b></span></div>
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
 const choose=useCallback(side=>{
  if(lock.current)return;
  lock.current=true;
  navigator.vibrate?.(15);
  const distance=side===0?-Math.max(window.innerWidth,450):Math.max(window.innerWidth,450);
  animate(x,distance,{duration:.22,ease:'easeIn'}).then(()=>onChoice(side));
 },[x,onChoice]);
 const endDrag=(_event,info)=>{
  if(info.offset.x< -98||info.velocity.x< -720)choose(0);
  else if(info.offset.x>98||info.velocity.x>720)choose(1);
  else animate(x,0,{type:'spring',stiffness:430,damping:31});
 };
 return <motion.div className={'scene-card tone-'+kind} drag="x" dragConstraints={{left:0,right:0}} dragElastic={.86} dragMomentum={false} onDragEnd={endDrag}
   style={{x,rotate,scale}} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.94}} transition={{duration:.2}}>
   <Artwork kind={kind} match={scene.id==='match'}/>
   <motion.div className="drag-choice left" style={{opacity:left}}><span>← ОБРАНО</span><b>{scene.a.label}</b></motion.div>
   <motion.div className="drag-choice right" style={{opacity:right}}><span>ОБРАНО →</span><b>{scene.b.label}</b></motion.div>
   <div className="scenario-copy"><div className="scenario-tag">{scene.tag}<span>21+</span></div><h1>{scene.title}</h1><p className={scene.major?'long':''}>{scene.text}</p></div>
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
function Setup({onStart}){
 const [name,setName]=useState('Алекс'),[position,setPosition]=useState('ST'),[clubId,setClubId]=useState(CLUBS[0].id);
 return <div className="setup"><div className="setup-hero">
  <span>FOOTBALL LIFE / 21+</span><div className="setup-logo">FL<b>·</b></div><h1>Твоя гра.<br/>Твої наслідки.</h1>
  <p>Футбол, кохання, трансфери й інтриги. Кожен свайп змінює майбутнє.</p></div>
  <form className="setup-form" onSubmit={e=>{e.preventDefault();onStart({name,position,clubId});}}>
   <label>ІМ’Я ФУТБОЛІСТА<input value={name} onChange={e=>setName(e.target.value)} required maxLength={24}/></label>
   <label>АМПЛУА<select value={position} onChange={e=>setPosition(e.target.value)}>{POSITIONS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <label>ПЕРШИЙ КЛУБ<select value={clubId} onChange={e=>setClubId(e.target.value)}>{CLUBS.slice(0,4).map(c=><option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}</select></label>
   <button type="submit">ПОЧАТИ ІСТОРІЮ →</button><small>Усі партнери — 21+. Без дітей. Інтимні сцени без графічного зображення. Прогрес зберігається на цьому пристрої.</small>
  </form></div>;
}
export default function App(){
 const [game,setGame]=useState(getSaved);
 const [revision,setRevision]=useState(0);
 const [journal,setJournal]=useState(false);
 const [notice,setNotice]=useState('');
 const timeout=useRef(null);
 const scene=useMemo(()=>game?getScene(game):null,[game,revision]);
 const sceneKey=game&&scene?[game.season,game.week,game.day,game.story?.step,game.match?.turns||0,scene.id,revision].join('-'):'intro';
 const flash=useCallback(message=>{setNotice(message);clearTimeout(timeout.current);timeout.current=setTimeout(()=>setNotice(''),2100);},[]);
 const decide=useCallback(side=>{
  if(!game||journal)return;
  try{
    const result=takeChoice(game,side);
    if(result.ok){
     saveGame(game);setGame({...game});setRevision(n=>n+1);
     flash(result.message||'Рішення прийнято.');
    }else flash(result.message||'Зараз це рішення недоступне.');
  }catch(error){console.error(error);flash('Не вдалося завершити вибір. Спробуй ще раз.');}
 },[game,journal,flash]);
 useEffect(()=>{
  const onKey=e=>{
   if(e.target instanceof Element&&e.target.closest('input,select,textarea'))return;
   if(journal||!game)return;
   if(e.key==='ArrowLeft'){e.preventDefault();decide(0);}
   if(e.key==='ArrowRight'){e.preventDefault();decide(1);}
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[decide,game,journal]);
 useEffect(()=>()=>clearTimeout(timeout.current),[]);
 if(!game)return <Setup onStart={values=>{const g=makeCareer(values);saveGame(g);setGame(g);setRevision(n=>n+1);flash('Твоя історія почалася.');}}/>;
 return <div className={'app-shell tone-'+toneFor(scene)}>
  <Header game={game} onJournal={()=>setJournal(true)}/>
  <main className="stage">
   <div className="stack" aria-hidden="true"><div/><div/></div>
   <AnimatePresence mode="wait"><SwipeCard key={sceneKey} scene={scene} onChoice={decide}/></AnimatePresence>
  </main>
  <Controls game={game} scene={scene} onChoice={decide}/>
  <AnimatePresence>{notice&&<motion.div className="notice" key={notice} role="status" initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}}>{notice}</motion.div>}</AnimatePresence>
  <AnimatePresence>{journal&&<Journal game={game} onClose={()=>setJournal(false)}/>}</AnimatePresence>
 </div>;
}
