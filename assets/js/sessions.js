(function(){
  "use strict";
  let __S_SEQ = 0;
  const personIds = ()=> ["CLIENTE",...(state.staff||[]).map(p=>p.id)];
  window.getPersonSessions = (pid)=>{ state.sessions[pid]=state.sessions[pid]||[]; return state.sessions[pid]; };
  window.getSelected = (pid)=> (state.project.view.selectedIndex||{})[pid] ?? null;
  window.setSelected = (pid,i)=>{ state.project.view.selectedIndex[state.project.view.lastTab||pid]=i; touch(); };

  function durationOf(s){ return Math.max(5, (parseInt(s.endMin||0,10)||0) - (parseInt(s.startMin||0,10)||0)); }
  function reflow(pid){
    const list=getPersonSessions(pid);
    let cur = (state.horaInicial?.[pid] ?? 9*60);
    for(let i=0;i<list.length;i++){
      const d = durationOf(list[i]);
      list[i].startMin = cur; list[i].endMin = cur + d; cur = list[i].endMin;
    }
  }
  window.addAfterIndex = (pid, idx, durMin)=>{
    const list=getPersonSessions(pid); const d=Math.max(5,Math.round((parseInt(durMin||15,10)||15)/5)*5);
    const start = (idx!=null && idx>=0 && list[idx]) ? list[idx].endMin : (list.length? list[list.length-1].endMin : (state.horaInicial?.[pid]??9*60));
    const s={ id:"S_"+(++__S_SEQ), startMin:start, endMin:start+d, taskTypeId:null, locationId:null, vehicleId:null, materiales:[], comentario:"", prevId:null, nextId:null, inheritFromId:null };
    list.splice((idx!=null && idx>=0)? idx+1 : list.length, 0, s);
    reflow(pid); recomputeLocations(pid); touch();
  };
  window.deleteAtIndex = (pid, idx)=>{
    const list=getPersonSessions(pid); if(idx<0||idx>=list.length) return;
    list.splice(idx,1); reflow(pid); recomputeLocations(pid); touch();
  };
  window.resizeSegment = (pid, idx, newDur)=>{
    const list=getPersonSessions(pid); if(!list[idx]) return;
    const d=Math.max(5,Math.round((parseInt(newDur||15,10)||15)/5)*5);
    list[idx].endMin = list[idx].startMin + d;
    reflow(pid); touch();
  };
  window.rebaseTo = (pid, startMin)=>{
    const list=getPersonSessions(pid); if(!list.length) return;
    const base=Math.max(0,parseInt(startMin||0,10)||0); const d0=durationOf(list[0]);
    list[0].startMin=base; list[0].endMin=base+d0; reflow(pid); touch();
  };

  // Localizaciones: bloqueadas excepto primera y transporte
  window.recomputeLocations = (pid)=>{
    const list=getPersonSessions(pid); let cur=null;
    for(let i=0;i<list.length;i++){
      const s=list[i];
      if(i===0 && s.taskTypeId!==TASK_TRANSP){
        cur = s.locationId || cur;
        continue;
      }
      if(s.taskTypeId===TASK_TRANSP){
        // destino elegido por usuario
        cur = s.locationId || cur;
      }else{
        // no transporte: hereda
        s.locationId = cur;
      }
    }
  };

  // Vínculos
  const isEmptyTask = (s)=> !s.taskTypeId;
  window.ensureLinkFields = ()=>{
    personIds().forEach(pid=>{
      getPersonSessions(pid).forEach(s=>{
        if(!s.id) s.id="S_"+(++__S_SEQ);
        if(typeof s.prevId==="undefined") s.prevId=null;
        if(typeof s.nextId==="undefined") s.nextId=null;
        if(typeof s.inheritFromId==="undefined") s.inheritFromId=null;
        s.materiales=s.materiales||[];
      });
    });
  };
  function findSessionById(sid){
    for(const pid of personIds()){
      const list=getPersonSessions(pid); const i=list.findIndex(x=>x.id===sid);
      if(i>=0) return {pid,index:i,session:list[i]};
    }
    return null;
  }
  window.findSessionById = findSessionById;
  const formatLinkMessage = (type, mainInfo, otherInfo)=>{
    if(!mainInfo || !otherInfo) return null;
    const fmt=(info)=> info.pid+" · #"+(info.index+1);
    return type==="prev" ? `PRE vinculado: ${fmt(otherInfo)} → ${fmt(mainInfo)}` : `POST vinculado: ${fmt(mainInfo)} → ${fmt(otherInfo)}`;
  };

  window.canLinkPrev = (mainId,dstId)=>{
    const A=findSessionById(mainId), B=findSessionById(dstId); if(!A||!B) return {ok:false,msg:"No encontrado"};
    const m=A.session, d=B.session;
    if(m.prevId) return {ok:false,msg:"La accion ya tiene PRE"};
    if(!isEmptyTask(d)) return {ok:false,msg:"Destino debe estar vacio"};
    if(d.prevId||d.nextId) return {ok:false,msg:"Destino ya vinculado"};
    return {ok:true};
  };
  window.canLinkPost = (mainId,dstId)=>{
    const A=findSessionById(mainId), B=findSessionById(dstId); if(!A||!B) return {ok:false,msg:"No encontrado"};
    const m=A.session, d=B.session;
    if(m.nextId) return {ok:false,msg:"La accion ya tiene POST"};
    if(!isEmptyTask(d)) return {ok:false,msg:"Destino debe estar vacio"};
    if(d.prevId||d.nextId) return {ok:false,msg:"Destino ya vinculado"};
    return {ok:true};
  };
  window.setPrevLink = (mainId,dstId)=>{
    const c=canLinkPrev(mainId,dstId); if(!c.ok) return c;
    const A=findSessionById(mainId), B=findSessionById(dstId); const m=A.session, d=B.session;
    d.taskTypeId = TASK_MONTAGE; d.materiales = (m.materiales||[]).map(x=>({materialTypeId:x.materialTypeId,cantidad:Number(x.cantidad||0)}));
    d.inheritFromId = m.id; m.prevId = d.id; d.nextId = m.id;
    const msg=formatLinkMessage("prev", findSessionById(mainId), findSessionById(dstId));
    touch(); return {ok:true,msg};
  };
  window.setPostLink = (mainId,dstId)=>{
    const c=canLinkPost(mainId,dstId); if(!c.ok) return c;
    const A=findSessionById(mainId), B=findSessionById(dstId); const m=A.session, d=B.session;
    d.taskTypeId = TASK_DESMONT; d.materiales = []; d.inheritFromId=null;
    m.nextId = d.id; d.prevId = m.id;
    const msg=formatLinkMessage("post", findSessionById(mainId), findSessionById(dstId));
    touch(); return {ok:true,msg};
  };
  window.clearPrevLink = (mainId)=>{
    const A=findSessionById(mainId); if(!A) return {ok:false,msg:"No encontrado"};
    const m=A.session; const P=findSessionById(m.prevId);
    if(P){ const s=P.session; if(s.taskTypeId===TASK_MONTAGE){ s.taskTypeId=null; s.materiales=[]; s.inheritFromId=null; } s.nextId=null; }
    m.prevId=null; touch(); return {ok:true};
  };
  window.clearPostLink = (mainId)=>{
    const A=findSessionById(mainId); if(!A) return {ok:false,msg:"No encontrado"};
    const m=A.session; const N=findSessionById(m.nextId);
    if(N){ const s=N.session; if(s.taskTypeId===TASK_DESMONT){ s.taskTypeId=null; } s.prevId=null; }
    m.nextId=null; touch(); return {ok:true};
  };
  window.resyncPrevMaterials = (montajeId)=>{
    const M=findSessionById(montajeId); if(!M) return {ok:false,msg:"No encontrado"};
    const s=M.session; if(s.taskTypeId!==TASK_MONTAGE || !s.nextId) return {ok:false,msg:"No es Montaje PRE"};
    const main=findSessionById(s.nextId)?.session; if(!main) return {ok:false,msg:"Sin destino"};
    s.materiales=(main.materiales||[]).map(x=>({materialTypeId:x.materialTypeId,cantidad:Number(x.cantidad||0)})); s.inheritFromId=main.id; touch(); return {ok:true};
  };
})();
