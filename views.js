/* Views — host (desktop-first) + participant (mobile-first) */
(function(G){
"use strict";
const M=G.M;
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const V={},T={};
G.V=V;G.esc=esc;

function statusbar(S){
  const m=G.Sync.mode;
  const on=m==="local"?" off":"";
  const txt=m==="firebase"?"Live · open join (no accounts)"
    :m==="claude"?"Live · joiners need a Claude account"
    :"This device only · not synced";
  return '<div class="status"><span class="live'+on+'"></span>'+txt+'</div>';
}
function bar(title,back,right){
  return '<div class="topbar">'+(back?'<button class="iconbtn" data-go="'+back+'">←</button>':'')+
    '<h2>'+esc(title)+'</h2>'+(right||'')+'</div>';
}
function tag(st){
  const m={selected:["sel","Selected"],in_progress:["play","Playing"],completed:["done","Completed"],skipped:["skip","Skipped"]};
  const x=m[st]||["skip",st];return '<span class="tag '+x[0]+'">'+x[1]+'</span>';
}

/* ================= ENTRY ================= */
V.entry=S=>'<div class="wrap"><div class="view" style="justify-content:center">'+
  '<div class="logo">PARTY<br>COMPANION</div>'+
  '<p class="muted center" style="margin:12px 0 30px">Run the games. Spin the wheels. Keep score.<br>Everyone plays in person.</p>'+
  '<button class="btn pink" data-go="hcreate">\u{1F389} Create Party<span style="font-weight:600;opacity:.75">· host</span></button>'+
  '<button class="btn ghost" data-go="pjoin">\u{1F4F1} Join Party<span style="font-weight:600;opacity:.6">· player</span></button>'+
  statusbar(S)+'</div></div>';

/* ================= HOST: CREATE ================= */
V.hcreate=S=>{
  const d=S.draft;
  return '<div class="wrap"><div class="view">'+bar("Create a party","entry")+
  '<div class="card"><div class="field"><label>Party name</label>'+
  '<input id="c-name" maxlength="32" placeholder="Birthday Party" value="'+esc(d.name)+'"></div>'+
  '<div class="field"><label>Your name (host)</label>'+
  '<input id="c-host" maxlength="18" placeholder="Host" value="'+esc(S.me.name)+'"></div></div>'+
  '<div class="card"><h3>Rotation</h3>'+
  '<p class="tiny" style="margin-bottom:12px">How many spins on each wheel before it switches.</p>'+
  '<div class="grid2"><div class="field"><label>Multiplayer spins</label>'+
  '<input id="c-m" type="number" min="0" max="9" value="'+d.m+'"></div>'+
  '<div class="field"><label>1v1 spins</label>'+
  '<input id="c-1" type="number" min="0" max="9" value="'+d.o+'"></div></div>'+
  '<div class="field" style="margin:0"><label>Total rounds</label>'+
  '<input id="c-r" type="number" min="1" max="20" value="'+d.r+'"></div>'+
  '<p class="tiny" style="margin-top:10px">That’s <b id="c-calc">'+((+d.m+ +d.o)*d.r)+'</b> games across the party.</p></div>'+
  '<div class="card tight"><label style="margin:0 0 8px">Admission</label>'+
  '<div class="row"><input type="checkbox" id="c-ap" style="width:auto"'+(d.approve?" checked":"")+'>'+
  '<span style="font-size:14px">Approve each player before they join</span></div></div>'+
  '<button class="btn" id="do-create">Create party →</button>'+statusbar(S)+'</div></div>';
};

/* ================= HOST: LOBBY ================= */
V.hlobby=S=>{
  const P=S.P,ad=M.admitted(P),pe=M.pending(P),conn=ad.filter(p=>S.conn[p.id]).length;
  let h='<div class="wrap"><div class="view">'+bar(P.name,"entry",
    '<button class="iconbtn" data-go="hsettings">⚙</button>');
  h+='<div class="codechip"><span class="muted">JOIN CODE</span><b>'+esc(P.code)+'</b></div>';
  h+='<div class="stats3">'+
     '<div class="stat"><div class="n">'+ad.length+'</div><div class="l">Admitted</div></div>'+
     '<div class="stat"><div class="n">'+conn+'</div><div class="l">Connected</div></div>'+
     '<div class="stat"><div class="n">'+pe.length+'</div><div class="l">Pending</div></div></div>';
  if(pe.length){
    h+='<div class="sec">Pending admission</div>';
    h+=pe.map(p=>'<div class="srow"><span class="dot on"></span><div class="nm">'+esc(p.name)+
      '<div class="sub">waiting</div></div>'+
      '<button class="btn sm green" data-admit="'+p.id+'">Admit</button>'+
      '<button class="del" data-decline="'+p.id+'">✕</button></div>').join("");
  }
  h+='<div class="sec">Teams &amp; players</div>';
  h+=P.teams.map(t=>{
    const mem=ad.filter(p=>p.teamId===t.id);
    return '<div class="card tight"><div class="row" style="margin-bottom:8px">'+
      '<span class="dot" style="background:'+t.color+';width:13px;height:13px"></span>'+
      '<b style="flex:1">'+esc(t.name)+'</b><span class="tiny">'+mem.length+' player'+(mem.length===1?"":"s")+'</span></div>'+
      (mem.length?'<div class="wrapflex">'+mem.map(p=>'<button class="chip" data-manage="'+p.id+'">'+
        '<span class="dot '+(S.conn[p.id]?"on":"off")+'"></span>'+esc(p.name)+'</button>').join("")+'</div>'
        :'<p class="tiny" style="margin:0">Nobody yet</p>')+'</div>';
  }).join("");
  const un=ad.filter(p=>!P.teams.some(t=>t.id===p.teamId));
  if(un.length)h+='<div class="card tight"><b style="font-size:14px">Unassigned</b><div class="wrapflex" style="margin-top:8px">'+
    un.map(p=>'<button class="chip" data-manage="'+p.id+'">'+esc(p.name)+'</button>').join("")+'</div></div>';
  h+='<div class="card tight"><div class="row"><input id="l-add" maxlength="18" placeholder="Add a player by name">'+
     '<button class="btn sm green" id="do-addlocal">Add</button></div>'+
     '<p class="tiny" style="margin-top:8px">For anyone without a phone handy.</p></div>';
  h+='<div class="spacer"></div><button class="btn" id="do-start"'+(ad.length?"":" disabled")+'>Start the party \u{1F680}</button>';
  if(!ad.length)h+='<p class="tiny center">Admit at least one player first.</p>';
  return h+statusbar(S)+'</div></div>';
};

/* ================= HOST: DASHBOARD ================= */
const TABS=[["party","Party"],["wheel","Wheel"],["scores","Scores"],["teams","Teams"],["history","History"]];
V.hdash=S=>{
  const P=S.P;
  let h='<div class="wrap wide"><div class="view">'+bar(P.name,null,
    '<button class="iconbtn" data-go="hsettings">⚙</button>');
  h+='<div class="navtabs">'+TABS.map(t=>'<button data-tab="'+t[0]+'" class="'+(S.tab===t[0]?"on":"")+'">'+t[1]+'</button>').join("")+'</div>';
  if(P.status===M.STATE.PAUSED)h+='<div class="banner"><b>Party paused.</b> Spinning and scoring are on hold.</div>';
  h+=(T[S.tab]||T.party)(S);
  return h+statusbar(S)+'</div></div>';
};

T.party=S=>{
  const P=S.P,ad=M.admitted(P),pe=M.pending(P),conn=ad.filter(p=>S.conn[p.id]).length;
  const sel=M.openSelection(P),sum=M.summary(P);
  let h='<div class="hgrid cols">';
  h+='<div>';
  h+='<div class="stats4">'+
    '<div class="stat"><div class="n">'+P.progress.round+'<span style="font-size:15px;opacity:.5">/'+P.rotation.rounds+'</span></div><div class="l">Round</div></div>'+
    '<div class="stat"><div class="n">'+P.selections.length+'<span style="font-size:15px;opacity:.5">/'+sum.planned+'</span></div><div class="l">Games</div></div>'+
    '<div class="stat"><div class="n">'+conn+'<span style="font-size:15px;opacity:.5">/'+ad.length+'</span></div><div class="l">Connected</div></div>'+
    '<div class="stat"><div class="n">'+pe.length+'</div><div class="l">Pending</div></div></div>';
  h+='<div class="card"><h3>Active game</h3>';
  if(sel){
    h+='<div class="row" style="gap:10px;margin-bottom:12px"><div style="flex:1"><div style="font-size:22px;font-weight:900">'+esc(sel.gameName)+'</div>'+
      '<div class="tiny">'+esc(sel.wheelName)+' · Round '+sel.round+' · Spin '+sel.spinInWheel+'</div></div>'+tag(sel.status)+'</div>';
    h+='<div class="row" style="gap:8px;flex-wrap:wrap">'+
      (sel.status===M.GS.SELECTED?'<button class="btn sm blue" data-sel="start">Start game</button>':'')+
      '<button class="btn sm green" data-sel="done">Complete</button>'+
      '<button class="btn sm ghost" data-sel="skip">Skip</button>'+
      '<button class="btn sm ghost" data-tab="scores">Award points</button></div>';
  }else if(P.progress.done){
    h+='<p class="muted">All rounds finished.</p><button class="btn green" data-go="hsummary" style="margin-top:10px">See party summary \u{1F3C1}</button>';
  }else{
    h+='<p class="muted">No game selected. Head to the wheel.</p><button class="btn purple" data-tab="wheel" style="margin-top:10px">Go to wheel \u{1F3AF}</button>';
  }
  h+='</div>';
  if(pe.length){
    h+='<div class="sec">Pending admission</div>'+pe.map(p=>'<div class="srow"><span class="dot on"></span>'+
      '<div class="nm">'+esc(p.name)+'<div class="sub">wants to join</div></div>'+
      '<button class="btn sm green" data-admit="'+p.id+'">Admit</button>'+
      '<button class="del" data-decline="'+p.id+'">✕</button></div>').join("");
  }
  h+='</div><div>';
  h+='<div class="card"><h3>Team standings</h3>'+teamBoard(S,true)+'</div>';
  h+='<div class="card"><h3>Quick actions</h3><div class="row" style="flex-wrap:wrap;gap:8px">'+
    '<button class="btn sm purple" data-tab="wheel">Spin</button>'+
    '<button class="btn sm ghost" data-tab="scores">Add points</button>'+
    '<button class="btn sm ghost" data-tab="teams">Assign team</button>'+
    '<button class="btn sm ghost" id="do-pause">'+(S.P.status===M.STATE.PAUSED?"Resume":"Pause")+'</button></div></div>';
  h+='</div></div>';
  return h;
};

T.wheel=S=>{
  const P=S.P,w=M.activeWheel(P),nx=M.nextWheel(P),can=M.canSpin(P);
  const left=M.spinsLeftOnWheel(P),q=M.quota(P,M.activeWheelId(P));
  let h='<div class="hgrid cols"><div>';
  h+='<div class="rot">'+P.rotation.order.map(id=>{
      const ww=M.wheelById(P,id);if(!ww)return"";
      return '<span class="pill'+(id===M.activeWheelId(P)?" on":"")+'">'+esc(ww.name)+' ×'+M.quota(P,id)+'</span>';
    }).join('<span class="tiny">→</span>')+
    '<span class="pill">Round '+P.progress.round+'/'+P.rotation.rounds+'</span></div>';
  h+='<div class="result'+(P.spin?" pop":"")+'" id="res"><div><div class="lbl">'+(P.spin?"Landed on":"Active wheel — "+esc(w?w.name:"none"))+'</div>'+
     '<div class="val">'+(P.spin?esc(P.spin.label):(can.ok?"Ready to spin":esc(can.why)))+'</div></div></div>';
  h+='<div class="wheelwrap"><div class="pointer"></div><canvas id="cv" width="680" height="680"></canvas>'+
     '<div class="hubcap">\u{1F3B2}</div></div>';
  h+='<div class="row" style="justify-content:center;gap:6px;margin-bottom:10px"><span class="pips">'+
     Array.from({length:q}).map((_,i)=>'<span class="pip'+(i<P.progress.spinInWheel?" f":"")+'"></span>').join("")+
     '</span><span class="tiny">'+left+' spin'+(left===1?"":"s")+' left on this wheel'+(nx?" · next: "+esc(nx.name):" · last wheel")+'</span></div>';
  h+='<button class="btn purple" id="do-spin"'+(can.ok?"":" disabled")+'>SPIN \u{1F3AF}</button>';
  if(!can.ok)h+='<p class="tiny center">'+esc(can.why)+'</p>';
  h+='</div><div>';
  h+='<div class="card"><h3>Wheels &amp; games</h3>'+
     P.wheels.map((ww,wi)=>'<div style="margin-bottom:14px"><div class="row" style="margin-bottom:7px">'+
       '<span class="dot" style="background:'+ww.color+';width:12px;height:12px"></span>'+
       '<input data-wname="'+wi+'" value="'+esc(ww.name)+'" maxlength="20" style="font-weight:800;padding:8px 11px">'+
       '</div>'+ww.games.map((g,gi)=>'<div class="item"><input type="checkbox" data-gon="'+wi+'.'+gi+'" style="width:auto;flex:none"'+(g.enabled!==false?" checked":"")+'>'+
         '<input data-gname="'+wi+'.'+gi+'" value="'+esc(g.name)+'" maxlength="28">'+
         '<button class="del" data-gdel="'+wi+'.'+gi+'">✕</button></div>').join("")+
       '<button class="btn sm ghost" data-gadd="'+wi+'" style="width:100%;margin-top:4px">+ Add game</button></div>').join("")+
     '</div>';
  h+='</div></div>';
  return h;
};

T.scores=S=>{
  const P=S.P,ad=M.admitted(P),sel=M.openSelection(P);
  const target=S.awardSel||(sel?sel.id:null);
  let h='<div class="hgrid cols"><div>';
  h+='<div class="card"><h3>Award points</h3>';
  if(!ad.length)h+='<p class="muted">No players admitted yet.</p>';
  else{
    h+='<div class="field"><label>For which game</label><select id="a-sel">'+
      '<option value="">Manual adjustment</option>'+
      P.selections.slice().reverse().map(s=>'<option value="'+s.id+'"'+(s.id===target?" selected":"")+'>'+
        esc(s.gameName)+' — R'+s.round+'</option>').join("")+'</select></div>';
    h+=ad.map(p=>{
      const t=P.teams.find(t=>t.id===p.teamId);
      return '<div class="srow"><span class="dot" style="background:'+(t?t.color:"#5c5580")+'"></span>'+
      '<div class="nm">'+esc(p.name)+'<div class="sub">'+esc(t?t.name:"Unassigned")+'</div></div>'+
      '<div class="stepper"><button data-aw="'+p.id+'" data-d="-1">−</button>'+
      '<button data-aw="'+p.id+'" data-d="1">+1</button>'+
      '<button data-aw="'+p.id+'" data-d="5">+5</button>'+
      '<button data-aw="'+p.id+'" data-d="10">+10</button></div>'+
      '<div class="sc">'+M.scoreOf(P,p.id)+'</div></div>';
    }).join("");
    h+='<p class="tiny" style="margin-top:8px">Player points roll up into their team score.</p>';
  }
  h+='</div>';
  h+='<div class="card"><h3>Recent score changes</h3>'+
     (P.scoreLog.length?P.scoreLog.slice(-10).reverse().map(e=>{
       const p=P.participants.find(x=>x.id===e.pid);
       return '<div class="histrow"><span class="r">R'+e.round+'</span><span class="g">'+esc(p?p.name:"?")+
         ' <span class="tiny">'+esc(e.gameName||"")+'</span></span><b style="color:'+(e.pts<0?"var(--pink)":"var(--green)")+'">'+
         (e.pts>0?"+":"")+e.pts+'</b><button class="del" data-undo="'+e.id+'">↶</button></div>';
     }).join(""):'<p class="muted">Nothing yet.</p>')+'</div>';
  h+='</div><div>';
  h+='<div class="card"><h3>Team scores</h3>'+teamBoard(S,true)+'</div>';
  h+='<div class="card"><h3>Individual ranking</h3>'+playerBoard(S,null)+'</div>';
  h+='</div></div>';
  return h;
};

T.teams=S=>{
  const P=S.P,ad=M.admitted(P);
  let h='<div class="hgrid cols"><div>';
  h+='<div class="card"><h3>Teams</h3>'+P.teams.map((t,i)=>{
    const mem=ad.filter(p=>p.teamId===t.id);
    return '<div style="margin-bottom:13px"><div class="item">'+
      '<span class="dot" style="background:'+t.color+';width:14px;height:14px"></span>'+
      '<input data-tname="'+i+'" value="'+esc(t.name)+'" maxlength="20">'+
      '<span class="chip">'+M.teamScore(P,t.id)+'</span>'+
      '<button class="del" data-tdel="'+i+'">✕</button></div>'+
      '<div class="wrapflex" style="padding-left:24px">'+(mem.length?mem.map(p=>
        '<button class="chip" data-manage="'+p.id+'">'+esc(p.name)+'</button>').join(""):'<span class="tiny">Empty</span>')+'</div></div>';
  }).join("")+'<button class="btn sm ghost" id="t-add" style="width:100%">+ Create team</button></div>';
  h+='</div><div>';
  const un=ad.filter(p=>!P.teams.some(t=>t.id===p.teamId));
  h+='<div class="card"><h3>Unassigned</h3>'+(un.length?'<div class="wrapflex">'+un.map(p=>
    '<button class="chip" data-manage="'+p.id+'">'+esc(p.name)+'</button>').join("")+'</div>'
    :'<p class="muted">Everyone has a team.</p>')+'</div>';
  h+='<div class="card"><h3>All players</h3>'+(ad.length?ad.map(p=>{
    const t=P.teams.find(t=>t.id===p.teamId);
    return '<div class="srow"><span class="dot '+(S.conn[p.id]?"on":"off")+'"></span>'+
      '<div class="nm">'+esc(p.name)+'<div class="sub">'+esc(t?t.name:"Unassigned")+' · '+M.scoreOf(P,p.id)+' pts</div></div>'+
      '<button class="btn sm ghost" data-manage="'+p.id+'">Manage</button></div>';
  }).join(""):'<p class="muted">Nobody yet.</p>')+'</div>';
  h+='</div></div>';
  return h;
};

T.history=S=>{
  const P=S.P;
  let h='<div class="card"><h3>Game history</h3>';
  h+=P.selections.length?P.selections.slice().reverse().map(s=>
    '<div class="histrow"><span class="r">R'+s.round+'</span>'+
    '<span class="chip" style="padding:3px 9px;font-size:11px">'+esc(s.wheelName)+'</span>'+
    '<span class="g">'+esc(s.gameName)+'</span>'+tag(s.status)+'</div>').join("")
    :'<p class="muted">No games selected yet.</p>';
  h+='</div>';
  return h;
};

function teamBoard(S,admin){
  const P=S.P,r=M.teamRanks(P),max=Math.max(1,r.length?r[0].score:1);
  if(!r.length)return '<p class="muted">No teams.</p>';
  return r.map(x=>'<div class="srow r'+x.rank+'"><div class="pos">'+x.rank+'</div>'+
    '<span class="dot" style="background:'+x.t.color+'"></span>'+
    '<div class="nm">'+esc(x.t.name)+'<div class="bar"><i style="width:'+Math.round(Math.max(0,x.score)/max*100)+'%"></i></div></div>'+
    (admin?'<div class="stepper"><button data-tm="'+x.t.id+'" data-d="-1">−</button>'+
      '<button data-tm="'+x.t.id+'" data-d="1">+</button>'+
      '<button data-tm="'+x.t.id+'" data-d="5">+5</button></div>':'')+
    '<div class="sc">'+x.score+'</div></div>').join("");
}
function playerBoard(S,meId){
  const P=S.P,r=M.playerRanks(P);
  if(!r.length)return '<p class="muted">No players yet.</p>';
  return r.map(x=>{
    const t=P.teams.find(t=>t.id===x.p.teamId);
    return '<div class="srow r'+x.rank+(x.p.id===meId?" me":"")+'"><div class="pos">'+x.rank+'</div>'+
      '<span class="dot" style="background:'+(t?t.color:"#5c5580")+'"></span>'+
      '<div class="nm">'+esc(x.p.name)+'<div class="sub">'+esc(t?t.name:"Unassigned")+'</div></div>'+
      '<div class="sc">'+x.score+'</div></div>';
  }).join("");
}
G.boards={teamBoard,playerBoard};

/* ================= HOST: SETTINGS / SUMMARY ================= */
V.hsettings=S=>{
  const P=S.P;
  let h='<div class="wrap"><div class="view">'+bar("Settings",S.P.status===M.STATE.LOBBY?"hlobby":"hdash");
  h+='<div class="card"><div class="field"><label>Party name</label>'+
     '<input id="s-name" value="'+esc(P.name)+'" maxlength="32"></div>'+
     '<div class="grid2"><div class="field"><label>Multiplayer spins</label>'+
     '<input id="s-m" type="number" min="0" max="9" value="'+M.quota(P,P.rotation.order[0])+'"></div>'+
     '<div class="field"><label>1v1 spins</label>'+
     '<input id="s-1" type="number" min="0" max="9" value="'+M.quota(P,P.rotation.order[1])+'"></div></div>'+
     '<div class="field" style="margin:0"><label>Total rounds</label>'+
     '<input id="s-r" type="number" min="1" max="20" value="'+P.rotation.rounds+'"></div></div>';
  h+='<div class="card tight"><div class="row"><input type="checkbox" id="s-ap" style="width:auto"'+(P.requireApproval?" checked":"")+'>'+
     '<span style="font-size:14px">Approve each player before they join</span></div></div>';
  h+='<div class="codechip"><span class="muted">JOIN CODE</span><b>'+esc(P.code)+'</b></div>';
  h+='<div class="sec">Danger zone</div>'+
     '<button class="btn ghost" id="do-resetscores">Reset all scores</button>'+
     '<button class="btn danger" id="do-end">End party</button>';
  return h+statusbar(S)+'</div></div>';
};

V.hsummary=S=>{
  const P=S.P,sum=M.summary(P);
  let h='<div class="wrap wide"><div class="view">'+bar("Party summary","hdash");
  h+='<div class="card center"><div style="font-size:46px">\u{1F3C6}</div>'+
     '<h1 style="margin:6px 0">'+esc(P.name)+'</h1>'+
     '<p class="muted">'+sum.completed+' games played · '+sum.totalRounds+' rounds</p></div>';
  h+='<div class="stats4">'+
     '<div class="stat"><div class="n">'+sum.selected+'</div><div class="l">Selected</div></div>'+
     '<div class="stat"><div class="n">'+sum.completed+'</div><div class="l">Completed</div></div>'+
     '<div class="stat"><div class="n">'+sum.skipped+'</div><div class="l">Skipped</div></div>'+
     '<div class="stat"><div class="n">'+M.admitted(P).length+'</div><div class="l">Players</div></div></div>';
  h+='<div class="hgrid cols"><div class="card"><h3>Final team standings</h3>'+G.boards.teamBoard(S,false)+'</div>'+
     '<div class="card"><h3>Final individual ranking</h3>'+G.boards.playerBoard(S,null)+'</div></div>';
  h+='<div class="card"><h3>Full game history</h3>'+T.history(S).replace(/^<div class="card"><h3>Game history<\/h3>/,"").replace(/<\/div>$/,"")+'</div>';
  h+='<button class="btn ghost" data-go="hdash">Back to dashboard</button>'+
     '<button class="btn danger" id="do-end">End session</button>';
  return h+statusbar(S)+'</div></div>';
};

/* ================= PARTICIPANT ================= */
V.pjoin=S=>'<div class="wrap"><div class="view">'+bar("Join a party","entry")+
  '<div class="card"><div class="field"><label>Party code</label>'+
  '<input id="j-code" maxlength="5" autocapitalize="characters" placeholder="K7P4Q" '+
  'style="text-transform:uppercase;letter-spacing:.28em;font-size:25px;font-weight:900;text-align:center" value="'+esc(S.joinCode||"")+'"></div>'+
  '<div class="field"><label>Your name</label>'+
  '<input id="j-name" maxlength="18" placeholder="Your name" value="'+esc(S.me.name)+'"></div>'+
  '<button class="btn blue" id="do-join">Join →</button></div>'+
  '<p class="tiny center">No account needed — just the code from the host.</p>'+statusbar(S)+'</div></div>';

V.pwait=S=>{
  const P=S.P,me=P?P.participants.find(p=>p.id===S.me.id):null;
  const declined=me&&me.status==="removed";
  return '<div class="wrap"><div class="view" style="justify-content:center;text-align:center">'+
  '<div style="font-size:52px">'+(declined?"\u{1F6AB}":"⏳")+'</div>'+
  '<h1 style="margin:10px 0 6px">'+(declined?"Not admitted":"You’re in the queue")+'</h1>'+
  '<p class="muted">'+(P?esc(P.name):"")+' · code '+esc(S.joinCode||"")+'</p>'+
  '<p class="muted" style="margin-top:14px">'+(declined?"The host didn’t admit you to this party."
    :"Waiting for the host to admit you…")+'</p>'+
  '<button class="btn ghost" data-go="entry" style="margin-top:22px">Leave</button>'+
  '</div>'+statusbar(S)+'</div>';
};

V.pdash=S=>{
  const P=S.P,me=P.participants.find(p=>p.id===S.me.id);
  if(!me)return V.pwait(S);
  const t=P.teams.find(t=>t.id===me.teamId);
  const pr=M.playerRanks(P),mine=pr.find(x=>x.p.id===me.id);
  const tr=M.teamRanks(P),mt=t?tr.find(x=>x.t.id===t.id):null;
  const sel=M.openSelection(P),rec=M.recentFor(P,me.id,5);
  let h='<div class="wrap"><div class="view">';
  h+='<div class="topbar"><h2>'+esc(P.name)+'</h2>'+
     '<button class="iconbtn" data-go="pboard">\u{1F3C6}</button></div>';
  h+='<div class="card tight"><div class="row">'+
     '<span class="dot '+(G.Sync.ready?"on":"off")+'"></span>'+
     '<div style="flex:1"><b style="font-size:17px">'+esc(me.name)+'</b>'+
     '<div class="tiny">'+(G.Sync.ready?"Connected":"Reconnecting…")+' · '+esc(t?t.name:"No team")+'</div></div></div></div>';
  h+='<div class="stats3">'+
     '<div class="stat"><div class="n">'+M.scoreOf(P,me.id)+'</div><div class="l">Your score</div></div>'+
     '<div class="stat"><div class="n">#'+(mine?mine.rank:"–")+'</div><div class="l">Your rank</div></div>'+
     '<div class="stat"><div class="n">'+(t?M.teamScore(P,t.id):0)+'</div><div class="l">Team score</div></div></div>';
  h+='<div class="card"><h3>Current game</h3>';
  if(P.status===M.STATE.PAUSED)h+='<p class="muted">The party is paused.</p>';
  else if(P.progress.done)h+='<p class="muted">All rounds finished — check the leaderboard!</p>';
  else if(sel)h+='<div class="row"><div style="flex:1"><div style="font-size:21px;font-weight:900">'+esc(sel.gameName)+'</div>'+
    '<div class="tiny">'+esc(sel.wheelName)+' · Round '+sel.round+' of '+P.rotation.rounds+'</div></div>'+tag(sel.status)+'</div>';
  else h+='<p class="muted">Waiting on the host to spin… <span class="tiny">Round '+P.progress.round+' of '+P.rotation.rounds+'</span></p>';
  h+='</div>';
  if(mt)h+='<div class="card tight"><div class="row"><span class="dot" style="background:'+t.color+'"></span>'+
    '<div style="flex:1"><b>'+esc(t.name)+'</b><div class="tiny">Team rank #'+mt.rank+' of '+tr.length+'</div></div>'+
    '<div class="sc" style="font-size:20px;font-weight:900">'+mt.score+'</div></div></div>';
  h+='<div class="sec">Your recent results</div>';
  h+=rec.length?rec.map(e=>'<div class="histrow"><span class="r">R'+e.round+'</span>'+
     '<span class="g">'+esc(e.gameName||"Adjustment")+'</span>'+
     '<b style="color:'+(e.pts<0?"var(--pink)":"var(--green)")+'">'+(e.pts>0?"+":"")+e.pts+'</b></div>').join("")
     :'<p class="tiny" style="margin-left:2px">No points yet — the party’s young.</p>';
  h+='<button class="btn ghost" data-go="pboard" style="margin-top:14px">Leaderboards \u{1F3C6}</button>';
  return h+statusbar(S)+'</div></div>';
};

V.pboard=S=>{
  const P=S.P;
  let h='<div class="wrap"><div class="view">'+bar("Leaderboards","pdash");
  h+='<div class="card"><h3>Teams</h3>'+G.boards.teamBoard(S,false)+'</div>';
  h+='<div class="card"><h3>Players</h3>'+G.boards.playerBoard(S,S.me.id)+'</div>';
  h+='<div class="card"><h3>Games so far</h3>'+(P.selections.length?
     P.selections.slice().reverse().slice(0,12).map(s=>'<div class="histrow"><span class="r">R'+s.round+'</span>'+
     '<span class="g">'+esc(s.gameName)+'</span>'+tag(s.status)+'</div>').join("")
     :'<p class="muted">Nothing played yet.</p>')+'</div>';
  return h+statusbar(S)+'</div></div>';
};
})(window);
