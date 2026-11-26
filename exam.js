/* =====================================================================
   Exam-style (Bluebook-like) view for Practice Set MCQs, Vocabulary MCQ
   and True / False. Overrides renderPractice, renderMCQ and renderTF from
   the page's own script; everything else on the page is unchanged.
   ===================================================================== */
(function(){
const LET=["A","B","C","D","E"];
const PACE={practice:72,mcq:30,tf:20};          // seconds per question when "exam pace" is on
const TITLE={practice:"Practice Set",mcq:"Vocabulary",tf:"True or False"};
const BB={mode:null,qs:[],idx:0,ans:[],marked:new Set(),elim:{},elimOn:false,each:false,
  t:{left:0,up:0,h:null,hidden:false,paced:true,timeUp:false},view:"q"};
window.BB=BB;

const ICON={
  bookmark:'<svg viewBox="0 0 16 20" aria-hidden="true"><path d="M2 1.5h12v17l-6-4.5-6 4.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  caret:'<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  exit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  flag:'<svg class="bb-flag" viewBox="0 0 12 15" aria-hidden="true"><path d="M1 1h10v13l-5-3.5L1 14z" fill="#c2331f"/></svg>'
};

function opt(name){const el=document.querySelector('input[name="'+name+'"]:checked');return el?el.value:null;}
function settings(){
  BB.each=(opt("bbFeedback")==="each");
  const pace=document.getElementById("bbPace");BB.t.paced=pace?pace.checked:true;
}

/* ---------- build the question list once, so Back / Next are stable ---------- */
function build(mode){
  if(mode==="practice"){
    return S.practice.map(function(q){return {stem:q.q.replace(/\n/g,"<br>"),opts:q.opts.slice(),answer:q.answer,skill:q.skill,logStem:q.q.replace(/\n/g," ")};});
  }
  if(mode==="mcq"){
    return S.terms.map(function(cur){
      const o=shuffle([cur].concat(shuffle(S.terms.filter(function(t){return t!==cur;})).slice(0,3)));
      return {stem:'<span class="bb-label">Definition</span>'+cur.def,ask:"Which term matches this definition?",
        opts:o.map(function(t){return t.term;}),answer:o.indexOf(cur),logStem:cur.def};
    });
  }
  return S.terms.map(function(cur){
    const isTrue=Math.random()>0.5;let disp=cur.def;
    if(!isTrue&&S.terms.length>1){let w;do{w=S.terms[Math.floor(Math.random()*S.terms.length)];}while(w.term===cur.term);disp=w.def;}
    return {stem:'Is this the correct definition of <strong>'+cur.term+'</strong>?<span class="bb-quote">"'+disp+'"</span>',
      opts:["True","False"],answer:isTrue?0:1,logStem:'"'+disp+'" - definition of '+cur.term+'?'};
  });
}

function start(mode){
  settings();
  BB.mode=mode;BB.qs=build(mode);BB.idx=0;BB.ans=BB.qs.map(function(){return null;});
  BB.marked=new Set();BB.elim={};BB.elimOn=false;BB.view="q";BB.reviewing=false;BB.t.timeUp=false;BB.t.hidden=false;
  BB.t.left=BB.qs.length*PACE[mode];BB.t.up=0;
  shell();tick(true);
  clearInterval(BB.t.h);BB.t.h=setInterval(tick,1000);
  render();
}

/* ---------- shell ---------- */
function shell(){
  let el=document.getElementById("bbShell");
  if(!el){el=document.createElement("div");el.id="bbShell";el.className="bb-shell";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");document.body.appendChild(el);}
  const unit=(document.querySelector(".bb-crumb")||{}).textContent||"";
  el.innerHTML=
   '<div class="bb-head"><div><div class="bb-sec">'+TITLE[BB.mode]+(S.topic!=="all"?' &middot; Topic '+S.topic:'')+'</div>'+
     '<button class="bb-dir" id="bbDirBtn" aria-expanded="false">Directions &#9662;</button></div>'+
   '<div class="bb-timer" id="bbTimer"><div class="t" id="bbTime" aria-live="off">0:00</div><button id="bbHide">Hide</button></div>'+
   '<div class="bb-tools"><button class="bb-tool" id="bbExit">'+ICON.exit+'Exit</button></div></div>'+
   '<div class="bb-dash"></div><div id="bbBanner"></div>'+
   '<div class="bb-body" id="bbBody"></div>'+
   '<div class="bb-dash"></div>'+
   '<div class="bb-foot"><div class="bb-who">'+unit+'</div>'+
   '<button class="bb-qmenu" id="bbMenu" aria-expanded="false"></button>'+
   '<div class="bb-nav"><button class="bb-btn" id="bbBack">Back</button><button class="bb-btn" id="bbNext">Next</button></div></div>';
  document.body.style.overflow="hidden";
  el.querySelector("#bbHide").onclick=function(){BB.t.hidden=!BB.t.hidden;this.textContent=BB.t.hidden?"Show":"Hide";tick(true);};
  el.querySelector("#bbExit").onclick=exit;
  el.querySelector("#bbDirBtn").onclick=toggleDirections;
  el.querySelector("#bbMenu").onclick=toggleMenu;
  el.querySelector("#bbBack").onclick=function(){if(BB.view==="review"){BB.view="q";BB.idx=BB.qs.length-1;}else if(BB.idx>0)BB.idx--;render();};
  el.querySelector("#bbNext").onclick=function(){
    if(BB.view==="review"||BB.reviewing){submit();return;}
    if(BB.view==="result")return;
    if(BB.idx<BB.qs.length-1){BB.idx++;render();}else{BB.view="review";render();}
  };
}
function exit(){clearInterval(BB.t.h);const el=document.getElementById("bbShell");if(el)el.remove();document.body.style.overflow="";}
function fmt(s){s=Math.max(0,s);const m=Math.floor(s/60),x=s%60;return m+":"+(x<10?"0":"")+x;}
function tick(redrawOnly){
  if(!redrawOnly&&BB.view!=="result"){
    if(BB.t.paced){BB.t.left--;if(BB.t.left<=0&&!BB.t.timeUp){BB.t.timeUp=true;BB.t.left=0;
      document.getElementById("bbBanner").innerHTML='<div class="bb-banner">Time is up. Check your work, then submit.</div>';BB.view="review";render();}}
    else BB.t.up++;
  }
  const el=document.getElementById("bbTime");if(!el)return;
  el.textContent=BB.t.paced?fmt(BB.t.left):fmt(BB.t.up);
  el.classList.toggle("hidden-time",BB.t.hidden&&!(BB.t.paced&&BB.t.left<=300));
  document.getElementById("bbTimer").classList.toggle("warn",BB.t.paced&&BB.t.left<=300);
}
function toggleDirections(){
  const ex=document.getElementById("bbDirPop");const btn=document.getElementById("bbDirBtn");
  if(ex){ex.remove();btn.setAttribute("aria-expanded","false");return;}
  const p=document.createElement("div");p.id="bbDirPop";p.className="bb-dirpop";
  p.innerHTML='<h3>Directions</h3><p>Each question has one best answer. Use <strong>Mark for Review</strong> to flag a question to come back to, and the crossed-out <strong>ABC</strong> button to cross out choices you have ruled out.</p>'+
    '<p style="margin-top:8px;">'+(BB.each?'You will see whether you were right as soon as you choose an answer.':'Answers are revealed only after you submit, just like the real exam.')+
    (BB.t.paced?' The timer is set to exam pace ('+PACE[BB.mode]+' seconds per question).':'')+'</p><button class="bb-btn">Close</button>';
  p.querySelector("button").onclick=toggleDirections;
  document.getElementById("bbShell").appendChild(p);btn.setAttribute("aria-expanded","true");
}

/* ---------- question menu ---------- */
function cells(mode){
  return BB.qs.map(function(q,i){
    let cls="bb-cell";
    if(mode==="result"||(mode==="menu"&&BB.reviewing)){cls+=BB.ans[i]===q.answer?" got":" miss";}
    else if(BB.ans[i]!==null)cls+=" answered";
    if(mode==="menu"&&i===BB.idx&&BB.view==="q")cls+=" cur";
    return '<button class="'+cls+'" data-go="'+i+'" aria-label="Question '+(i+1)+(BB.marked.has(i)?', marked for review':'')+'">'+(i+1)+(BB.marked.has(i)?ICON.flag:'')+'</button>';
  }).join("");
}
function legend(){return '<div class="bb-legend"><span>&#9660; Current</span><span><i style="display:inline-block;width:14px;height:14px;border:1.5px dashed #1e1e1e"></i> Unanswered</span><span><i style="display:inline-block;width:14px;height:14px;background:#2f4fbf"></i> Answered</span><span>'+ICON.flag.replace('class="bb-flag"','style="width:11px;height:14px"')+' For Review</span></div>';}
function toggleMenu(){
  const ex=document.getElementById("bbPop");const btn=document.getElementById("bbMenu");
  if(ex){ex.remove();btn.setAttribute("aria-expanded","false");return;}
  const p=document.createElement("div");p.id="bbPop";p.className="bb-pop";
  p.innerHTML='<h3>'+TITLE[BB.mode]+' Questions</h3>'+legend()+'<div class="bb-grid">'+cells("menu")+'</div><button class="bb-btn ghost bb-gotoreview">Go to Review Page</button>';
  p.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){BB.idx=+this.dataset.go;BB.view="q";toggleMenu();render();};});
  p.querySelector(".bb-gotoreview").onclick=function(){BB.view="review";toggleMenu();render();};
  document.querySelector(".bb-foot").appendChild(p);btn.setAttribute("aria-expanded","true");
}

/* ---------- views ---------- */
function render(){
  const pop=document.getElementById("bbPop");if(pop)pop.remove();
  const menu=document.getElementById("bbMenu");const back=document.getElementById("bbBack");const next=document.getElementById("bbNext");
  if(BB.view==="q"){
    menu.style.visibility="visible";menu.innerHTML='Question '+(BB.idx+1)+' of '+BB.qs.length+' '+ICON.caret;
    back.style.visibility=BB.idx>0?"visible":"hidden";next.textContent=BB.reviewing?"Results":"Next";next.style.visibility="visible";
    renderQ();
  } else if(BB.view==="review"){
    menu.style.visibility="hidden";back.style.visibility=BB.t.timeUp?"hidden":"visible";next.textContent="Submit";next.style.visibility="visible";
    const blank=BB.ans.filter(function(a){return a===null;}).length;
    document.getElementById("bbBody").innerHTML='<div class="bb-review"><h2>Check Your Work</h2>'+
      '<p>On test day, you will not be able to move on to the next module until time expires.</p>'+
      '<p>For these questions, check your work and then select <strong>Submit</strong> to see your results.</p>'+
      (blank?'<p><strong>'+blank+' question'+(blank>1?'s are':' is')+' unanswered.</strong></p>':'')+
      '<div class="bb-box">'+legend().replace('<span>&#9660; Current</span>','')+'<div class="bb-grid">'+cells("review")+'</div></div></div>';
    document.querySelectorAll("#bbBody [data-go]").forEach(function(b){b.onclick=function(){if(BB.t.timeUp)return;BB.idx=+this.dataset.go;BB.view="q";render();};});
  }
  document.getElementById("bbBody").scrollTop=0;
}
function renderQ(){
  const q=BB.qs[BB.idx],i=BB.idx,a=BB.ans[i],locked=(BB.each&&a!==null)||BB.reviewing,el=BB.elim[i]||new Set();
  let opts=q.opts.map(function(o,k){
    let cls="bb-opt",tag="";
    if(locked){if(k===q.answer){cls+=" right";tag='<span class="bb-tag">&#10003; Correct answer</span>';}else if(k===a){cls+=" wrong";tag='<span class="bb-tag">&#10007; Your answer</span>';}}
    else if(k===a)cls+=" sel";
    if(el.has(k)&&!locked)cls+=" elim";
    let side="";
    if(BB.elimOn&&!locked)side=el.has(k)?'<button class="bb-undo" data-undo="'+k+'">Undo</button>':'<button class="bb-strike" data-strike="'+k+'" aria-label="Cross out choice '+LET[k]+'">'+LET[k]+'</button>';
    return '<div class="bb-row"><button class="'+cls+'" data-pick="'+k+'"'+(locked?' disabled':'')+' aria-pressed="'+(k===a)+'"><span class="bb-letter">'+LET[k]+'</span><span class="bb-text">'+o+'</span>'+tag+'</button>'+side+'</div>';
  }).join("");
  document.getElementById("bbBody").innerHTML='<div class="bb-q">'+
    '<div class="bb-qbar"><div class="bb-num">'+(i+1)+'</div>'+
    '<button class="bb-mark'+(BB.marked.has(i)?' on':'')+'" id="bbMark" aria-pressed="'+BB.marked.has(i)+'">'+ICON.bookmark+'Mark for Review</button>'+
    '<button class="bb-elimtoggle'+(BB.elimOn?' on':'')+'" id="bbElim" aria-pressed="'+BB.elimOn+'" title="Cross out answer choices">ABC</button></div>'+
    '<div class="bb-dash"></div>'+
    (q.skill?'<span class="bb-skill">'+q.skill+'</span>':'')+
    '<div class="bb-stem">'+q.stem+'</div>'+(q.ask?'<div class="bb-ask">'+q.ask+'</div>':'')+
    '<div class="bb-opts-list">'+opts+'</div></div>';
  document.getElementById("bbMark").onclick=function(){BB.marked.has(i)?BB.marked.delete(i):BB.marked.add(i);renderQ();};
  document.getElementById("bbElim").onclick=function(){BB.elimOn=!BB.elimOn;renderQ();};
  document.querySelectorAll("[data-pick]").forEach(function(b){b.onclick=function(){
    const k=+this.dataset.pick;if(locked)return;
    if(el.has(k)){el.delete(k);BB.elim[i]=el;}
    BB.ans[i]=(BB.ans[i]===k&&!BB.each)?null:k;renderQ();};});
  document.querySelectorAll("[data-strike]").forEach(function(b){b.onclick=function(){const k=+this.dataset.strike;el.add(k);BB.elim[i]=el;if(BB.ans[i]===k)BB.ans[i]=null;renderQ();};});
  document.querySelectorAll("[data-undo]").forEach(function(b){b.onclick=function(){el.delete(+this.dataset.undo);BB.elim[i]=el;renderQ();};});
}
function submit(){
  clearInterval(BB.t.h);BB.view="result";S.log=[];let score=0;
  BB.qs.forEach(function(q,i){const a=BB.ans[i];const ok=a===q.answer;if(ok)score++;
    logAttempt(TITLE[BB.mode],q.logStem,a===null?"No answer":q.opts[a],q.opts[q.answer],ok);});
  S.score=score;
  const pct=Math.round(score/BB.qs.length*100);
  const msg=pct>=80?"Strong work.":pct>=60?"Getting there. Keep reviewing.":"More revision needed. You have got this.";
  document.getElementById("bbMenu").style.visibility="hidden";
  document.getElementById("bbBack").style.visibility="hidden";document.getElementById("bbNext").style.visibility="hidden";
  document.getElementById("bbBanner").innerHTML="";
  const used=BB.t.paced?(BB.qs.length*PACE[BB.mode]-BB.t.left):BB.t.up;
  document.getElementById("bbBody").innerHTML='<div class="bb-review bb-result"><div class="bb-big">'+pct+'%</div>'+
    '<p style="margin-top:8px;">'+score+' correct out of '+BB.qs.length+' &middot; time used '+fmt(used)+'</p><p><strong>'+msg+'</strong></p>'+
    '<div class="bb-box"><div class="bb-legend"><span><i style="display:inline-block;width:14px;height:14px;background:#1e6e34"></i> Correct</span><span><i style="display:inline-block;width:14px;height:14px;background:#b3261e"></i> Incorrect or blank</span></div><div class="bb-grid">'+cells("result")+'</div></div>'+
    buildReviewBlock()+
    '<div class="bb-actions2"><button class="bb-btn" id="bbAgain">Try a new set</button><button class="bb-btn ghost" id="bbDone">Back to activities</button></div></div>';
  document.querySelectorAll("#bbBody [data-go]").forEach(function(b){b.onclick=function(){BB.idx=+this.dataset.go;BB.reviewing=true;BB.view="q";render();};});
  document.getElementById("bbAgain").onclick=function(){
    if(BB.mode==="practice")S.practice=shuffle(getPractice(S.topic));else S.terms=shuffle(getTerms(S.topic));start(BB.mode);};
  document.getElementById("bbDone").onclick=exit;
}

/* ---------- hook into the page ---------- */
window.renderPractice=function(){start("practice");};
window.renderMCQ=function(){start("mcq");};
window.renderTF=function(){start("tf");};
document.addEventListener("keydown",function(e){if(e.key==="Escape"){const p=document.getElementById("bbPop")||document.getElementById("bbDirPop");if(p){p.remove();}}});
})();
