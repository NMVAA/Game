import {CLUBS,POSITIONS,CLUB_BY_ID,formatCash} from './data.js';
import {loadGame,saveGame,gameClock,scorePlayer} from './engine.js';
import {ensureStory,makeCareer,getScene,takeChoice} from './story.js';

const app=document.getElementById('app');
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const pct=n=>Math.max(0,Math.min(100,Math.round(n||0)));
let game=loadGame(),busy=false,notice='',history=false,gesture=null;
if(game)ensureStory(game);
const visual={
 training:{icon:'◈',shade:'pitch'},'training-rest':{icon:'✦',shade:'pitch'},
 match:{icon:'⚽',shade:'pitch'},waiting:{icon:'⚽',shade:'pitch'},
 meet:{icon:'♡',shade:'romance'},date:{icon:'♡',shade:'romance'},intimacy:{icon:'✧',shade:'romance'},
 travel:{icon:'✈',shade:'romance'},jealousy:{icon:'◉',shade:'romance'},fight:{icon:'♡',shade:'danger'},
 commit:{icon:'♡',shade:'romance'},moveIn:{icon:'⌂',shade:'romance'},wedding:{icon:'◇',shade:'romance'},
 coach:{icon:'♟',shade:'pitch'},captain:{icon:'♟',shade:'pitch'},mentor:{icon:'♟',shade:'pitch'},
 offer:{icon:'⇄',shade:'gold'},agentDeal:{icon:'⇄',shade:'gold'},agentLeak:{icon:'☷',shade:'danger'},
 sponsor:{icon:'✦',shade:'gold'},sponsorIntro:{icon:'✦',shade:'gold'},interview:{icon:'◉',shade:'gold'},
 photo:{icon:'!',shade:'danger'},partnerDoubt:{icon:'!',shade:'danger'},rehab:{icon:'✚',shade:'danger'},
 investment:{icon:'€',shade:'gold'},nightlife:{icon:'☾',shade:'night'},recovery:{icon:'☾',shade:'night'},
 publicity:{icon:'◉',shade:'night'},public:{icon:'!',shade:'danger'},move:{icon:'⌂',shade:'romance'}
};
function pitchSvg(){
 return '<svg class="field-svg" viewBox="0 0 360 220" aria-hidden="true">'+
 '<rect x="15" y="14" width="330" height="192" rx="2" fill="none" stroke="#dcefd5" stroke-opacity=".55" stroke-width="2"/>'+
 '<path d="M180 14V206" stroke="#dcefd5" stroke-opacity=".55" stroke-width="2"/>'+
 '<circle cx="180" cy="110" r="30" fill="none" stroke="#dcefd5" stroke-opacity=".55" stroke-width="2"/>'+
 '<path d="M15 63H65V157H15M345 63H295V157H345" stroke="#dcefd5" stroke-opacity=".55" stroke-width="2" fill="none"/>'+
 '<circle cx="180" cy="110" r="3" fill="#dcefd5"/>'+
 '</svg>';
}
function header(){
 const c=CLUB_BY_ID[game.clubId];
 return '<header class="head"><div class="brand">FL<span>·</span><div><b>'+esc(c.name)+'</b><small>'+esc(gameClock(game))+'</small></div></div><div class="head-actions"><span class="balance">'+formatCash(game.money)+'</span><button class="journal-open" id="journal-open" aria-label="Історія рішень">☷</button></div></header>';
}
function stats(){
 const s=game.story;
 return '<div class="metrics" aria-label="Стан персонажа">'+
  '<div class="metric"><span>ЕНЕРГІЯ</span><b>'+pct(game.energy)+'%</b><i><em style="width:'+pct(game.energy)+'%"></em></i></div>'+
  '<div class="metric"><span>РЕПУТАЦІЯ</span><b>'+pct(game.reputation)+'%</b><i><em style="width:'+pct(game.reputation)+'%"></em></i></div>'+
  '<div class="metric"><span>ДОВІРА</span><b>'+pct(game.personal.personId?game.personal.trust:s.clubTrust)+'%</b><i><em style="width:'+pct(game.personal.personId?game.personal.trust:s.clubTrust)+'%"></em></i></div>'+
  '<div class="metric"><span>СТРЕС</span><b>'+pct(game.stress)+'%</b><i class="hot"><em style="width:'+pct(game.stress)+'%"></em></i></div>'+
 '</div>';
}
function progress(s){
 const idx=s.id==='match'?(game.match?.turns||0):Math.min(3,game.story.step);
 const max=s.id==='match'?12:4;
 return '<div class="story-progress"><div class="progress-label"><span>'+esc(s.id==='match'?'МАТЧ':'ТВІЙ ДЕНЬ')+'</span><span>'+(idx+1)+' / '+max+'</span></div>'+
 '<div class="progress-track"><i style="width:'+pct(idx/max*100)+'%"></i></div></div>';
}
function sceneHtml(){
 const s=getScene(game),v=visual[s.id]||{icon:'✦',shade:'gold'};
 const isMatch=s.id==='match';
 const longDesc=s.text.trim().split(/\s+/).length>20;
 return '<div class="game-shell theme-'+esc(v.shade)+'">'+header()+
 '<main class="story-screen" id="scene" aria-label="Ситуація та два рішення">'+
 '<div class="scene-stage"><div class="scene-noise"></div><div class="scene-visual '+(isMatch?'is-match':'')+'">'+
 (isMatch?pitchSvg():'<span class="illustration-glyph" aria-hidden="true">'+esc(v.icon)+'</span>')+
 '<span class="visual-ring ring-one"></span><span class="visual-ring ring-two"></span></div>'+
 '<div class="story-title"><div class="story-eyebrow">'+esc(s.tag)+' <span class="age-chip">21+</span></div>'+
 '<h1>'+esc(s.title)+'</h1><p class="scene-description '+(longDesc?'major':'')+'">'+esc(s.text)+'</p></div></div>'+
 '<div class="choice-area">'+progress(s)+stats()+
 '<div class="swipe-hint" aria-hidden="true"><span>← СВАЙП ЛІВОРУЧ</span><span>СВАЙП ПРАВОРУЧ →</span></div>'+
 '<div class="choice-grid"><button class="decision left" data-choice="0" aria-label="Перший вибір: '+esc(s.a.label)+'"><span class="direction">←</span><strong>'+esc(s.a.label)+'</strong><small>'+esc(s.a.sub)+'</small></button>'+
 '<button class="decision right" data-choice="1" aria-label="Другий вибір: '+esc(s.b.label)+'"><span class="direction">→</span><strong>'+esc(s.b.label)+'</strong><small>'+esc(s.b.sub)+'</small></button></div>'+
 '</div></main>'+
 (notice?'<div class="outcome" role="status">'+esc(notice)+'</div>':'')+
 (history?journalHtml():'')+'</div>';
}
function journalHtml(){
 const s=game.story,j=s.journal||[];
 return '<div class="journal-shade" id="journal-shade"><section class="journal" role="dialog" aria-modal="true" aria-label="Щоденник кар’єри">'+
 '<div class="journal-head"><div><small>ІСТОРІЯ</small><h2>Наслідки рішень</h2></div><button id="journal-close" aria-label="Закрити">×</button></div>'+
 '<div class="journal-facts"><span>Кар’єра: '+game.career.matches+' матчів</span><span>Рейтинг: '+scorePlayer(game)+'</span><span>Репутація: '+pct(game.reputation)+'</span><span>Агент: '+pct(s.agentTrust)+'</span><span>Клуб: '+pct(s.clubTrust)+'</span><span>Розголос: '+pct(s.scandal)+'</span></div>'+
 '<div class="journal-events">'+(j.length?j.map(x=>'<article><small>'+esc(x.day)+'</small><b>'+esc(x.choice)+'</b><p>'+esc(x.outcome)+'</p></article>').join(''):'<p>Твоя історія лише починається.</p>')+'</div>'+
 '<p class="journal-notice">Рішення можуть проявитися через кілька ігрових днів. Персонажі та клуби вигадані; усім партнерам 21+.</p>'+
 '</section></div>';
}
function welcome(){
 return '<div class="setup"><div class="setup-top"><span>21+ / ORIGINAL FOOTBALL RPG</span><div class="setup-hero">FL<span>·</span></div><h1>Твоя гра.<br>Твої наслідки.</h1><p>Футбольна кар’єра, сексуальні стосунки, інтриги й ризики. Вибирай напрямок свайпом.</p></div>'+
 '<form id="setup-form" class="setup-form"><label>Ім’я футболіста<input name="name" value="Алекс" maxlength="24" required></label>'+
 '<label>Позиція<select name="position">'+POSITIONS.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label>'+
 '<label>Перший клуб<select name="clubId">'+CLUBS.slice(0,4).map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('')+'</select></label>'+
 '<button type="submit">ПОЧАТИ ІСТОРІЮ →</button>'+
 '<small>Усі романтичні персонажі 21+. Без дітей. Інтимні події без відвертих сцен. Збереження на телефоні.</small></form></div>';
}
function render(){
 if(!game){app.innerHTML=welcome();return;}
 app.innerHTML=sceneHtml();
}
function decide(side){
 if(busy||history||!game)return;
 busy=true;
 try{
  const r=takeChoice(game,side);
  if(!r.ok){notice=r.message;render();busy=false;return;}
  saveGame(game);notice=r.message||'Твоє рішення змінить майбутнє.';
  // Immediately advance to the next chapter. Outcome remains visible briefly.
  render();
 }catch(error){
  console.error(error);notice='Ситуація не відкрилася. Спробуй перезавантажити сторінку.';render();
 }finally{busy=false;}
}
app.addEventListener('submit',e=>{
 if(e.target.id!=='setup-form')return;
 e.preventDefault();const data=new FormData(e.target);
 game=makeCareer({name:data.get('name'),position:data.get('position'),clubId:data.get('clubId')});
 saveGame(game);notice='Кар’єру розпочато. Кожен вибір має наслідки.';render();
});
app.addEventListener('click',e=>{
 if(e.target.closest('#journal-open')){history=true;render();return;}
 if(e.target.closest('#journal-close')||e.target.id==='journal-shade'){history=false;render();return;}
 const button=e.target.closest('[data-choice]');
 if(button)decide(Number(button.dataset.choice));
});
document.addEventListener('keydown',e=>{
 if(!game||history)return;
 if(e.target.matches('input,select,textarea'))return;
 if(e.key==='ArrowLeft'){e.preventDefault();decide(0);}
 if(e.key==='ArrowRight'){e.preventDefault();decide(1);}
});
app.addEventListener('pointerdown',e=>{
 const stage=e.target.closest('.story-screen');
 if(!stage||e.target.closest('button')||history||!game)return;
 gesture={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now()};
},{passive:true});
app.addEventListener('pointerup',e=>{
 if(!gesture||e.pointerId!==gesture.id)return;
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,elapsed=performance.now()-gesture.t;
 gesture=null;
 if(elapsed>1300||Math.abs(dx)<60||Math.abs(dx)<Math.abs(dy)*1.3)return;
 decide(dx<0?0:1);
},{passive:true});
app.addEventListener('pointercancel',()=>gesture=null);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game)saveGame(game);});
window.addEventListener('pagehide',()=>{if(game)saveGame(game);});
render();
