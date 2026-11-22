/* Swappable real-time sync layer (spec 17, 20.2)
   Two backends:
     - "firebase": any device joins with just a code. No accounts. Needs config.js.
     - "claude"  : Claude artifact room/db. Works out of the box; viewers must be signed in.
   Interface:
     Sync.init({code, isHost, me, onState, onPeers, onStatus}) -> Promise
     Sync.push(party)      host -> everyone (absolute state)
     Sync.beat(presence)   participant -> host (identity + alive)
     Sync.request(obj)     participant -> host (join request)
     Sync.onRequest(fn)    host listens for join requests
     Sync.leave()
*/
(function(G){
"use strict";
const CFG=G.PD_CONFIG||{};
const S={mode:"local",ready:false,code:"",isHost:false,me:null,
  onState:null,onPeers:null,onStatus:null,onRequest:null,_t:[]};

function status(m,mode){S.onStatus&&S.onStatus(m,mode||S.mode);}

/* ---------------- Firebase backend ---------------- */
const FB={
  app:null,db:null,ref:null,reqRef:null,presRef:null,
  async init(){
    const c=CFG.firebase;
    if(!c||!c.databaseURL)return false;
    try{
      const [{initializeApp},rtdb]=await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js")
      ]);
      FB.m=rtdb;
      FB.app=initializeApp(c);
      FB.db=rtdb.getDatabase(FB.app);
      const base="parties/"+S.code;
      FB.ref=rtdb.ref(FB.db,base+"/state");
      FB.reqRef=rtdb.ref(FB.db,base+"/requests");
      FB.presRef=rtdb.ref(FB.db,base+"/presence");
      if(S.isHost){
        rtdb.onValue(FB.presRef,snap=>{
          const v=snap.val()||{};
          S.onPeers&&S.onPeers(Object.keys(v).map(k=>v[k]));
        });
        rtdb.onValue(FB.reqRef,snap=>{
          const v=snap.val()||{};
          Object.keys(v).forEach(k=>S.onRequest&&S.onRequest(v[k]));
        });
      }else{
        rtdb.onValue(FB.ref,snap=>{const v=snap.val();if(v)S.onState&&S.onState(v);});
        const pr=rtdb.ref(FB.db,base+"/presence/"+S.me.id);
        rtdb.onDisconnect(pr).remove();
      }
      return true;
    }catch(e){return false;}
  },
  push(p){try{FB.m.set(FB.ref,p);}catch(e){}},
  beat(pr){try{FB.m.set(FB.m.ref(FB.db,"parties/"+S.code+"/presence/"+S.me.id),pr);}catch(e){}},
  request(o){try{FB.m.set(FB.m.ref(FB.db,"parties/"+S.code+"/requests/"+o.id),o);}catch(e){}},
  clearRequest(id){try{FB.m.remove(FB.m.ref(FB.db,"parties/"+S.code+"/requests/"+id));}catch(e){}},
  leave(){try{FB.m.remove(FB.m.ref(FB.db,"parties/"+S.code+"/presence/"+S.me.id));}catch(e){}}
};

/* ---------------- Claude artifact backend ---------------- */
const CL={
  room:null,db:null,
  async init(){
    let r=null;
    try{r=await (G.claude&&G.claude.use?G.claude.use("room"):null);}catch(e){r=null;}
    if(!r)return false;
    try{CL.room=(r.join?await r.join("pgc-"+S.code):r)||r;}catch(e){CL.room=r;}
    try{CL.db=await (G.claude&&G.claude.use?G.claude.use("db"):null);}catch(e){CL.db=null;}
    if(S.isHost){
      CL.room.onPeers&&CL.room.onPeers(ps=>{
        const out=[];
        (ps||[]).forEach(p=>{const st=p.state||p.presence||p;if(st&&st.id)out.push(st);});
        S.onPeers&&S.onPeers(out);
        out.forEach(o=>{if(o.wants)S.onRequest&&S.onRequest(o);});
      });
    }else{
      CL.room.on&&CL.room.on("state",v=>{if(v&&v.code===S.code)S.onState&&S.onState(v);});
    }
    return true;
  },
  push(p){try{CL.room.emit&&CL.room.emit("state",p);}catch(e){}
    try{CL.db&&CL.db.doc&&CL.db.doc("parties/"+S.code).set(p);}catch(e){}},
  beat(pr){try{CL.room.presence&&CL.room.presence(pr);}catch(e){}},
  request(o){try{CL.room.presence&&CL.room.presence(Object.assign({wants:true},o));}catch(e){}},
  clearRequest(){},
  leave(){try{CL.room.leave&&CL.room.leave();}catch(e){}}
};

let BE=null;
async function init(o){
  S.code=o.code;S.isHost=!!o.isHost;S.me=o.me;
  S.onState=o.onState;S.onPeers=o.onPeers;S.onStatus=o.onStatus;S.onRequest=o.onRequest;
  const want=CFG.backend||(CFG.firebase&&CFG.firebase.databaseURL?"firebase":"claude");
  if(want==="firebase"&&await FB.init()){BE=FB;S.mode="firebase";S.ready=true;status("live","firebase");return true;}
  if(await CL.init()){BE=CL;S.mode="claude";S.ready=true;status("live","claude");return true;}
  BE=null;S.mode="local";S.ready=false;status("local","local");return false;
}
function push(p){if(BE&&S.isHost)BE.push(p);}
function beat(pr){if(BE&&!S.isHost)BE.beat(pr);}
function request(o){if(BE&&!S.isHost)BE.request(o);}
function clearRequest(id){if(BE&&BE.clearRequest)BE.clearRequest(id);}
function leave(){if(BE)BE.leave();BE=null;S.ready=false;S.mode="local";}
G.Sync={init,push,beat,request,clearRequest,leave,get mode(){return S.mode;},get ready(){return S.ready;}};
})(window);
