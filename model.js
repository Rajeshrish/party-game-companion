/* Party Game Companion — data model, rotation engine, scoring */
(function(G){
"use strict";
const uid=()=>Math.random().toString(36).slice(2,10);
const now=()=>Date.now();
const CODE_ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const mkCode=n=>{let c="";for(let i=0;i<(n||5);i++)c+=CODE_ALPHA[Math.floor(Math.random()*CODE_ALPHA.length)];return c;};
const PAL=["#ff4d7e","#4cc9f0","#3ddc97","#ffd23f","#b14aed","#ff8c42","#f72585","#06d6a0"];

/* ---- session states (spec 5.3) ---- */
const STATE={SETUP:"setup",LOBBY:"lobby",ACTIVE:"active",PAUSED:"paused",COMPLETED:"completed",CLOSED:"closed"};
/* ---- game statuses (spec 11.2) ---- */
const GS={SELECTED:"selected",PLAYING:"in_progress",DONE:"completed",SKIPPED:"skipped"};

function newParty(opts){
  opts=opts||{};
  const wMulti={id:uid(),name:"Multiplayer",color:"#b14aed",games:[
    {id:uid(),name:"Charades",desc:"",enabled:true},
    {id:uid(),name:"Pictionary",desc:"",enabled:true},
    {id:uid(),name:"Werewolf",desc:"",enabled:true},
    {id:uid(),name:"Trivia Round",desc:"",enabled:true},
    {id:uid(),name:"Most Likely To",desc:"",enabled:true},
    {id:uid(),name:"Heads Up",desc:"",enabled:true}
  ]};
  const w1v1={id:uid(),name:"1v1",color:"#ff4d7e",games:[
    {id:uid(),name:"Arm Wrestle",desc:"",enabled:true},
    {id:uid(),name:"Staring Contest",desc:"",enabled:true},
    {id:uid(),name:"Rock Paper Scissors",desc:"",enabled:true},
    {id:uid(),name:"Thumb War",desc:"",enabled:true},
    {id:uid(),name:"Speed Riddle",desc:"",enabled:true}
  ]};
  const P={
    v:1, code:opts.code||mkCode(5), name:opts.name||"Birthday Party",
    status:STATE.LOBBY, requireApproval:opts.requireApproval!==false,
    createdAt:now(), updatedAt:now(),
    teams:[
      {id:uid(),name:"Team Red",color:PAL[0]},
      {id:uid(),name:"Team Blue",color:PAL[1]}
    ],
    participants:[],            // {id,name,status,teamId,joinedAt,admittedAt}
    wheels:[wMulti,w1v1],
    rotation:{order:[wMulti.id,w1v1.id],spins:{},rounds:opts.rounds||5},
    progress:{round:1,orderIdx:0,spinInWheel:0,totalSpins:0,done:false},
    selections:[],              // game history (spec 11.1)
    scoreLog:[],                // {id,pid,pts,selId,gameName,round,ts,reason}
    teamLog:[],                 // {id,tid,pts,round,ts,reason}
    spin:null                   // live animation payload
  };
  P.rotation.spins[wMulti.id]=2;
  P.rotation.spins[w1v1.id]=1;
  return P;
}

/* ---- rotation engine (spec 10) ---- */
function perRound(P){return P.rotation.order.reduce((a,id)=>a+(+P.rotation.spins[id]||0),0);}
function totalPlanned(P){return perRound(P)*(+P.rotation.rounds||0);}
function activeWheelId(P){return P.rotation.order[P.progress.orderIdx];}
function wheelById(P,id){return P.wheels.find(w=>w.id===id)||null;}
function activeWheel(P){return wheelById(P,activeWheelId(P));}
function quota(P,wid){return +P.rotation.spins[wid]||0;}
function spinsLeftOnWheel(P){return Math.max(0,quota(P,activeWheelId(P))-P.progress.spinInWheel);}
function nextWheel(P){
  const r=P.rotation,p=P.progress;
  if(p.spinInWheel+1<quota(P,activeWheelId(P)))return activeWheel(P);
  let i=p.orderIdx+1,round=p.round;
  if(i>=r.order.length){i=0;round++;}
  if(round>r.rounds)return null;
  return wheelById(P,r.order[i]);
}
function advance(P){
  const r=P.rotation,p=P.progress;
  p.spinInWheel++; p.totalSpins++;
  if(p.spinInWheel>=quota(P,activeWheelId(P))){
    p.spinInWheel=0; p.orderIdx++;
    if(p.orderIdx>=r.order.length){p.orderIdx=0;p.round++;}
  }
  if(p.round>r.rounds){p.done=true;P.status=STATE.COMPLETED;}
  return p;
}
function eligibleGames(P,wid){
  const w=wheelById(P,wid||activeWheelId(P));
  return w?w.games.filter(g=>g.enabled!==false):[];
}
function openSelection(P){
  for(let i=P.selections.length-1;i>=0;i--){
    const s=P.selections[i];
    if(s.status===GS.SELECTED||s.status===GS.PLAYING)return s;
  }
  return null;
}
function canSpin(P){
  if(P.status!==STATE.ACTIVE)return {ok:false,why:P.status===STATE.PAUSED?"Party is paused":"Start the party first"};
  if(P.progress.done)return {ok:false,why:"All rounds complete"};
  if(openSelection(P))return {ok:false,why:"Finish the current game first"};
  if(eligibleGames(P).length<1)return {ok:false,why:"This wheel has no games"};
  return {ok:true};
}
function recordSpin(P,game){
  const w=activeWheel(P);
  const sel={id:uid(),gameId:game.id,gameName:game.name,wheelId:w.id,wheelName:w.name,
    round:P.progress.round,spinInWheel:P.progress.spinInWheel+1,
    order:P.selections.length+1,ts:now(),status:GS.SELECTED};
  P.selections.push(sel);
  advance(P);
  return sel;
}

/* ---- scoring (spec 12, 13) ---- */
function admitted(P){return P.participants.filter(p=>p.status==="admitted");}
function pending(P){return P.participants.filter(p=>p.status==="pending");}
function scoreOf(P,pid){return P.scoreLog.reduce((a,e)=>e.pid===pid?a+(+e.pts||0):a,0);}
function gamesPlayed(P,pid){const s=new Set();P.scoreLog.forEach(e=>{if(e.pid===pid&&e.selId)s.add(e.selId);});return s.size;}
function teamScore(P,tid){
  let n=0;
  admitted(P).forEach(p=>{if(p.teamId===tid)n+=scoreOf(P,p.id);});
  P.teamLog.forEach(e=>{if(e.tid===tid)n+=(+e.pts||0);});
  return n;
}
function rankList(items){ // items:[{key,score}] -> adds .rank with ties
  const s=items.slice().sort((a,b)=>b.score-a.score);
  let last=null,lastRank=0;
  s.forEach((it,i)=>{
    if(last!==null&&it.score===last)it.rank=lastRank;
    else {it.rank=i+1;lastRank=i+1;}
    last=it.score;
  });
  return s;
}
function playerRanks(P){return rankList(admitted(P).map(p=>({p:p,key:p.id,score:scoreOf(P,p.id)})));}
function teamRanks(P){return rankList(P.teams.map(t=>({t:t,key:t.id,score:teamScore(P,t.id)})));}
function award(P,pid,pts,sel,reason){
  P.scoreLog.push({id:uid(),pid:pid,pts:+pts,selId:sel?sel.id:null,
    gameName:sel?sel.gameName:(reason||"Manual"),round:sel?sel.round:P.progress.round,ts:now(),reason:reason||""});
}
function awardTeam(P,tid,pts,reason){
  P.teamLog.push({id:uid(),tid:tid,pts:+pts,round:P.progress.round,ts:now(),reason:reason||""});
}
function recentFor(P,pid,n){
  return P.scoreLog.filter(e=>e.pid===pid).slice(-(n||5)).reverse();
}
function smallestTeam(P){
  if(!P.teams.length)return null;
  const c={};P.teams.forEach(t=>c[t.id]=0);
  admitted(P).forEach(p=>{if(c[p.teamId]!=null)c[p.teamId]++;});
  let best=P.teams[0].id,n=Infinity;
  P.teams.forEach(t=>{if(c[t.id]<n){n=c[t.id];best=t.id;}});
  return best;
}
function summary(P){
  const done=P.selections.filter(s=>s.status===GS.DONE).length;
  const skip=P.selections.filter(s=>s.status===GS.SKIPPED).length;
  return {rounds:Math.min(P.rotation.rounds,Math.max(0,P.progress.round-(P.progress.done?0:1))),
    totalRounds:P.rotation.rounds,selected:P.selections.length,completed:done,skipped:skip,
    planned:totalPlanned(P)};
}
G.M={uid,now,mkCode,PAL,STATE,GS,newParty,perRound,totalPlanned,activeWheelId,wheelById,activeWheel,
  quota,spinsLeftOnWheel,nextWheel,advance,eligibleGames,openSelection,canSpin,recordSpin,
  admitted,pending,scoreOf,gamesPlayed,teamScore,rankList,playerRanks,teamRanks,award,awardTeam,
  recentFor,smallestTeam,summary};
})(window);
