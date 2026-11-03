import {CLUBS,CLUB_BY_ID,CONTACTS,CONTACT_BY_ID,POSITIONS,TRAINING,ASSETS,formatCash,opponentFor} from './data.js';
import {SAVE_KEY,newGame,loadGame,saveGame,gameClock,scorePlayer,ratingPlayer,standings,currentFixture,nextDay,train,recover,meet,relationshipAction,buyAsset,negotiate,acceptOffer,rejectOffer,beginMatch,matchAction,quickMatch} from './engine.js';

const app=document.getElementById('app');
const html=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const pct=(v)=>Math.max(0,Math.min(100,Number(v)||0));
let game=loadGame(),tab='home',toast='',showHistory=false;
const nav=[['home','⌂','Огляд'],['match','◉','Матч'],['player','♟','Кар’єра'],['market','⇄','Трансфери'],['life','♡','Життя']];
const tags={single:'Без пари',acquaintance:'Знайомство',relationship:'Стосунки',living:'Разом',married:'Шлюб'};
const badge=(text,type='')=>`<span class="badge ${type}">${html(text)}</span>`;
const meter=(label,value,color='mint')=>`<div class="meter"><div class="meter-row"><span>${html(label)}</span><b>${Math.round(value)}%</b></div><div class="meter-track"><i class="${color}" style="width:${pct(value)}%"></i></div></div>`;
const panel=(title,body,more='')=>`<section class="panel"><div class="section-head"><h2>${title}</h2>${more}</div>${body}</section>`;
const button=(action,label,opts={})=>`<button class="btn ${opts.strong?'primary':''} ${opts.ghost?'ghost':''} ${opts.compact?'compact':''}" data-action="${action}" ${opts.id?`data-id="${html(opts.id)}"`:''} ${opts.disabled?'disabled':''}>${label}</button>`;
const clubBadge=(id,big=false)=>{const c=CLUB_BY_ID[id];return `<span class="crest ${big?'large':''}" style="--team:${c.color};--secondary:${c.accent}">${html(c.name.slice(0,1))}</span>`;};
const positionName=id=>POSITIONS.find(p=>p.id===id)?.name||id;
function startScreen(){
  return `<div class="welcome"><div class="welcome-top"><span class="kicker">ФУТБОЛ · ОСОБИСТЕ ЖИТТЯ · 21+</span><h1>FOOTBALL<br><em>LIFE</em></h1><p>Твоя історія починається за межами стадіону. Кожен матч, контракт і стосунки впливають на майбутнє.</p><div class="hero-graphic"><div class="football-rings"><span class="player-symbol">21</span><span class="ball-symbol">⚽</span></div><span>SEASON 2026</span></div></div>
  <form id="create-form" class="create-form">
    <label>Ім’я футболіста<input name="name" maxlength="24" value="Алекс" placeholder="Ім’я" autocomplete="off" required></label>
    <label>Амплуа<select name="position">${POSITIONS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></label>
    <label>Перший клуб<select name="clubId">${CLUBS.slice(0,4).map(c=>`<option value="${c.id}">${c.name} · ${c.city}</option>`).join('')}</select></label>
    <button class="btn primary launch" type="submit">РОЗПОЧАТИ КАР’ЄРУ <span>↗</span></button>
    <p class="fine">Усі романтичні персонажі — дорослі (21+). Без дітей. Світ і клуби вигадані. Прогрес зберігається на пристрої.</p>
  </form></div>`;
}
function heading(){
 const c=CLUB_BY_ID[game.clubId];
 return `<header class="topbar"><div class="logo">FL<span>·</span></div><div class="topcenter"><strong>${html(c.name)}</strong><small>${html(gameClock(game))}</small></div><div class="cash-pill">${formatCash(game.money)}</div></header>`;
}
function subnav(){
 return `<nav class="tabbar" aria-label="Основна навігація">${nav.map(([key,icon,label])=>`<button data-tab="${key}" class="${tab===key?'active':''}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}</nav>`;
}
function overview(){
 const g=game,c=CLUB_BY_ID[g.clubId],op=currentFixture(g),enemy=op&&CLUB_BY_ID[op.home===g.clubId?op.away:op.home];
 return `
 <section class="home-hero">
 <span class="eyebrow">МІЙ ШЛЯХ / ${g.age} РОКІВ</span>
 <div class="hero-name">${html(g.name)}<span>${html(g.position)}</span></div>
 <div class="hero-blurb">Контракт із ${html(c.name)}<br><b>${formatCash(g.contract.wage)}</b> на тиждень · до ${g.contract.until} р.</div>
 <div class="hero-numbers"><div><strong>${scorePlayer(g)}</strong><span>РЕЙТИНГ</span></div><div><strong>${g.reputation}</strong><span>РЕПУТАЦІЯ</span></div><div><strong>${g.seasonStats.goals}</strong><span>ГОЛІВ</span></div></div>
 </section>
 ${panel('Наступний матч',`<div class="fixture"><div class="fixture-team">${clubBadge(op.home)}<span>${html(CLUB_BY_ID[op.home].name)}</span></div><div class="fixture-middle"><b>VS</b><small>ТИЖДЕНЬ ${g.week}</small></div><div class="fixture-team">${clubBadge(op.away)}<span>${html(CLUB_BY_ID[op.away].name)}</span></div></div>
  ${button(g.day===6?'start-match':'next-day',g.day===6?'ВИЙТИ НА ПОЛЕ →':'НАСТУПНИЙ ДЕНЬ →',{strong:true})}
  <p class="fine">${g.day===6?'Неділя · матчевий день':`До матчу: ${6-g.day} дн. · Суперник: ${enemy.name}`}</p>`)}
 <div class="two">${meter('Енергія',g.energy)}${meter('Настрій',g.morale,'gold')}${meter('Форма',g.form)}${meter('Стрес',g.stress,'rose')}</div>
 ${panel('Сьогодні',`<div class="quick-grid">
 ${button('tab-player','⚡ Тренування',{ghost:true})}
 ${button('tab-life','♡ Особисте життя',{ghost:true})}
 ${button('tab-market','⇄ Агент і ринок',{ghost:true})}
 ${button('tab-match','◉ Мій матч',{ghost:true})}
 </div>`)}
 ${panel('Стрічка подій',`<div class="feed">${g.feed.slice(0,6).map((n,i)=>`<div class="feed-item"><span class="feed-dot ${html(n.type)}"></span><div><p>${html(n.text)}</p><small>С${n.season} · Тиждень ${n.week}</small></div></div>`).join('')}</div>`)}
 `;
}
function drawPitch(){
 const canvas=document.getElementById('pitch');if(!canvas)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#173d34';ctx.fillRect(0,0,w,h);
 for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#1e4b3d':'#205041';ctx.fillRect(i*w/9,0,w/9,h);}
 ctx.strokeStyle='rgba(234,255,232,.65)';ctx.lineWidth=3;
 ctx.strokeRect(18,15,w-36,h-30);ctx.beginPath();ctx.moveTo(w/2,15);ctx.lineTo(w/2,h-15);ctx.stroke();
 ctx.beginPath();ctx.arc(w/2,h/2,60,0,Math.PI*2);ctx.stroke();
 ctx.strokeRect(18,h/2-95,95,190);ctx.strokeRect(w-113,h/2-95,95,190);
 const g=game,m=g?.match;const home=CLUB_BY_ID[m?.home||g.clubId],away=CLUB_BY_ID[m?.away||opponentFor(g.clubId,g.week).away];
 const coordsA=[[.1,.5],[.23,.2],[.23,.5],[.23,.8],[.39,.32],[.39,.68],[.49,.46]];
 const coordsB=coordsA.map(([x,y])=>[1-x,y]);
 const circle=(x,y,col,r=9)=>{ctx.beginPath();ctx.fillStyle=col;ctx.arc(x*w,y*h,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#0b241e';ctx.lineWidth=2;ctx.stroke();};
 coordsA.forEach(v=>circle(...v,home.color,9));coordsB.forEach(v=>circle(...v,away.color,9));
 const bx=(m?.ball?.x??50)/100,by=(m?.ball?.y??50)/100;
 ctx.beginPath();ctx.arc(bx*w,by*h,7,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#252f32';ctx.stroke();
 const playerOwnHome=m?m.home===g.clubId:true;const px=playerOwnHome?.42:.58;
 ctx.beginPath();ctx.arc(px*w,.45*h,17,0,Math.PI*2);ctx.strokeStyle='#f9d27e';ctx.lineWidth=5;ctx.stroke();
}
function matchPage(){
 const g=game,m=g.match,fixture=m||currentFixture(g),a=CLUB_BY_ID[fixture.home],b=CLUB_BY_ID[fixture.away];
 const matchDay=g.day===6;
 return `<div class="page-intro"><span class="eyebrow">СЕЗОН ${g.year}/${g.year+1}</span><h1>МАТЧ</h1><p>2D-симуляція · рішення на полі змінюють результат.</p></div>
 <div class="scoreboard"><div>${clubBadge(a.id,true)}<b>${html(a.name)}</b></div><div class="score-center"><strong>${m?m.homeGoals+' : '+m.awayGoals:'– : –'}</strong><span>${m?`${m.minute}′ · ОЦІНКА ${m.rating.toFixed(1)}`:'НАСТУПНА ГРА'}</span></div><div>${clubBadge(b.id,true)}<b>${html(b.name)}</b></div></div>
 <div class="pitch-wrap"><canvas id="pitch" width="680" height="420" aria-label="Схематичний 2D-футбольний матч"></canvas><div class="pitch-watermark">FOOTBALL LIFE · 2D ENGINE</div></div>
 ${m?`<div class="play-actions">
  ${button('match-pass','↗ ПАС',{strong:true})}
  ${button('match-dribble','➜ ДРИБЛІНГ')}
  ${button('match-shoot','◎ УДАР')}
  ${button('match-press','◇ ПРЕСИНГ')}
 </div>${panel('Трансляція',`<div class="commentary">${m.feed.map(s=>`<p>${html(s)}</p>`).join('')}</div>`)}`:
 `<div class="panel kickoff-panel"><h2>${matchDay?'День матчу':'Підготовка до матчу'}</h2><p>${matchDay?'Обирай рішення кожні кілька хвилин. Ти можеш бути героєм зустрічі.':'Матч у неділю. Використай дні для тренувань, побачень і відновлення.'}</p>
 ${button('start-match','ПОЧАТИ МАТЧ',{strong:true,disabled:!matchDay})}
 ${button('quick-match','ШВИДКИЙ РЕЗУЛЬТАТ',{ghost:true,disabled:!matchDay})}
 </div>`}
 ${g.lastResult&&!m?panel('Останній результат',`<div class="result"><strong>${html(g.lastResult.ownScore+':'+g.lastResult.oppScore)}</strong><div><b>Твоя оцінка ${g.lastResult.rating.toFixed(1)}</b><br><span>${g.lastResult.goals} голів · ${g.lastResult.assists} асистів · +${formatCash(g.lastResult.earned)}</span></div></div>`):''}`;
}
function careerPage(){
 const g=game,s=g.seasonStats,rank=standings(g);
 return `<div class="page-intro"><span class="eyebrow">ПРОФЕСІЙНИЙ ФУТБОЛІСТ</span><h1>КАР’ЄРА</h1><p>${html(g.name)} · ${positionName(g.position)} · ${html(CLUB_BY_ID[g.clubId].name)}</p></div>
 <div class="stats-strip"><div><b>${s.matches}</b><small>МАТЧІ</small></div><div><b>${s.goals}</b><small>ГОЛИ</small></div><div><b>${s.assists}</b><small>АСИСТИ</small></div><div><b>${s.matches?(s.ratingSum/s.matches).toFixed(1):'—'}</b><small>ОЦІНКА</small></div></div>
 ${panel('Тренувальний центр',`<p class="section-desc">Одне тренування на день. Кожен вибір витрачає енергію та змінює реальні характеристики.</p>
 <div class="training-list">${TRAINING.map(t=>`<div class="training-item"><div class="skill-icon">${t.icon}</div><div><b>${t.name}</b><small>${t.detail}</small></div><strong>${g.player.skills[t.id]}</strong>${button('train', 'ТРЕНУВАТИ',{compact:true,id:t.id,disabled:g.daily.trained||g.day===6||g.energy<19})}</div>`).join('')}</div>`)}
 ${panel('Турнірна таблиця',`<div class="table-scroll"><table><thead><tr><th>№</th><th>Клуб</th><th>І</th><th>РМ</th><th>О</th></tr></thead><tbody>${rank.map((c,i)=>`<tr class="${c.id===g.clubId?'current':''}"><td>${i+1}</td><td>${html(c.name)}</td><td>${c.played}</td><td>${c.gf-c.ga>0?'+':''}${c.gf-c.ga}</td><td><b>${c.points}</b></td></tr>`).join('')}</tbody></table></div>`)}
 ${panel('Особисті рекорди',`<div class="facts"><span>Усього матчів <b>${g.career.matches}</b></span><span>Голи за кар’єру <b>${g.career.goals}</b></span><span>Кубки <b>${g.career.trophies}</b></span><span>Рівень <b>${ratingPlayer(g)}</b></span></div>`)}
 `;
}
function marketPage(){
 const g=game;
 return `<div class="page-intro"><span class="eyebrow">АГЕНТ / ПЕРЕГОВОРИ</span><h1>ТРАНСФЕРИ</h1><p>Зарплата, бонуси, контракти й конкуренція за твою кар’єру.</p></div>
 <section class="contract-card"><span class="eyebrow">ЧИННИЙ КОНТРАКТ</span><div class="contract-club">${clubBadge(g.clubId)}<h2>${html(CLUB_BY_ID[g.clubId].name)}</h2></div><div class="contract-nums"><div><small>ЗАРПЛАТА / ТИЖДЕНЬ</small><b>${formatCash(g.contract.wage)}</b></div><div><small>ДО КІНЦЯ</small><b>${g.contract.until}</b></div></div></section>
 ${panel(`Пропозиції <small>(${g.offers.length})</small>`,g.offers.length?g.offers.map(o=>`<article class="offer"><div class="offer-top">${clubBadge(o.clubId)}<div><h3>${html(CLUB_BY_ID[o.clubId].name)}</h3><p>${html(CLUB_BY_ID[o.clubId].city)} · до ${o.until} року</p></div>${badge('ІНТЕРЕС','green')}</div><div class="offer-values"><div><span>Зарплата</span><b>${formatCash(o.wage)}</b></div><div><span>Підписний бонус</span><b>${formatCash(o.bonus)}</b></div></div><div class="offer-actions">${button('offer-negotiate','ПЕРЕГОВОРИ',{id:o.id,disabled:o.negotiated})}${button('offer-accept','ПІДПИСАТИ',{id:o.id,strong:true})}${button('offer-reject','×',{id:o.id,compact:true})}</div></article>`).join(''):'<div class="empty"><strong>Наразі немає пропозицій</strong><p>Покращуй форму та репутацію. Агент шукатиме варіанти протягом сезону.</p></div>')}
 ${panel('Думка агента',`<p class="section-desc">«Зосередься на регулярній практиці. Голи, стабільна форма й репутація допоможуть отримати вигідні контракти. Переїзд може вплинути й на особисте життя».</p>`)}
 `;
}
function romance(){
 const r=game.personal,p=CONTACT_BY_ID[r.personId];
 if(!p)return panel('Знайомства · лише 21+',`<p class="section-desc">Особисті історії з дорослими персонажами. Знайомства, вибори, побачення та складні рішення — без дітей.</p><div class="people">${CONTACTS.map(c=>`<article class="person"><div class="person-avatar" style="--person:${c.color}">${c.icon}</div><div><b>${c.name}, ${c.age}</b><small>${c.job} · ${c.vibe}</small></div>${button('meet','ЗНАЙОМИТИСЬ',{compact:true,id:c.id,disabled:game.daily.social||game.day===6})}</article>`).join('')}</div>`);
 return panel(`Стосунки · ${html(p.name)}`,`<div class="partner-hero"><div class="person-avatar giant" style="--person:${p.color}">${p.icon}</div><div><span class="eyebrow">PERSONAL LIFE / ${p.age}+</span><h3>${html(p.name)}</h3><p>${html(p.job)} · ${html(p.vibe)}</p>${badge(tags[r.stage]||r.stage,'green')}</div></div>
 <div class="two">${meter('Близькість',r.bond)}${meter('Довіра',r.trust,'gold')}${meter('Напруга',r.tension,'rose')}</div>
 <div class="action-grid">${button('romance-talk','Щира розмова',{disabled:game.daily.social||game.day===6})}${button('romance-date','Побачення · €180',{disabled:game.daily.social||game.day===6})}${button('romance-surprise','Сюрприз · €250',{disabled:game.daily.social||game.day===6})}${button('romance-trip','Подорож · €700',{disabled:game.daily.social||game.day===6})}</div>
 <div class="relationship-steps">${r.stage==='acquaintance'?button('romance-commit','ЗАПРОПОНУВАТИ СТОСУНКИ',{strong:true,disabled:r.bond<40||r.trust<35}):''}
 ${r.stage==='relationship'?button('romance-live','ЖИТИ РАЗОМ',{strong:true,disabled:r.bond<65||r.trust<50}):''}
 ${r.stage==='living'?button('romance-marry','ЗРОБИТИ ПРОПОЗИЦІЮ',{strong:true,disabled:r.bond<86||r.trust<68}):''}
 ${r.stage==='married'?badge('Ви одружені','green'):''}
 ${button('romance-breakup','ЗАВЕРШИТИ СТОСУНКИ',{ghost:true})}
 </div><p class="fine">Взаємини впливають на настрій і можуть ускладнювати переїзди після трансферів.</p>`);
}
function lifePage(){
 const g=game;
 return `<div class="page-intro"><span class="eyebrow">PERSONAL LIFE / 21+</span><h1>ЖИТТЯ</h1><p>Не лише футбол. Люди, які поруч, і вибори, що залишають слід.</p></div>
 ${romance()}
 ${panel('Вільний час',`<p class="section-desc">Обери одне заняття на день. Вечірки, відновлення й дозвілля впливають на стан перед матчем.</p><div class="action-grid">
 ${button('recover-rest','Відпочити · €0',{disabled:g.daily.lifestyle||g.day===6})}
 ${button('recover-gym','Спа · €50',{disabled:g.daily.lifestyle||g.day===6})}
 ${button('recover-therapy','Психолог · €110',{disabled:g.daily.lifestyle||g.day===6})}
 ${button('recover-party','Вечірка · €340',{disabled:g.daily.lifestyle||g.day===6})}
 </div>`)}
 ${panel('Моя власність',`<div class="asset-list">${ASSETS.map(item=>`<article class="asset"><div><b>${item.name}</b><small>${item.detail}</small></div><div class="asset-buy">${g.assets.includes(item.id)?badge('КУПЛЕНО','green'):button('buy',formatCash(item.price),{id:item.id,compact:true,disabled:g.money<item.price})}</div></article>`).join('')}</div>`)}
 <div class="fine note-box">Це авторська вигадана симуляція дорослого життя. Графічного сексуального контенту немає; романтичні персонажі — 21+.</div>`;
}
function render(){
 if(!game){app.innerHTML=startScreen();return;}
 const views={home:overview,match:matchPage,player:careerPage,market:marketPage,life:lifePage};
 app.innerHTML=`${heading()}<main class="content" id="content">${(views[tab]||overview)()}</main>${subnav()}<div class="toast ${toast?'visible':''}" role="status">${html(toast)}</div>`;
 if(tab==='match')drawPitch();
}
function showMessage(message){
 toast=message;render();
 clearTimeout(showMessage.timeout);
 showMessage.timeout=setTimeout(()=>{toast='';const el=document.querySelector('.toast');if(el){el.classList.remove('visible');el.textContent='';}},3200);
}
function go(t){
 if(!nav.some(x=>x[0]===t))return;
 tab=t;render();document.getElementById('content')?.scrollTo({top:0,behavior:'instant'});
}
app.addEventListener('submit',e=>{
 if(e.target.id!=='create-form')return;
 e.preventDefault();const data=new FormData(e.target);
 game=newGame({name:data.get('name'),position:data.get('position'),clubId:data.get('clubId')});
 saveGame(game);tab='home';showMessage('Кар’єру розпочато. Твоя історія — у твоїх руках.');
});
app.addEventListener('click',e=>{
 const tabEl=e.target.closest('[data-tab]');if(tabEl){go(tabEl.dataset.tab);return;}
 const btn=e.target.closest('[data-action]');if(!btn||btn.disabled||!game)return;
 const a=btn.dataset.action,id=btn.dataset.id;
 if(a.startsWith('tab-')){go(a.slice(4));return;}
 const calls={
 'next-day':()=>nextDay(game),'train':()=>train(game,id),
 'recover-rest':()=>recover(game,'rest'),'recover-gym':()=>recover(game,'gym'),
 'recover-party':()=>recover(game,'party'),'recover-therapy':()=>recover(game,'therapy'),
 'meet':()=>meet(game,id),'romance-talk':()=>relationshipAction(game,'talk'),
 'romance-date':()=>relationshipAction(game,'date'),
 'romance-trip':()=>relationshipAction(game,'trip'),
 'romance-surprise':()=>relationshipAction(game,'surprise'),
 'romance-commit':()=>relationshipAction(game,'commit'),
 'romance-live':()=>relationshipAction(game,'live'),
 'romance-marry':()=>relationshipAction(game,'marry'),
 'romance-breakup':()=>relationshipAction(game,'breakup'),
 'offer-negotiate':()=>negotiate(game,id),'offer-accept':()=>acceptOffer(game,id),
 'offer-reject':()=>rejectOffer(game,id),'buy':()=>buyAsset(game,id),
 'start-match':()=>{const r=beginMatch(game);if(r.ok)tab='match';return r;},
 'quick-match':()=>quickMatch(game),
 'match-pass':()=>matchAction(game,'pass'),
 'match-dribble':()=>matchAction(game,'dribble'),
 'match-shoot':()=>matchAction(game,'shoot'),
 'match-press':()=>matchAction(game,'press')
 };
 const fn=calls[a];if(!fn)return;
 try{const r=fn();saveGame(game);showMessage(r?.message||'Готово');}
 catch(error){console.error(error);showMessage('Виникла помилка. Стан гри збережено.');}
});
render();
