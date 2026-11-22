/* App shell: routing, events, wheel, sync wiring, persistence */
(function(G){
"use strict";
const M=G.M,V=G.V,esc=G.esc,TAU=Math.PI*2;
const $=s=>document.querySelector(s);
const app=$("#app");
const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}};
const lsDel=k=>{try{localStorage.removeItem(k);}catch(e){}};

const S={screen:"entry",tab:"party",P:null,isHost:false,joinCode:"",awardSel:null,
  conn:{},sheet:null,me:{id:lsGet("pgc_id")||M.uid(),name:lsGet("pgc_name")||""},
  draft:{name:"Birthday Party",m:2,o:1,r:5,approve:true}};
lsSet("pgc_id",S.me.id);
G.S=S;

let toastT;
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),1900);}

/* ---------- render ---------- */
let spinning=false,rot=0,raf=null;
function render(){
  if(spinning)return;
  app.innerHTML=(V[S.screen]||V.entry)(S);
  if(S.screen==="hdash"&&S.tab==="wheel")drawWheel();
  renderSheet();
}
G.render=render;

/* ---------- persistence ---------- */
function saveHost(){if(S.P)lsSet("pgc_host",JSON.stringify(S.P));}
function savePlayer(){if(S.joinCode)lsSet("pgc_player",JSON.stringify({code:S.joinCode,name:S.me.name}));}
function touch(){if(!S.P)return;S.P.updatedAt=M.now();S.P.v++;saveHost();pushSoon();}
let pt;function pushSoon(){clearTimeout(pt);pt=setTimeout(()=>G.Sync.push(S.P),120);}

/* ---------- sync wiring ---------- */
function hostSync(){
  G.Sync.init({code:S.P.code,isHost:true,me:S.me,
    onStatus:()=>render(),
    onPeers:list=>{
      let ch=false;
      (list||[]).forEach(p=>{
        if(!p||!p.id||p.id===S.me.id)return;
        if(!S.conn[p.id])ch=true;
        S.conn[p.id]=M.now();
        if(p.name)ensureParticipant(p.id,p.name);
      });
      if(ch)render();
    },
    onRequest:r=>{if(r&&r.id&&r.name)ensureParticipant(r.id,r.name);}
  }).then(()=>{render();G.Sync.push(S.P);});
  setInterval(()=>{if(S.P)G.Sync.push(S.P);},3000);
  setInterval(()=>{
    let ch=false;const t=M.now();
    Object.keys(S.conn).forEach(k=>{if(t-S.conn[k]>12000){delete S.conn[k];ch=true;}});
    if(ch&&S.screen!=="hsettings")render();
  },5000);
}
function ensureParticipant(id,name){
  const P=S.P;if(!P)return;
  let p=P.participants.find(x=>x.id===id);
  if(p){if(p.name!==name&&name){p.name=name;touch();render();}return;}
  p={id:id,name:String(name).slice(0,18),status:P.requireApproval?"pending":"admitted",
     teamId:P.requireApproval?null:M.smallestTeam(P),joinedAt:M.now(),admittedAt:null};
  if(!P.requireApproval)p.admittedAt=M.now();
  P.participants.push(p);touch();render();
  toast(P.requireApproval?p.name+" wants to join":p.name+" joined");
}
function playerSync(){
  G.Sync.init({code:S.joinCode,isHost:false,me:S.me,
    onStatus:()=>render(),
    onState:st=>{
      S.P=st;
      const me=st.participants.find(p=>p.id===S.me.id);
      if(me&&me.status==="admitted"){if(S.screen==="pwait")S.screen="pdash";}
      else if(S.screen!=="pwait"&&S.screen!=="pboard")S.screen="pwait";
      if(!spinning)render();
    }
  }).then(ok=>{
    beat();setInterval(beat,3000);
    if(!ok)toast("Can't reach that party from this device");
    render();
  });
}
function beat(){
  G.Sync.beat({id:S.me.id,name:S.me.name,ts:M.now()});
  G.Sync.request({id:S.me.id,name:S.me.name,ts:M.now()});
}

/* ---------- wheel ---------- */
function drawWheel(){
  const cv=$("#cv");if(!cv||!S.P)return;
  const g=cv.getContext("2d"),w=cv.width,c=w/2,R=c-8;
  const games=M.eligibleGames(S.P),n=games.length;
  const wheel=M.activeWheel(S.P);
  g.clearRect(0,0,w,w);
  if(!n){g.fillStyle="#2f2855";g.beginPath();g.arc(c,c,R,0,TAU);g.fill();return;}
  g.save();g.translate(c,c);g.rotate(rot);
  const seg=TAU/n;
  for(let i=0;i<n;i++){
    g.beginPath();g.moveTo(0,0);g.arc(0,0,R,i*seg,(i+1)*seg);g.closePath();
    g.fillStyle=M.PAL[i%M.PAL.length];g.fill();
    g.strokeStyle="rgba(12,9,24,.55)";g.lineWidth=3;g.stroke();
    g.save();g.rotate(i*seg+seg/2);
    g.fillStyle="#16102a";g.textAlign="right";g.textBaseline="middle";
    g.font="800 "+Math.max(17,Math.min(33,36-n*1.1))+"px Outfit, sans-serif";
    let t=games[i].name;if(t.length>16)t=t.slice(0,15)+"…";
    g.fillText(t,R-20,0);g.restore();
  }
  g.restore();
  g.beginPath();g.arc(c,c,R,0,TAU);g.strokeStyle=(wheel&&wheel.color)||"rgba(255,255,255,.2)";
  g.lineWidth=8;g.stroke();
}
function runSpin(sp){
  const cv=$("#cv");if(!cv)return;
  spinning=true;
  const from=rot,to=sp.angle,dur=sp.dur||4200,t0=performance.now();
  cancelAnimationFrame(raf);
  (function step(t){
    const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,4);
    rot=from+(to-from)*e;drawWheel();
    if(k<1)raf=requestAnimationFrame(step);
    else{spinning=false;rot=to%TAU;render();
      try{navigator.vibrate&&navigator.vibrate([40,60,120]);}catch(e){}}
  })(t0);
}
function doSpin(){
  const P=S.P,can=M.canSpin(P);
  if(!can.ok||spinning)return toast(can.why||"Can't spin");
  const games=M.eligibleGames(P),n=games.length;
  const i=Math.floor(Math.random()*n),seg=TAU/n,center=i*seg+seg/2;
  const base=-Math.PI/2-center,d=((base-rot)%TAU+TAU)%TAU;
  const game=games[i];
  const sel=M.recordSpin(P,game);
  P.spin={label:game.name,angle:rot+d+TAU*(5+Math.floor(Math.random()*3)),dur:4200,nonce:M.uid(),selId:sel.id};
  touch();runSpin(P.spin);
}

/* ---------- bottom sheet (quick assign / manage) ---------- */
function renderSheet(){
  let el=$("#sheet");
  if(!el){el=document.createElement("div");el.id="sheet";el.className="sheet";document.body.appendChild(el);}
  if(!S.sheet||!S.P){el.className="sheet";el.innerHTML="";return;}
  const p=S.P.participants.find(x=>x.id===S.sheet.pid);
  if(!p){S.sheet=null;el.className="sheet";el.innerHTML="";return;}
  const isPending=p.status==="pending";
  const chosen=S.sheet.team||p.teamId||M.smallestTeam(S.P);
  let h='<div class="panel"><div class="row" style="margin-bottom:4px"><h2 style="flex:1">'+esc(p.name)+'</h2>'+
    '<button class="iconbtn" id="sheet-x">✕</button></div>'+
    '<p class="tiny" style="margin-bottom:14px">'+(isPending?"Pending admission":"Admitted · "+M.scoreOf(S.P,p.id)+" pts · "+M.gamesPlayed(S.P,p.id)+" games")+'</p>';
  h+='<label>'+(isPending?"Choose a team":"Change team")+'</label>';
  h+=S.P.teams.map(t=>{
    const cnt=M.admitted(S.P).filter(x=>x.teamId===t.id).length;
    return '<button class="teamopt'+(t.id===chosen?" sel":"")+'" data-pickteam="'+t.id+'">'+
      '<span class="dot" style="background:'+t.color+';width:14px;height:14px"></span>'+
      '<span class="nm">'+esc(t.name)+'</span><span class="tiny">'+cnt+' member'+(cnt===1?"":"s")+'</span></button>';
  }).join("");
  if(isPending){
    h+='<button class="btn green" id="sheet-admit">Admit &amp; assign</button>'+
       '<button class="btn ghost" id="sheet-decline">Decline</button>';
  }else{
    const rec=M.recentFor(S.P,p.id,4);
    h+='<button class="btn" id="sheet-save">Save team</button>';
    if(rec.length)h+='<div class="sec">Recent points</div>'+rec.map(e=>
      '<div class="histrow"><span class="r">R'+e.round+'</span><span class="g">'+esc(e.gameName||"Adjustment")+'</span>'+
      '<b>'+(e.pts>0?"+":"")+e.pts+'</b></div>').join("");
    h+='<button class="btn danger" id="sheet-remove" style="margin-top:10px">Remove from party</button>';
  }
  h+='</div>';
  el.innerHTML=h;el.className="sheet on";
}
function closeSheet(){S.sheet=null;renderSheet();}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const b=e.target.closest("button");
  if(!b){if(e.target.id==="sheet")closeSheet();return;}
  const P=S.P;
  const go=b.getAttribute("data-go");
  if(go){S.screen=go;render();return;}
  const tab=b.getAttribute("data-tab");
  if(tab){S.tab=tab;S.screen="hdash";render();return;}
  const id=b.id;

  if(id==="do-create"){
    const nm=($("#c-name").value||"Birthday Party").trim();
    const hn=($("#c-host").value||"Host").trim();
    S.me.name=hn;lsSet("pgc_name",hn);
    const p=M.newParty({name:nm,rounds:Math.max(1,+$("#c-r").value||5),requireApproval:$("#c-ap").checked});
    p.rotation.spins[p.rotation.order[0]]=Math.max(0,+$("#c-m").value||0);
    p.rotation.spins[p.rotation.order[1]]=Math.max(0,+$("#c-1").value||0);
    if(M.perRound(p)<1){toast("Give at least one wheel a spin");return;}
    S.P=p;S.isHost=true;S.screen="hlobby";saveHost();render();hostSync();return;
  }
  if(id==="do-addlocal"){
    const v=($("#l-add").value||"").trim();if(!v)return;
    P.participants.push({id:M.uid(),name:v.slice(0,18),status:"admitted",teamId:M.smallestTeam(P),
      joinedAt:M.now(),admittedAt:M.now()});
    touch();render();return;
  }
  if(id==="do-start"){
    if(!M.admitted(P).length)return toast("Admit a player first");
    P.status=M.STATE.ACTIVE;S.screen="hdash";S.tab="wheel";touch();render();return;
  }
  if(id==="do-pause"){
    P.status=P.status===M.STATE.PAUSED?M.STATE.ACTIVE:M.STATE.PAUSED;touch();render();return;
  }
  if(id==="do-spin"){doSpin();return;}
  if(id==="do-resetscores"){P.scoreLog=[];P.teamLog=[];touch();render();toast("Scores reset");return;}
  if(id==="do-end"){
    P.status=M.STATE.CLOSED;G.Sync.push(P);G.Sync.leave();
    lsDel("pgc_host");S.P=null;S.isHost=false;S.screen="entry";render();return;
  }
  if(id==="do-join"){
    const c=($("#j-code").value||"").trim().toUpperCase();
    const n=($("#j-name").value||"").trim();
    if(c.length<4)return toast("Enter the party code");
    if(!n)return toast("Add your name");
    S.me.name=n;lsSet("pgc_name",n);S.joinCode=c;S.isHost=false;S.screen="pwait";
    savePlayer();render();playerSync();return;
  }
  if(id==="t-add"){
    P.teams.push({id:M.uid(),name:"Team "+(P.teams.length+1),color:M.PAL[P.teams.length%M.PAL.length]});
    touch();render();return;
  }
  if(id==="sheet-x"){closeSheet();return;}
  if(id==="sheet-admit"){
    const p=P.participants.find(x=>x.id===S.sheet.pid);
    if(p){p.status="admitted";p.admittedAt=M.now();p.teamId=S.sheet.team||M.smallestTeam(P);}
    G.Sync.clearRequest(S.sheet.pid);closeSheet();touch();render();toast(p.name+" is in");return;
  }
  if(id==="sheet-decline"){
    const p=P.participants.find(x=>x.id===S.sheet.pid);if(p)p.status="removed";
    G.Sync.clearRequest(S.sheet.pid);closeSheet();touch();render();return;
  }
  if(id==="sheet-save"){
    const p=P.participants.find(x=>x.id===S.sheet.pid);
    if(p&&S.sheet.team)p.teamId=S.sheet.team;
    closeSheet();touch();render();return;
  }
  if(id==="sheet-remove"){
    const p=P.participants.find(x=>x.id===S.sheet.pid);if(p)p.status="removed";
    closeSheet();touch();render();return;
  }

  let k=b.getAttribute("data-admit");
  if(k){S.sheet={pid:k,team:M.smallestTeam(P)};renderSheet();return;}
  k=b.getAttribute("data-decline");
  if(k){const p=P.participants.find(x=>x.id===k);if(p)p.status="removed";touch();render();return;}
  k=b.getAttribute("data-manage");
  if(k){S.sheet={pid:k,team:null};renderSheet();return;}
  k=b.getAttribute("data-pickteam");
  if(k){S.sheet.team=k;renderSheet();return;}
  k=b.getAttribute("data-sel");
  if(k){
    const sel=M.openSelection(P);if(!sel)return;
    if(k==="start")sel.status=M.GS.PLAYING;
    if(k==="done"){sel.status=M.GS.DONE;P.spin=null;}
    if(k==="skip"){sel.status=M.GS.SKIPPED;P.spin=null;}
    if(P.progress.done&&k!=="start"){P.status=M.STATE.COMPLETED;S.screen="hsummary";}
    touch();render();return;
  }
  k=b.getAttribute("data-aw");
  if(k){
    const selEl=$("#a-sel"),sid=selEl?selEl.value:"";
    const sel=P.selections.find(s=>s.id===sid)||null;
    M.award(P,k,+b.getAttribute("data-d"),sel,sel?"":"Manual");
    S.awardSel=sid;touch();render();return;
  }
  k=b.getAttribute("data-tm");
  if(k){M.awardTeam(P,k,+b.getAttribute("data-d"),"Team adjustment");touch();render();return;}
  k=b.getAttribute("data-undo");
  if(k){P.scoreLog=P.scoreLog.filter(e=>e.id!==k);touch();render();return;}
  k=b.getAttribute("data-tdel");
  if(k!==null&&k!==undefined){
    if(P.teams.length<2)return toast("Keep at least one team");
    const gone=P.teams.splice(+k,1)[0];
    P.participants.forEach(p=>{if(p.teamId===gone.id)p.teamId=P.teams[0].id;});
    touch();render();return;
  }
  k=b.getAttribute("data-gadd");
  if(k!==null&&k!==undefined){P.wheels[+k].games.push({id:M.uid(),name:"New game",enabled:true});touch();render();return;}
  k=b.getAttribute("data-gdel");
  if(k){const [wi,gi]=k.split(".").map(Number);
    if(P.wheels[wi].games.length<2)return toast("Keep at least one game");
    P.wheels[wi].games.splice(gi,1);touch();render();return;}
});

document.addEventListener("input",e=>{
  const t=e.target,P=S.P;
  if(t.id==="c-m"||t.id==="c-1"||t.id==="c-r"){
    const el=$("#c-calc");
    if(el)el.textContent=Math.max(0,(+($("#c-m").value||0)+ +($("#c-1").value||0))*(+($("#c-r").value||0)));
    return;
  }
  if(!P)return;let k;
  if((k=t.getAttribute("data-wname"))!=null){P.wheels[+k].name=t.value;queue();return;}
  if((k=t.getAttribute("data-gname"))!=null){const [wi,gi]=k.split(".").map(Number);P.wheels[wi].games[gi].name=t.value;queue();return;}
  if((k=t.getAttribute("data-tname"))!=null){P.teams[+k].name=t.value;queue();return;}
  if(t.id==="s-name"){P.name=t.value;queue();return;}
});
document.addEventListener("change",e=>{
  const t=e.target,P=S.P;if(!P)return;let k;
  if((k=t.getAttribute("data-gon"))!=null){const [wi,gi]=k.split(".").map(Number);
    P.wheels[wi].games[gi].enabled=t.checked;touch();return;}
  if(t.id==="s-m"){P.rotation.spins[P.rotation.order[0]]=Math.max(0,+t.value||0);touch();return;}
  if(t.id==="s-1"){P.rotation.spins[P.rotation.order[1]]=Math.max(0,+t.value||0);touch();return;}
  if(t.id==="s-r"){P.rotation.rounds=Math.max(1,+t.value||1);touch();return;}
  if(t.id==="s-ap"){P.requireApproval=t.checked;touch();return;}
  if(t.id==="a-sel"){S.awardSel=t.value;return;}
});
let qt;function queue(){clearTimeout(qt);qt=setTimeout(()=>{touch();},400);}

/* ---------- boot ---------- */
(function boot(){
  try{
    const h=lsGet("pgc_host");
    if(h){
      const P=JSON.parse(h);
      if(P&&P.code&&P.status!==M.STATE.CLOSED){
        S.P=P;S.isHost=true;
        S.screen=P.status===M.STATE.LOBBY?"hlobby":(P.status===M.STATE.COMPLETED?"hsummary":"hdash");
        render();hostSync();return;
      }
    }
    const pl=lsGet("pgc_player");
    if(pl){
      const d=JSON.parse(pl);
      if(d&&d.code){S.joinCode=d.code;S.me.name=d.name||S.me.name;S.screen="pwait";render();playerSync();return;}
    }
  }catch(e){}
  render();
})();
})(window);
