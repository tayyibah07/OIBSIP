/* ═══════════════════════════
   STATE
═══════════════════════════ */
let tasks    = JSON.parse(localStorage.getItem('tf-tasks')    || '[]');
let achData  = JSON.parse(localStorage.getItem('tf-ach')      || '{}');
let weekData = JSON.parse(localStorage.getItem('tf-week')     || '{}');
let streak   = parseInt(localStorage.getItem('tf-streak')     || '0');
let lastDate = localStorage.getItem('tf-lastdate') || '';

let activeFilter = 'all';
let activeCat    = 'all';
let editId       = null;
let dragSrcId    = null;

// Pomodoro
let pomoMin = 25, pomoSec = 0, pomoRunning = false, pomoTimer = null;
let pomoMode = 'focus'; // focus | break
let pomoCycles = 0;

// Ambient
let ambCtx = null, ambNodes = {};

/* ═══════════════════════════
   QUOTES
═══════════════════════════ */
const QUOTES = [
  {t:"The secret of getting ahead is getting started.",a:"Mark Twain"},
  {t:"It always seems impossible until it's done.",a:"Nelson Mandela"},
  {t:"Focus on being productive instead of busy.",a:"Tim Ferriss"},
  {t:"Done is better than perfect.",a:"Sheryl Sandberg"},
  {t:"You don't have to be great to start, but you have to start to be great.",a:"Zig Ziglar"},
  {t:"Productivity is never an accident.",a:"Paul J. Meyer"},
  {t:"Action is the foundational key to all success.",a:"Pablo Picasso"},
  {t:"Either you run the day or the day runs you.",a:"Jim Rohn"},
  {t:"Small steps every day lead to big results.",a:"Anonymous"},
  {t:"The best time to plant a tree was 20 years ago. The second best time is now.",a:"Proverb"},
];

/* ═══════════════════════════
   AI HINT SUGGESTIONS
═══════════════════════════ */
const AI_RULES = [
  {kw:['exam','study','quiz','assignment','homework'],pri:'high',time:'2–3 hours'},
  {kw:['meeting','report','deadline','client','project'],pri:'high',time:'1–2 hours'},
  {kw:['gym','run','exercise','workout','walk'],pri:'medium',time:'45–60 min'},
  {kw:['read','book','article','research'],pri:'medium',time:'30–60 min'},
  {kw:['email','reply','message','call'],pri:'medium',time:'15–30 min'},
  {kw:['clean','cook','laundry','grocery','shop'],pri:'low',time:'30–45 min'},
  {kw:['relax','rest','nap','break','watch'],pri:'low',time:'Variable'},
];

function aiHint(){
  const val = document.getElementById('task-input').value.toLowerCase();
  const el  = document.getElementById('ai-txt');
  if(!val){el.textContent='Type a task to get smart suggestions.';return;}
  for(const r of AI_RULES){
    if(r.kw.some(k=>val.includes(k))){
      el.innerHTML=`Suggested priority: <b style="color:var(--purple)">${r.pri}</b> · Est. time: <b style="color:var(--cyan)">${r.time}</b>`;
      document.getElementById('sel-priority').value=r.pri;
      return;
    }
  }
  el.textContent='Ready to add — choose priority and due date.';
}

/* ═══════════════════════════
   INIT
═══════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('hdr-date').textContent =
    new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  updateStreak();
  renderAll();
  renderQuote();
  renderChart();
  spawnParticles();
  checkAchievements();

  document.getElementById('task-input').addEventListener('keydown',e=>{ if(e.key==='Enter') addTask(); });
  document.getElementById('modal-input').addEventListener('keydown',e=>{ if(e.key==='Enter') saveEdit(); if(e.key==='Escape') closeModal(); });

  // ripple on buttons
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('mousemove',e=>{
      const r=btn.getBoundingClientRect();
      btn.style.setProperty('--rx',((e.clientX-r.left)/r.width*100)+'%');
      btn.style.setProperty('--ry',((e.clientY-r.top)/r.height*100)+'%');
    });
  });
});

/* ═══════════════════════════
   STREAK
═══════════════════════════ */
function updateStreak(){
  const today = new Date().toDateString();
  if(lastDate === today) return;
  const yesterday = new Date(Date.now()-86400000).toDateString();
  if(lastDate === yesterday && tasks.some(t=>t.done)){
    streak++;
  } else if(lastDate !== today){
    streak = tasks.some(t=>t.done) ? Math.max(streak,1) : 0;
  }
  lastDate = today;
  localStorage.setItem('tf-streak', streak);
  localStorage.setItem('tf-lastdate', today);
}

/* ═══════════════════════════
   ADD
═══════════════════════════ */
function addTask(){
  const inp = document.getElementById('task-input');
  const txt = inp.value.trim();
  if(!txt){showToast('Enter a task first ✨');inp.focus();return;}

  const task={
    id:Date.now(), text:txt,
    priority: document.getElementById('sel-priority').value,
    category: document.getElementById('sel-category').value,
    due: document.getElementById('sel-due').value,
    done:false, fav:false,
    addedAt:new Date().toISOString(), completedAt:null
  };

  tasks.unshift(task);
  save(); renderAll();
  inp.value='';
  document.getElementById('ai-txt').textContent='Type a task to get smart suggestions.';
  inp.focus();

  // record weekly
  const dayKey = new Date().toISOString().slice(0,10);
  weekData[dayKey] = (weekData[dayKey]||0) + 0; // task added, completions tracked separately
  localStorage.setItem('tf-week', JSON.stringify(weekData));
  renderChart();
  checkAchievements();
  showToast('Task added! Keep going 🚀');
}

/* ═══════════════════════════
   TOGGLE
═══════════════════════════ */
function toggleTask(id){
  const t=tasks.find(t=>t.id===id);
  if(!t)return;
  t.done=!t.done;
  t.completedAt=t.done?new Date().toISOString():null;

  if(t.done){
    const dayKey=new Date().toISOString().slice(0,10);
    weekData[dayKey]=(weekData[dayKey]||0)+1;
    localStorage.setItem('tf-week',JSON.stringify(weekData));
    renderChart();
    renderQuote(); // new quote on completion
    showToast('Task crushed! 💪');
  } else {
    showToast('Moved back to pending');
  }

  updateStreak();
  save(); renderAll(); checkAchievements();
}

/* ═══════════════════════════
   FAVOURITE
═══════════════════════════ */
function toggleFav(id){
  const t=tasks.find(t=>t.id===id);
  if(!t)return;
  t.fav=!t.fav;
  save(); renderAll();
  showToast(t.fav?'⭐ Starred!':'Removed from starred');
}

/* ═══════════════════════════
   DELETE
═══════════════════════════ */
function deleteTask(id){
  tasks=tasks.filter(t=>t.id!==id);
  save(); renderAll(); checkAchievements();
  showToast('Task deleted');
}

/* ═══════════════════════════
   EDIT
═══════════════════════════ */
function openEdit(id){
  const t=tasks.find(t=>t.id===id);
  if(!t)return;
  editId=id;
  document.getElementById('modal-input').value=t.text;
  document.getElementById('overlay').classList.add('active');
  setTimeout(()=>document.getElementById('modal-input').focus(),120);
}
function saveEdit(){
  const txt=document.getElementById('modal-input').value.trim();
  if(!txt){showToast('Task cannot be empty');return;}
  const t=tasks.find(t=>t.id===editId);
  if(t){t.text=txt;save();renderAll();showToast('Task updated ✦');}
  closeModal();
}
function closeModal(){
  document.getElementById('overlay').classList.remove('active');
  editId=null;
}

/* ═══════════════════════════
   CLEAR DONE
═══════════════════════════ */
function clearDone(){
  tasks=tasks.filter(t=>!t.done);
  save();renderAll();showToast('Cleared completed tasks');
}

/* ═══════════════════════════
   FILTER / SEARCH / CAT
═══════════════════════════ */
function setFilter(f,btn){
  activeFilter=f;
  document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
}
function setCatFilter(c,btn){
  activeCat=c;
  document.querySelectorAll('.cftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAll();
}
function onSearch(){
  const v=document.getElementById('search-input').value;
  document.getElementById('search-clear').classList.toggle('vis',v.length>0);
  renderAll();
}
function clearSearch(){
  document.getElementById('search-input').value='';
  document.getElementById('search-clear').classList.remove('vis');
  renderAll();
}
function getQuery(){ return document.getElementById('search-input').value.trim().toLowerCase(); }

/* ═══════════════════════════
   RENDER
═══════════════════════════ */
function save(){ localStorage.setItem('tf-tasks',JSON.stringify(tasks)); }

function renderAll(){
  const q=getQuery();

  let list=tasks.filter(t=>{
    const matchQ=!q||t.text.toLowerCase().includes(q);
    const matchC=activeCat==='all'||t.category===activeCat;
    let   matchF=true;
    if(activeFilter==='active')    matchF=!t.done;
    if(activeFilter==='completed') matchF= t.done;
    return matchQ&&matchC&&matchF;
  });

  const pending  = list.filter(t=>!t.done);
  const done     = list.filter(t=> t.done);

  renderList('list-pending','empty-pending',pending,q);
  renderList('list-done',   'empty-done',   done,   q);

  const totP=tasks.filter(t=>!t.done).length;
  const totD=tasks.filter(t=> t.done).length;
  document.getElementById('cnt-p').textContent=totP;
  document.getElementById('cnt-c').textContent=totD;
  document.getElementById('s-total').textContent=tasks.length;
  document.getElementById('s-done').textContent=totD;
  document.getElementById('s-pend').textContent=totP;
  document.getElementById('s-streak').textContent=streak;
  document.getElementById('streak-txt').textContent=`${streak} day streak`;

  const pct=tasks.length?Math.round(totD/tasks.length*100):0;
  document.getElementById('ring-pct').textContent=pct+'%';
  const circ=251.2, off=circ*(1-pct/100);
  document.getElementById('ring-fill').style.strokeDashoffset=off;

  const msgs=[
    'Start adding tasks to track your progress!',
    'Good start — keep going!',
    'Halfway there, you\'re on fire! 🔥',
    'Incredible focus — almost there!',
    'Perfect score! You\'re unstoppable! 🏆'
  ];
  document.getElementById('prod-msg').textContent=msgs[Math.min(Math.floor(pct/25),4)];

  const clearBtn=document.getElementById('btn-clear');
  clearBtn.style.display=tasks.some(t=>t.done)?'block':'none';

  checkAchievements();
}

function fmt(iso){
  return new Date(iso).toLocaleString('en-IN',{
    day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:true
  });
}

function isDue(due){
  if(!due)return false;
  return new Date(due)<new Date();
}

function priClass(p){
  if(p==='high')   return 'pri-high';
  if(p==='medium') return 'pri-med';
  return 'pri-low';
}
function priEmoji(p){
  if(p==='high')   return '🔴 High';
  if(p==='medium') return '🟡 Medium';
  return '🟢 Low';
}
const catEmoji={work:'💼',study:'📚',personal:'👤',health:'💪',other:'✦'};

function hl(text,q){
  if(!q) return esc(text);
  return esc(text).replace(new RegExp(`(${escRe(esc(q))})`, 'gi'),'<mark>$1</mark>');
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function escRe(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

function renderList(listId, emptyId, items, q){
  const ul=document.getElementById(listId);
  const em=document.getElementById(emptyId);
  Array.from(ul.children).forEach(c=>{if(c!==em)c.remove();});

  if(!items.length){em.style.display='flex';return;}
  em.style.display='none';

  items.forEach(task=>{
    const li=document.createElement('li');
    li.className='titem'+(task.done?' done':'');
    li.dataset.id=task.id;
    li.draggable=true;

    const overdue = !task.done && isDue(task.due);

    li.innerHTML=`
      <span class="drag-h" title="Drag">⠿</span>
      <input type="checkbox" class="tcheck" ${task.done?'checked':''} onchange="toggleTask(${task.id})" />
      <div class="tbody">
        <div class="task-txt">${hl(task.text,q)}</div>
        <div class="tmeta">
          <span class="mpill ${priClass(task.priority)}">${priEmoji(task.priority)}</span>
          <span class="mpill">${catEmoji[task.category]||'✦'} ${task.category}</span>
          ${task.due?`<span class="mpill ${overdue?'overdue':''}">📅 ${task.due}${overdue?' · Overdue':''}</span>`:''}
          ${task.fav?'<span class="mpill">⭐ Starred</span>':''}
          <span class="mpill">🕐 ${fmt(task.addedAt)}</span>
          ${task.completedAt?`<span class="mpill">✅ ${fmt(task.completedAt)}</span>`:''}
        </div>
      </div>
      <div class="tactions">
        <button class="btn btn-icon fav" onclick="toggleFav(${task.id})" title="Star">⭐</button>
        <button class="btn btn-icon edit" onclick="openEdit(${task.id})" title="Edit">✎</button>
        <button class="btn btn-icon del" onclick="deleteTask(${task.id})" title="Delete">✕</button>
      </div>
    `;

    li.addEventListener('dragstart', onDragStart);
    li.addEventListener('dragover',  onDragOver);
    li.addEventListener('dragleave', onDragLeave);
    li.addEventListener('drop',      onDrop);
    li.addEventListener('dragend',   onDragEnd);

    ul.appendChild(li);
  });
}

/* ═══════════════════════════
   DRAG & DROP
═══════════════════════════ */
function onDragStart(e){
  dragSrcId=parseInt(this.dataset.id);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
}
function onDragOver(e){
  e.preventDefault();
  document.querySelectorAll('.titem').forEach(el=>el.classList.remove('drag-over'));
  if(parseInt(this.dataset.id)!==dragSrcId) this.classList.add('drag-over');
}
function onDragLeave(){ this.classList.remove('drag-over'); }
function onDrop(e){
  e.stopPropagation();
  const tgtId=parseInt(this.dataset.id);
  if(dragSrcId===tgtId)return;
  const src=tasks.find(t=>t.id===dragSrcId);
  const tgt=tasks.find(t=>t.id===tgtId);
  if(!src||!tgt||src.done!==tgt.done)return;
  const si=tasks.indexOf(src), ti=tasks.indexOf(tgt);
  tasks.splice(si,1); tasks.splice(ti,0,src);
  save(); renderAll(); showToast('Reordered ✦');
}
function onDragEnd(){
  document.querySelectorAll('.titem').forEach(el=>el.classList.remove('dragging','drag-over'));
  dragSrcId=null;
}

/* ═══════════════════════════
   ACHIEVEMENTS
═══════════════════════════ */
function checkAchievements(){
  const done=tasks.filter(t=>t.done).length;
  const unlock=(id,cond,msg)=>{
    if(cond&&!achData[id]){
      achData[id]=true;
      localStorage.setItem('tf-ach',JSON.stringify(achData));
      showToast('🏆 Achievement: '+msg);
    }
    if(achData[id]) document.getElementById('badge-'+id)?.classList.add('unlocked');
  };
  unlock('first', tasks.length>=1,          'First Task!');
  unlock('10',    done>=10,                  '10 Tasks Done!');
  unlock('master',done>=25,                  'Productivity Master!');
  unlock('streak',streak>=7,                 '7-Day Streak!');
  unlock('100',   done>=100,                 'Century Club!');
  unlock('speed', tasks.some(t=>t.done && t.completedAt &&
    (new Date(t.completedAt)-new Date(t.addedAt))<300000), 'Speed Run!');
}

/* ═══════════════════════════
   MOOD THEMES
═══════════════════════════ */
function setMood(mood, btn){
  document.body.className='mood-'+mood;
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  showToast({creative:'🎨 Creative mode',focus:'🎯 Focus mode',calm:'🌿 Calm mode',happy:'☀️ Happy mode'}[mood]);
}

/* ═══════════════════════════
   QUOTES
═══════════════════════════ */
function renderQuote(){
  const q=QUOTES[Math.floor(Math.random()*QUOTES.length)];
  document.getElementById('quote-txt').textContent=q.t;
  document.getElementById('quote-author').textContent='— '+q.a;
}

/* ═══════════════════════════
   POMODORO
═══════════════════════════ */
function togglePomo(){
  if(pomoRunning){
    clearInterval(pomoTimer); pomoRunning=false;
    document.getElementById('pomo-btn').textContent='▶ Start';
    showToast('Timer paused');
  } else {
    pomoRunning=true;
    document.getElementById('pomo-btn').textContent='⏸ Pause';
    pomoTimer=setInterval(tickPomo,1000);
    showToast(pomoMode==='focus'?'Focus session started 🎯':'Break time ☕');
  }
}
function tickPomo(){
  if(pomoSec>0){ pomoSec--; }
  else if(pomoMin>0){ pomoMin--; pomoSec=59; }
  else {
    clearInterval(pomoTimer); pomoRunning=false;
    document.getElementById('pomo-btn').textContent='▶ Start';
    pomoCycles++;
    if(pomoMode==='focus'){
      pomoMode='break'; pomoMin=pomoCycles%4===0?15:5; pomoSec=0;
      document.getElementById('pomo-label').textContent=pomoCycles%4===0?'Long Break':'Short Break';
      showToast('Focus done! Take a break 🎉');
    } else {
      pomoMode='focus'; pomoMin=25; pomoSec=0;
      document.getElementById('pomo-label').textContent='Focus Session';
      showToast('Break over — back to focus! 🚀');
    }
  }
  document.getElementById('pomo-display').textContent=
    String(pomoMin).padStart(2,'0')+':'+String(pomoSec).padStart(2,'0');
}
function resetPomo(){
  clearInterval(pomoTimer); pomoRunning=false;
  pomoMin=25; pomoSec=0; pomoMode='focus';
  document.getElementById('pomo-display').textContent='25:00';
  document.getElementById('pomo-label').textContent='Focus Session';
  document.getElementById('pomo-btn').textContent='▶ Start';
}
function skipPomo(){
  clearInterval(pomoTimer); pomoRunning=false;
  pomoMin=pomoMode==='focus'?5:25; pomoSec=0;
  pomoMode=pomoMode==='focus'?'break':'focus';
  document.getElementById('pomo-display').textContent=String(pomoMin).padStart(2,'0')+':00';
  document.getElementById('pomo-label').textContent=pomoMode==='focus'?'Focus Session':'Short Break';
  document.getElementById('pomo-btn').textContent='▶ Start';
}

/* ═══════════════════════════
   AMBIENT (Web Audio)
═══════════════════════════ */
let activeAmb=null;
function toggleAmb(type, btn){
  document.querySelectorAll('.amb-btn').forEach(b=>b.classList.remove('active'));
  if(activeAmb===type){ stopAmb(); activeAmb=null; return; }
  stopAmb(); startAmb(type); activeAmb=type;
  btn.classList.add('active');
}
function stopAmb(){
  if(ambCtx){ ambNodes.gain?.gain.setTargetAtTime(0,ambCtx.currentTime,.5);
    setTimeout(()=>{ ambNodes.src?.stop(); ambCtx?.close(); ambCtx=null; ambNodes={}; },600); }
}
function startAmb(type){
  try{
    ambCtx=new(window.AudioContext||window.webkitAudioContext)();
    const g=ambCtx.createGain(); g.gain.setValueAtTime(0,ambCtx.currentTime);
    g.gain.linearRampToValueAtTime(.3,ambCtx.currentTime+1);
    g.connect(ambCtx.destination);
    ambNodes.gain=g;
    const buf=ambCtx.createBuffer(1,ambCtx.sampleRate*3,ambCtx.sampleRate);
    const data=buf.getChannelData(0);
    if(type==='rain'){
      for(let i=0;i<data.length;i++) data[i]=Math.random()*2-1;
    } else if(type==='forest'){
      for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.4+Math.sin(i*.002)*.3;
    } else {
      for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*.25;
    }
    const src=ambCtx.createBufferSource(); src.buffer=buf; src.loop=true;
    src.connect(g); src.start();
    ambNodes.src=src;
    showToast({rain:'🌧 Rain sounds on',forest:'🌲 Forest sounds on',coffee:'☕ Café sounds on'}[type]);
  }catch(e){showToast('Audio not available');}
}

/* ═══════════════════════════
   WEEKLY CHART
═══════════════════════════ */
function renderChart(){
  const wrap=document.getElementById('weekly-chart');
  wrap.innerHTML='';
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today=new Date(); const max=Math.max(...Object.values(weekData),1);
  for(let i=6;i>=0;i--){
    const d=new Date(today); d.setDate(d.getDate()-i);
    const key=d.toISOString().slice(0,10);
    const val=weekData[key]||0;
    const h=Math.round((val/max)*100);
    const div=document.createElement('div');
    div.className='bar-wrap';
    div.innerHTML=`<span class="bar-val">${val||''}</span><div class="bar" style="height:${Math.max(h,4)}%"></div><span class="bar-day">${days[d.getDay()]}</span>`;
    wrap.appendChild(div);
  }
}

/* ═══════════════════════════
   PARTICLES
═══════════════════════════ */
function spawnParticles(){
  const container=document.getElementById('particles');
  const colors=['#A855F7','#06B6D4','#EC4899','#7C3AED'];
  for(let i=0;i<28;i++){
    const p=document.createElement('div');
    p.className='particle';
    const size=Math.random()*6+2;
    p.style.cssText=`
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${10+Math.random()*20}s;
      animation-delay:${Math.random()*20}s;
      filter:blur(${Math.random()*1.5}px);
    `;
    container.appendChild(p);
  }
}

/* ═══════════════════════════
   HELPERS
═══════════════════════════ */
function focusAdd(){
  document.getElementById('task-input').focus();
  window.scrollTo({top:0,behavior:'smooth'});
}

let toastT;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT);
  toastT=setTimeout(()=>t.classList.remove('show'),2600);
}