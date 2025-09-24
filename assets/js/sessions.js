(function(){
  "use strict";
  let __S_SEQ = 0;
  const ACTION_TRANSPORTE = "transporte";
  const ACTION_NORMAL = "normal";

  const personIds = ()=> ["CLIENTE", ...(state.staff||[]).map(p=>p.id)];
  const ownerFor = (pid)=> pid || "CLIENTE";
  const normalizeMode = (mode)=> String(mode||"").toLowerCase() === ACTION_TRANSPORTE ? ACTION_TRANSPORTE : ACTION_NORMAL;
  const getTaskById = (id)=> (state.taskTypes||[]).find(t=>t.id===id) || null;

  const isTransportActionId = (id)=>{
    if(!id) return false;
    if(id === TASK_TRANSP) return true;
    const entry = getTaskById(id);
    const tipo = String(entry?.tipo || entry?.type || "").toLowerCase();
    return tipo === ACTION_TRANSPORTE;
  };
  window.isTransportActionId = isTransportActionId;

  const isTransportSession = (session)=>{
    if(!session) return false;
    if(normalizeMode(session.actionMode) === ACTION_TRANSPORTE) return true;
    return isTransportActionId(session.taskTypeId);
  };
  window.isTransportSession = isTransportSession;

  const getSessionActionName = (session)=>{
    if(!session) return "";
    const direct = String(session.actionName || "").trim();
    if(direct) return direct;
    return getTaskById(session.taskTypeId)?.nombre || "";
  };
  window.getSessionActionName = getSessionActionName;

  const nextTaskTypeId = ()=>{
    let max = 0;
    (state.taskTypes||[]).forEach(t=>{
      const m = /^T_(\d+)$/i.exec(t.id || "");
      if(m) max = Math.max(max, parseInt(m[1], 10) || 0);
    });
    return `T_${max+1}`;
  };

  const ensureActionCatalogEntry = ({nombre, tipo, quien, color})=>{
    const name = String(nombre||"").trim();
    if(!name) return null;
    const kind = normalizeMode(tipo);
    const owner = quien || "";
    const lower = name.toLowerCase();
    const existing = (state.taskTypes||[]).find(t=>{
      const tName = String(t.nombre||"").trim().toLowerCase();
      const tKind = normalizeMode(t.tipo || t.type);
      const tOwner = t.quien || t.owner || "";
      return tName === lower && tKind === kind && tOwner === owner;
    });
    if(existing){
      if(color && !existing.color) existing.color = color;
      if(!existing.tipo) existing.tipo = kind;
      if(!existing.quien) existing.quien = owner;
      return {entry:existing, created:false};
    }
    const entry = {
      id: nextTaskTypeId(),
      nombre: name,
      color: color || (kind === ACTION_TRANSPORTE ? "#22d3ee" : "#60a5fa"),
      locked: false,
      tipo: kind,
      quien: owner
    };
    state.taskTypes = state.taskTypes || [];
    state.taskTypes.push(entry);
    return {entry, created:true};
  };
  window.ensureActionCatalogEntry = ensureActionCatalogEntry;

  const ensureActionForSession = (session, pid)=>{
    if(!session) return null;
    session.actionMode = normalizeMode(session.actionMode);
    const trimmed = String(session.actionName||"").trim();
    session.actionName = trimmed;
    if(!trimmed){
      session.taskTypeId = null;
      return null;
    }
    const owner = ownerFor(pid);
    const result = ensureActionCatalogEntry({nombre:trimmed, tipo:session.actionMode, quien:owner});
    if(result?.entry){
      session.taskTypeId = result.entry.id;
    }
    return result;
  };
  window.ensureActionForSession = ensureActionForSession;

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
    const list=getPersonSessions(pid); const wasEmpty=!list.length;
    const d=Math.max(5,Math.round((parseInt(durMin||15,10)||15)/5)*5);
    const start = (idx!=null && idx>=0 && list[idx]) ? list[idx].endMin : (list.length? list[list.length-1].endMin : (state.horaInicial?.[pid]??9*60));
    const initialLoc = wasEmpty ? (state.localizacionInicial?.[pid] ?? null) : null;
    const s={
      id:"S_"+(++__S_SEQ),
      startMin:start,
      endMin:start+d,
      taskTypeId:null,
      actionName:"",
      actionMode:ACTION_NORMAL,
      locationId:initialLoc,
      vehicleId:null,
      materiales:[],
      comentario:""
    };
    list.splice((idx!=null && idx>=0)? idx+1 : list.length, 0, s);
    if(wasEmpty){
      state.localizacionInicial=state.localizacionInicial||{};
      state.localizacionInicial[pid]=s.locationId||null;
    }
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

  window.recomputeLocations = (pid)=>{
    const list=getPersonSessions(pid); let cur=null;
    for(let i=0;i<list.length;i++){
      const s=list[i];
      if(i===0 && !isTransportSession(s)){
        cur = s.locationId || cur;
        continue;
      }
      if(isTransportSession(s)){
        cur = s.locationId || cur;
      }else{
        s.locationId = cur;
      }
    }
  };

  function ensureSessionDefaults(){
    personIds().forEach(pid=>{
      const list=getPersonSessions(pid);
      list.forEach(s=>{
        if(!s.id) s.id="S_"+(++__S_SEQ);
        if(!Array.isArray(s.materiales)) s.materiales=[];
        if(typeof s.prevId!=="undefined") s.prevId=null;
        if(typeof s.nextId!=="undefined") s.nextId=null;
        if(typeof s.inheritFromId!=="undefined") s.inheritFromId=null;
        if(typeof s.linkPrevRole!=="undefined") s.linkPrevRole=null;
        if(typeof s.linkNextRole!=="undefined") s.linkNextRole=null;
        const transportById = isTransportActionId(s.taskTypeId);
        if(typeof s.actionMode==="undefined" || s.actionMode===null || s.actionMode===""){
          s.actionMode = transportById ? ACTION_TRANSPORTE : ACTION_NORMAL;
        }else{
          s.actionMode = normalizeMode(s.actionMode);
          if(transportById) s.actionMode = ACTION_TRANSPORTE;
        }
        if(typeof s.actionName==="undefined" || s.actionName===null){
          s.actionName = getSessionActionName(s);
        }else{
          s.actionName = String(s.actionName||"").trim();
        }
      });
    });
  }
  window.ensureSessionDefaults = ensureSessionDefaults;
})();
