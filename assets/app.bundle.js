﻿(function(){
  "use strict";
  window.$ = (sel)=>document.querySelector(sel);
  window.el = function(tag, cls, text){
    const n=document.createElement(tag);
    if(cls) n.className=cls;
    if(text!==undefined && text!==null) n.textContent=String(text);
    return n;
  };
  window.toMin = (hhmm)=>{
    const s=String(hhmm||"0:0").trim();
    const m=s.match(/^(\d{1,2}):(\d{2})$/); if(!m) return 0;
    const h=parseInt(m[1],10)||0, mi=parseInt(m[2],10)||0;
    return h*60+mi;
  };
  window.toHHMM = (mins)=>{
    const v=Math.max(0, parseInt(mins||0,10)||0);
    const h=String(Math.floor(v/60)).padStart(2,"0");
    const m=String(v%60).padStart(2,"0");
    return h+":"+m;
  };
})();


(function(){
  "use strict";
  const root = window;
  // Estado básico
  if(!root.state){
    root.state = {
      project:{ nombre:"Proyecto", fecha:"", tz:"Europe/Madrid", updatedAt:"", view:{ lastTab:"CLIENTE", subGantt:"Gantt", selectedIndex:{} } },
      locations:[], taskTypes:[], materialTypes:[], vehicles:[], staff:[],
      sessions:{ CLIENTE:[] }, horaInicial:{}
    };
  }
  // Autosave
  let _onTouched=null;
  window.setOnTouched = (cb)=>{ _onTouched = cb; };
  window.touch = ()=>{
    state.project.updatedAt = new Date().toISOString();
    try{ localStorage.setItem("eventplan.autosave", JSON.stringify(state)); }catch(e){}
    try{ if(_onTouched) _onTouched(); }catch(e){}
  };
  window.exportJSON = ()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=(state.project.nombre||"eventplan")+".eventplan.json"; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  };
  window.importJSONFile = (file,done)=>{
    const fr=new FileReader();
    fr.onload=()=>{ try{ const obj=JSON.parse(fr.result); if(obj&&typeof obj==="object"){ Object.assign(state,obj); } }catch(e){} ensureDefaults(); if(done) done(); };
    fr.readAsText(file,"utf-8");
  };
  window.ensureDefaults = ()=>{
    const st=state;
    st.taskTypes=st.taskTypes||[]; st.locations=st.locations||[]; st.materialTypes=st.materialTypes||[];
    st.vehicles=st.vehicles||[]; st.staff=st.staff||[]; st.sessions=st.sessions||{CLIENTE:[]}; st.horaInicial=st.horaInicial||{};
    st.project=st.project||{nombre:"Proyecto",fecha:"",tz:"Europe/Madrid",updatedAt:"",view:{}}; st.project.view=st.project.view||{};
    st.project.view.lastTab=st.project.view.lastTab||"CLIENTE"; st.project.view.subGantt=st.project.view.subGantt||"Gantt"; st.project.view.selectedIndex=st.project.view.selectedIndex||{};
    if(!st.sessions.CLIENTE) st.sessions.CLIENTE=[];
    try{ ensureSeedsCore(); }catch(e){}
  };

  // === Fuente de verdad de IDs y semillas (idempotente) ===
  (function EP_CORE_SEEDS(){
    try{
      root.EP_IDS = root.EP_IDS || {};
      if(!root.EP_IDS.TRANSP) root.EP_IDS.TRANSP="TASK_TRANSP";
      if(!root.EP_IDS.MONT)   root.EP_IDS.MONT  ="TASK_MONTAGE";
      if(!root.EP_IDS.DESM)   root.EP_IDS.DESM  ="TASK_DESMONT";
      if(typeof root.TASK_TRANSP   === "undefined") root.TASK_TRANSP   = root.EP_IDS.TRANSP;
      if(typeof root.TASK_MONTAGE  === "undefined") root.TASK_MONTAGE  = root.EP_IDS.MONT;
      if(typeof root.TASK_DESMONT  === "undefined") root.TASK_DESMONT  = root.EP_IDS.DESM;

      window.ensureSeedsCore = function(){
        const st=state;
        st.taskTypes=st.taskTypes||[]; st.vehicles=st.vehicles||[];
        const upsert=(arr,obj)=>{ const i=arr.findIndex(x=>x.id===obj.id); if(i<0) arr.push(obj); else { const t=arr[i]; t.nombre=t.nombre||obj.nombre; if(obj.color) t.color=t.color||obj.color; t.locked=true; } };
        upsert(st.taskTypes,{id:root.EP_IDS.TRANSP,nombre:"Transporte",color:"#22d3ee",locked:true});
        upsert(st.taskTypes,{id:root.EP_IDS.MONT,  nombre:"Montaje",   color:"#a3e635",locked:true});
        upsert(st.taskTypes,{id:root.EP_IDS.DESM,  nombre:"Desmontaje",color:"#f59e0b",locked:true});
        upsert(st.vehicles, {id:"V_WALK",nombre:"Caminando",locked:true});
        const order=id=>({[root.EP_IDS.TRANSP]:0,[root.EP_IDS.MONT]:1,[root.EP_IDS.DESM]:2}[id]??9);
        st.taskTypes=st.taskTypes.filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).sort((a,b)=>order(a.id)-order(b.id)||(a.nombre||"").localeCompare(b.nombre||""));
        st.vehicles=st.vehicles.filter((x,i,a)=>a.findIndex(y=>y.id===x.id)===i).sort((a,b)=>(a.id==="V_WALK"?-1:0)-(b.id==="V_WALK"?-1:0)||(a.nombre||"").localeCompare(b.nombre||""));
      };
      ensureSeedsCore();
    }catch(e){}
  })();
})();


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
    d.inheritFromId = m.id; m.prevId = d.id; d.nextId = m.id; touch(); return {ok:true};
  };
  window.setPostLink = (mainId,dstId)=>{
    const c=canLinkPost(mainId,dstId); if(!c.ok) return c;
    const A=findSessionById(mainId), B=findSessionById(dstId); const m=A.session, d=B.session;
    d.taskTypeId = TASK_DESMONT; d.materiales = []; d.inheritFromId=null;
    m.nextId = d.id; d.prevId = m.id; touch(); return {ok:true};
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


(function(){
  "use strict";
  const colorFor=(taskId)=> state.taskTypes.find(t=>t.id===taskId)?.color || "#60a5fa";
  const shortTag=(tid)=> tid===TASK_MONTAGE?"M":(tid===TASK_DESMONT?"D":"");

  window.buildGantt=(cont,persons)=>{
    cont.innerHTML="";
    const wrap=el("div","gwrap");
    const head=el("div","gantt-header"); head.appendChild(el("div",null,"Persona"));
    const hours=el("div","gantt-hours"); for(let h=0;h<24;h++) hours.appendChild(el("div",null,String(h).padStart(2,"0")+":00"));
    head.appendChild(hours); wrap.appendChild(head);

    persons.forEach(p=>{
      const row=el("div","gantt-row");
      row.appendChild(el("div",null,p.nombre));
      const track=el("div","gantt-track");
      (state.sessions?.[p.id]||[]).forEach(s=>{
        const seg=el("div","seg");
        seg.style.left=((s.startMin/1440)*100)+"%";
        seg.style.width=(((s.endMin-s.startMin)/1440)*100)+"%";
        seg.style.background=colorFor(s.taskTypeId);
        const label=(state.taskTypes.find(t=>t.id===s.taskTypeId)?.nombre||"");
        seg.title=toHHMM(s.startMin)+"-"+toHHMM(s.endMin)+" · "+label;
        seg.appendChild(el("div","meta",(shortTag(s.taskTypeId)?shortTag(s.taskTypeId)+" · ":"")+label));
        track.appendChild(seg);
      });
      row.appendChild(track); wrap.appendChild(row);
    });
    cont.appendChild(wrap);
  };

  const toName = (id,arr,key="id",field="nombre")=> arr.find(x=>x[key]===id)?.[field]||"-";

  window.buildCards=(cont,persons)=>{
    cont.innerHTML="";
    const tools=el("div","row"); const pr=el("button","btn small","Imprimir"); pr.onclick=()=>window.print(); tools.appendChild(pr); cont.appendChild(tools);
    const list=el("div","cardlist");
    persons.forEach(p=>{
      const card=el("div","card"); card.appendChild(el("h4",null,p.nombre));
      const body=el("div");
      (state.sessions?.[p.id]||[]).forEach(s=>{
        const item=el("div","item");
        item.appendChild(el("div",null, toHHMM(s.startMin)+"–"+toHHMM(s.endMin)));
        item.appendChild(el("div",null, [ toName(s.taskTypeId,state.taskTypes), toName(s.locationId,state.locations) ].join(" · ")));
        body.appendChild(item);
        if(s.materiales?.length){
          const txt=s.materiales.map(m=> (toName(m.materialTypeId,state.materialTypes))+" x "+(m.cantidad||0)).join(", ");
          body.appendChild(el("div","mini","Materiales: "+txt));
        }
        if(s.comentario){ body.appendChild(el("div","mini","Notas: "+s.comentario)); }
      });
      card.appendChild(body); list.appendChild(card);
    });
    cont.appendChild(list);
  };

  window.buildSummary=(cont,persons)=>{
    cont.innerHTML="";
    const tbl=el("table"); const thead=el("thead"); const trh=el("tr");
    ["Persona","Acciones","Min totales","Por tarea"].forEach(h=>trh.appendChild(el("th",null,h))); thead.appendChild(trh); tbl.appendChild(thead);
    const tb=el("tbody");
    persons.forEach(p=>{
      const arr=(state.sessions?.[p.id]||[]); let mins=0; const byTask=new Map();
      arr.forEach(s=>{ const d=(s.endMin-s.startMin); mins+=d; const k=state.taskTypes.find(t=>t.id===s.taskTypeId)?.nombre||"Sin tarea"; byTask.set(k,(byTask.get(k)||0)+d); });
      const tr=el("tr");
      tr.appendChild(el("td",null,p.nombre)); tr.appendChild(el("td",null,String(arr.length))); tr.appendChild(el("td",null,String(mins)));
      tr.appendChild(el("td",null, Array.from(byTask.entries()).map(([k,v])=>k+": "+v+"m").join(" · ") || "-"));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); cont.appendChild(tbl);
  };
})();


(function(){
  "use strict";
  const autoGrow=(ta)=>{ ta.style.height="auto"; ta.style.height=(ta.scrollHeight)+"px"; };
  const lockChip=(txt)=>{ const d=el("div","lock-chip"); d.appendChild(el("span","ico","🔒")); d.appendChild(el("span",null,txt||"-")); return d; };

  const linkMode={active:false,kind:null,sourceId:null}; // kind: "prev" | "post"

  function banner(container){
    const b=el("div","toolbar");
    b.appendChild(el("span",null, linkMode.kind==="prev"?"Selecciona fila vacia para PRE (Montaje por defecto)":"Selecciona fila vacia para POST (Desmontaje por defecto)"));
    const cancel=el("button","btn danger small","Cancelar"); cancel.style.marginLeft=".5rem"; cancel.onclick=()=>{ linkMode.active=false; renderClient(); };
    b.appendChild(cancel); container.prepend(b);
  }

  window.renderVerticalEditor = (container,pid)=>{
    ensureLinkFields();
    container.innerHTML="";
    if(linkMode.active) banner(container);

    const list=getPersonSessions(pid);
    if(!list.length){ container.appendChild(el("div","mini","No hay acciones.")); return; }

    list.forEach((s,idx)=>{
      const row=el("div","vrow"); if(getSelected(pid)===idx) row.classList.add("selected");

      // En modo vinculo, permitir elegir fila vacia
      if(linkMode.active){
        row.classList.add("canlink");
        row.onclick=()=>{
          if(s.taskTypeId){ alert("Destino debe estar vacio"); return; }
          if(linkMode.kind==="prev"){ const r=setPrevLink(linkMode.sourceId,s.id); if(!r.ok){ alert(r.msg); return; } }
          else { const r=setPostLink(linkMode.sourceId,s.id); if(!r.ok){ alert(r.msg); return; } }
          linkMode.active=false; renderClient();
        };
      }

      // Selector/Eliminar
      const sel=el("div","selcell");
      const bSel=el("button","btn chip",String(idx+1)); bSel.title="Seleccionar"; bSel.onclick=(e)=>{ e.stopPropagation(); setSelected(pid,idx); renderVerticalEditor(container,pid); };
      const bDel=el("button","btn danger","X"); bDel.title="Eliminar"; bDel.onclick=(e)=>{ e.stopPropagation(); deleteAtIndex(pid,idx); renderVerticalEditor(container,pid); };
      sel.appendChild(bSel); sel.appendChild(bDel); row.appendChild(sel);

      // Horario
      const adjustTime=(delta)=>{
        const list=getPersonSessions(pid); if(!list[idx]) return;
        const step=Math.round(delta/5)*5; if(step===0) return;
        if(idx===0){
          const base=(state.horaInicial?.[pid] ?? list[0]?.startMin ?? 0);
          const next=Math.max(0, base+step);
          state.horaInicial[pid]=next;
          rebaseTo(pid,next);
          renderClient();
          return;
        }
        const prev=list[idx-1]; if(!prev) return;
        const prevDur=Math.max(5, (parseInt(prev.endMin||"0",10)||0) - (parseInt(prev.startMin||"0",10)||0));
        const newDur=prevDur+step; if(newDur<5) return;
        resizeSegment(pid, idx-1, newDur);
        renderClient();
      };
      const timeCell=el("div","time time-cell");
      const timeLabel=el("span","time-label", toHHMM(s.startMin)+"-"+toHHMM(s.endMin));
      const timeShift=el("span","time-shift");
      const timeUp=el("button","btn small","▲"); timeUp.onclick=(e)=>{ e.stopPropagation(); adjustTime(5); };
      const timeDown=el("button","btn small","▼"); timeDown.onclick=(e)=>{ e.stopPropagation(); adjustTime(-5); };
      timeShift.appendChild(timeUp); timeShift.appendChild(timeDown);
      timeCell.appendChild(timeLabel); timeCell.appendChild(timeShift);
      row.appendChild(timeCell);


// Duracion
const ddiv=el("div","param duration-cell"); ddiv.innerHTML="<label>Duracion (min)</label>";
const din=el("input","input"); din.type="number"; din.min="5"; din.step="5"; din.value=String((s.endMin-s.startMin));
const doResize=(delta)=>{
  const cur=(s.endMin-s.startMin);
  const nd=Math.max(5, Math.round((cur+delta)/5)*5);
  resizeSegment(pid, idx, nd);
  renderVerticalEditor(container,pid);
};
din.onchange=()=>{ const v=Math.max(5,Math.round((parseInt(din.value||"15",10)||15)/5)*5); resizeSegment(pid,idx,v); renderVerticalEditor(container,pid); };
const box=el("span","time-adjust");
const up=el("button","btn small","▲"); up.onclick=(e)=>{ e.stopPropagation(); doResize(5); };
const dn=el("button","btn small","▼"); dn.onclick=(e)=>{ e.stopPropagation(); doResize(-5); };
box.appendChild(up); box.appendChild(dn);
ddiv.appendChild(din); ddiv.appendChild(box);
row.appendChild(ddiv);

      // Tarea
      const tdiv=el("div","param task-cell"); tdiv.innerHTML="<label>Tarea</label>";
      const tsel=el("select","input"); const t0=el("option",null,"- seleccionar -"); t0.value=""; tsel.appendChild(t0);
      const allowMont=!!s.nextId; const allowDesm=!!s.prevId;
      state.taskTypes.forEach(t=>{
        const isM=t.id===TASK_MONTAGE, isD=t.id===TASK_DESMONT;
        if(isM && !allowMont) return;
        if(isD && !allowDesm) return;
        const o=el("option",null,t.nombre); o.value=t.id; if(t.id===s.taskTypeId) o.selected=true; tsel.appendChild(o);
      });
      tsel.onchange=()=>{
        const v=tsel.value||null;
        if(v===TASK_MONTAGE && !allowMont){ alert("Montaje solo si la fila es PRE de otra."); tsel.value=s.taskTypeId||""; return; }
        if(v===TASK_DESMONT && !allowDesm){ alert("Desmontaje solo si la fila es POST de otra."); tsel.value=s.taskTypeId||""; return; }
        s.taskTypeId=v;
        if(v===TASK_MONTAGE && s.nextId){
          const target=findSessionById(s.nextId)?.session;
          s.inheritFromId=s.nextId;
          s.materiales=(target?.materiales||[]).map(m=>({materialTypeId:m.materialTypeId,cantidad:Number(m.cantidad||0)}));
        }else{
          s.inheritFromId=null;
        }
        if(v!==TASK_TRANSP){ s.vehicleId=null; }
        touch(); renderVerticalEditor(container,pid);
      };
      tdiv.appendChild(tsel); row.appendChild(tdiv);

      // Localización (bloqueada salvo primera o transporte)
      const ldiv=el("div","param location-cell");
      if(idx===0 && s.taskTypeId!==TASK_TRANSP){
        ldiv.innerHTML="<label>Localizacion inicial</label>";
        const lsel=el("select","input"); const l0=el("option",null,"- seleccionar -"); l0.value=""; lsel.appendChild(l0);
        state.locations.forEach(l=>{ const o=el("option",null,l.nombre); o.value=l.id; if(l.id===s.locationId) o.selected=true; lsel.appendChild(o); });
        lsel.onchange=()=>{ s.locationId=lsel.value||null; recomputeLocations(pid); touch(); renderVerticalEditor(container,pid); };
        ldiv.appendChild(lsel);
      }else if(s.taskTypeId===TASK_TRANSP){
        ldiv.innerHTML="<label>Destino</label>";
        const lsel=el("select","input"); const l0=el("option",null,"- seleccionar -"); l0.value=""; lsel.appendChild(l0);
        state.locations.forEach(l=>{ const o=el("option",null,l.nombre); o.value=l.id; if(l.id===s.locationId) o.selected=true; lsel.appendChild(o); });
        lsel.onchange=()=>{ s.locationId=lsel.value||null; recomputeLocations(pid); touch(); renderVerticalEditor(container,pid); };
        ldiv.appendChild(lsel);
      }else{
        const name=state.locations.find(x=>x.id===s.locationId)?.nombre || "-";
        ldiv.appendChild(lockChip(name));
      }
      row.appendChild(ldiv);

      // Vehiculo (solo Transporte)
      const vdiv=el("div","param vehicle-cell"); vdiv.innerHTML="<label>Vehiculo</label>";
      if(s.taskTypeId===TASK_TRANSP){
        const vsel=el("select","input"); const v0=el("option",null,"- seleccionar -"); v0.value=""; vsel.appendChild(v0);
        state.vehicles.forEach(v=>{ const o=el("option",null,v.nombre); o.value=v.id; if(v.id===s.vehicleId) o.selected=true; vsel.appendChild(o); });
        if(!s.vehicleId){ const def=state.vehicles.find(v=>v.id==="V_WALK")?.id; if(def) s.vehicleId=def; }
        vsel.onchange=()=>{ s.vehicleId=vsel.value||null; touch(); };
        vdiv.appendChild(vsel);
      }else vdiv.appendChild(lockChip("No aplica"));
      row.appendChild(vdiv);

      // Materiales + Vínculos
      const mdiv=el("div","param materials-cell"); mdiv.innerHTML="<label>Materiales</label>";
      const bar=el("div","row");
      const bPrev=el("button","btn small","◀ Vincular PRE"); bPrev.onclick=(e)=>{ e.stopPropagation(); linkMode.active=true; linkMode.kind="prev"; linkMode.sourceId=s.id; renderClient(); };
      const bPost=el("button","btn small","Vincular POST ▶"); bPost.onclick=(e)=>{ e.stopPropagation(); linkMode.active=true; linkMode.kind="post"; linkMode.sourceId=s.id; renderClient(); };
      bar.appendChild(bPrev); bar.appendChild(bPost); mdiv.appendChild(bar);

      const chips=el("div","mini");
      if(s.prevId){
        const info=findSessionById(s.prevId); const tag=info? ("Previo: "+info.pid+" · #"+(info.index+1)) : ("Previo: "+s.prevId);
        chips.appendChild(el("span",null,tag+" "));
        const x=el("button","btn danger small","✕"); x.onclick=(e)=>{ e.stopPropagation(); clearPrevLink(s.id); renderClient(); }; chips.appendChild(x);
      }
      if(s.nextId){
        const info=findSessionById(s.nextId); const tag=info? ("Post: "+info.pid+" · #"+(info.index+1)) : ("Post: "+s.nextId);
        chips.appendChild(el("span",null," "+tag+" "));
        const x=el("button","btn danger small","✕"); x.onclick=(e)=>{ e.stopPropagation(); clearPostLink(s.id); renderClient(); }; chips.appendChild(x);
        // si soy PRE Montaje, permitir resync
        if(s.taskTypeId===TASK_MONTAGE){
          const r=el("button","btn small","⟳"); r.title="Re-sincronizar materiales del principal"; r.onclick=(e)=>{ e.stopPropagation(); resyncPrevMaterials(s.id); renderClient(); }; chips.appendChild(r);
        }
      }
      if(s.prevId||s.nextId) mdiv.appendChild(chips);

      const selected = (getSelected(pid)===idx);
      if(selected){
        const add=el("div","row");
        const msel=el("select","input"); const m0=el("option",null, state.materialTypes.length? "- seleccionar -" : "No hay materiales (usar Catalogo)"); m0.value=""; msel.appendChild(m0);
        state.materialTypes.forEach(m=>{ if(!(s.materiales||[]).some(x=>x.materialTypeId===m.id)){ const o=el("option",null,m.nombre); o.value=m.id; msel.appendChild(o); } });
        const q=el("input","input"); q.type="number"; q.min="0"; q.step="1"; q.placeholder="1";
        const addB=el("button","btn small","Añadir");
        const doAdd=()=>{ const id=msel.value; let n=parseInt(q.value||"1",10); if(!id){ alert("Selecciona un material"); return; } if(!Number.isInteger(n)||n<0) n=1;
          s.materiales=s.materiales||[]; const ex=s.materiales.find(mm=>mm.materialTypeId===id);
          if(ex){ ex.cantidad=(parseInt(ex.cantidad||"0",10)||0)+n; } else { s.materiales.push({materialTypeId:id,cantidad:n}); }
          touch(); renderVerticalEditor(container,pid);
        };
        addB.onclick=(e)=>{ e.stopPropagation(); doAdd(); }; q.onkeydown=(e)=>{ if(e.key==="Enter"){ e.preventDefault(); doAdd(); } };
        add.appendChild(msel); add.appendChild(q); add.appendChild(addB); mdiv.appendChild(add);

        const tbl=el("table","matlist"); const thead=el("thead"); const hr=el("tr");
        ["Material","Cantidad","Acciones"].forEach(h=>hr.appendChild(el("th",null,h))); thead.appendChild(hr); tbl.appendChild(thead);
        const tb=el("tbody");
        const inc=(id)=>{ const it=s.materiales.find(x=>x.materialTypeId===id); if(!it) return; it.cantidad=(parseInt(it.cantidad||"0",10)||0)+1; touch(); renderVerticalEditor(container,pid); };
        const dec=(id)=>{ const it=s.materiales.find(x=>x.materialTypeId===id); if(!it) return; const v=(parseInt(it.cantidad||"0",10)||0)-1; if(v<=0){ s.materiales=s.materiales.filter(x=>x.materialTypeId!==id); } else { it.cantidad=v; } touch(); renderVerticalEditor(container,pid); };
        const del=(id)=>{ s.materiales=s.materiales.filter(x=>x.materialTypeId!==id); touch(); renderVerticalEditor(container,pid); };
        (s.materiales||[]).forEach(m=>{
          const tr=el("tr");
          tr.appendChild(el("td",null, state.materialTypes.find(mt=>mt.id===m.materialTypeId)?.nombre || "Material"));
          tr.appendChild(el("td","qty", String(parseInt(m.cantidad||"0",10)||0)));
          const act=el("td","act"); const p=el("button","iconbtn","+"); p.onclick=(e)=>{ e.stopPropagation(); inc(m.materialTypeId); };
          const r=el("button","iconbtn","-"); r.onclick=(e)=>{ e.stopPropagation(); dec(m.materialTypeId); };
          const d=el("button","iconbtn","Eliminar"); d.onclick=(e)=>{ e.stopPropagation(); del(m.materialTypeId); };
          act.appendChild(p); act.appendChild(r); act.appendChild(d); tr.appendChild(act); tb.appendChild(tr);
        });
        if(!(s.materiales||[]).length){ const tr=el("tr"); const td=el("td"); td.colSpan=3; td.textContent="Sin materiales"; tr.appendChild(td); tb.appendChild(tr); }
        tbl.appendChild(tb); mdiv.appendChild(tbl);
      }else{
        const txt=(s.materiales||[]).map(m=> (state.materialTypes.find(mt=>mt.id===m.materialTypeId)?.nombre||"Material")+" x "+(parseInt(m.cantidad||"0",10)||0)).join(", ");
        mdiv.appendChild(el("div","mini", txt||"Sin materiales"));
      }
      row.appendChild(mdiv);

      // Notas
      const ndiv=el("div","param notes-cell"); ndiv.innerHTML="<label>Notas</label>";
      const ta=el("textarea","input"); ta.rows=3; ta.value=String(s.comentario||""); ta.placeholder="Comentarios de la accion";
      ta.oninput=()=>{ s.comentario=ta.value; touch(); autoGrow(ta); };
      setTimeout(()=>autoGrow(ta),0); ndiv.appendChild(ta); row.appendChild(ndiv);

      container.appendChild(row);
    });

    document.onkeydown=(e)=>{ if(e.key==="Escape" && linkMode.active){ linkMode.active=false; renderClient(); } };
  };

  // Render de vista completo (toolbar mínima incluida)
  window.renderClient = ()=>{
    const pid = (state.project.view.lastTab==="CLIENTE" || !state.project.view.lastTab)? "CLIENTE" : state.project.view.lastTab;
    const root=$("#clienteView"); if(!root) return;
    root.innerHTML="";
    const bar=el("div","toolbar");
    const lbl=el("span","mini","Hora inicio"); const ti=el("input","input"); ti.type="time";
    ti.value = toHHMM(state.horaInicial?.[pid] ?? 9*60);
    ti.onchange=()=>{ state.horaInicial[pid]=toMin(ti.value||"09:00"); rebaseTo(pid,state.horaInicial[pid]); renderClient(); };
    const add=el("button","btn primary","Crear accion");
    add.onclick=()=>{ const idx=getSelected(pid); addAfterIndex(pid, (idx==null? -1: idx), 15); renderClient(); };
    bar.appendChild(lbl); bar.appendChild(ti); bar.appendChild(add); root.appendChild(bar);

    const v=el("div","vlist"); root.appendChild(v);
    renderVerticalEditor(v,pid);
  };
})();



(function(){
  "use strict";
  function emitChanged(){ document.dispatchEvent(new Event("catalogs-changed")); touch(); }

  function lockMark(tr, locked){ if(!locked) return; tr.setAttribute("data-locked","true"); tr.querySelectorAll("button,input,select").forEach(n=>{ if(n.tagName==="BUTTON" && /eliminar/i.test(n.textContent||"")) n.disabled=true; else if(n.tagName!=="BUTTON") n.disabled=true; }); }

  window.openCatLoc = (cont)=>{
    cont.innerHTML=""; cont.appendChild(el("h3",null,"Catálogo: Localizaciones"));
    const add=el("div","row");
    const name=el("input","input"); name.placeholder="Nombre";
    const latlng=el("input","input"); latlng.placeholder="lat,long";
    const b=el("button","btn","Añadir");
    b.onclick=()=>{
      const n=name.value.trim(); const ll=(latlng.value||"").split(",").map(s=>s.trim());
      if(!n) return;
      state.locations.push({id:"L_"+(state.locations.length+1), nombre:n, lat:ll[0]||"", lng:ll[1]||""});
      name.value=""; latlng.value=""; emitChanged(); openCatLoc(cont);
    };
    add.appendChild(name); add.appendChild(latlng); add.appendChild(b); cont.appendChild(add);

    const tbl=el("table"); const tb=el("tbody"); tbl.appendChild(tb);
    state.locations.forEach((l,i)=>{
      const tr=el("tr");
      const n=el("input","input"); n.value=l.nombre; n.oninput=()=>{ l.nombre=n.value; touch(); };
      const ll=el("input","input"); ll.value=(l.lat||"")+","+(l.lng||""); ll.oninput=()=>{ const sp=(ll.value||"").split(","); l.lat=(sp[0]||"").trim(); l.lng=(sp[1]||"").trim(); touch(); };
      const del=el("button","btn danger","Eliminar"); del.onclick=()=>{ state.locations.splice(i,1); emitChanged(); openCatLoc(cont); };
      tr.appendChild(n); tr.appendChild(ll); tr.appendChild(del); tb.appendChild(tr);
    });
    cont.appendChild(tbl);
  };

  window.openCatTask = (cont)=>{
    cont.innerHTML=""; cont.appendChild(el("h3",null,"Catálogo: Tareas"));
    const add=el("div","row");
    const name=el("input","input"); name.placeholder="Nombre";
    const color=el("input","input"); color.type="color"; color.value="#60a5fa";
    const b=el("button","btn","Añadir");
    b.onclick=()=>{
      const n=name.value.trim(); if(!n) return;
      state.taskTypes.push({id:"T_"+(state.taskTypes.length+1), nombre:n, color:color.value||"#60a5fa", locked:false});
      name.value=""; emitChanged(); openCatTask(cont);
    };
    add.appendChild(name); add.appendChild(color); add.appendChild(b); cont.appendChild(add);

    // Lista
    const tbl=el("table"); const tb=el("tbody"); tbl.appendChild(tb);
    // Orden: bloqueados primero
    const order=id=>({[TASK_TRANSP]:0,[TASK_MONTAGE]:1,[TASK_DESMONT]:2}[id]??9);
    [...state.taskTypes].sort((a,b)=> (a.locked===b.locked? order(a.id)-order(b.id) : (a.locked?-1:1)) || (a.nombre||"").localeCompare(b.nombre||"") )
      .forEach((t,idx)=>{
        const i= state.taskTypes.findIndex(x=>x.id===t.id);
        const tr=el("tr");
        const n=el("input","input"); n.value=t.nombre; n.oninput=()=>{ t.nombre=n.value; touch(); };
        const c=el("input","input"); c.type="color"; c.value=t.color||"#60a5fa"; c.oninput=()=>{ t.color=c.value; touch(); };
        const del=el("button","btn danger","Eliminar"); del.onclick=()=>{ state.taskTypes.splice(i,1); emitChanged(); openCatTask(cont); };
        tr.appendChild(n); tr.appendChild(c); tr.appendChild(del); tb.appendChild(tr);
        lockMark(tr, !!t.locked);
      });
    cont.appendChild(tbl);
  };

  window.openCatMat = (cont)=>{
    cont.innerHTML=""; cont.appendChild(el("h3",null,"Catálogo: Materiales"));
    const add=el("div","row");
    const name=el("input","input"); name.placeholder="Nombre";
    const b=el("button","btn","Añadir");
    b.onclick=()=>{
      const n=name.value.trim(); if(!n) return;
      state.materialTypes.push({id:"MT_"+(state.materialTypes.length+1), nombre:n});
      name.value=""; emitChanged(); openCatMat(cont);
    };
    add.appendChild(name); add.appendChild(b); cont.appendChild(add);

    const tbl=el("table"); const tb=el("tbody"); tbl.appendChild(tb);
    state.materialTypes.forEach((t,i)=>{
      const tr=el("tr");
      const n=el("input","input"); n.value=t.nombre; n.oninput=()=>{ t.nombre=n.value; touch(); };
      const del=el("button","btn danger","Eliminar"); del.onclick=()=>{ state.materialTypes.splice(i,1); emitChanged(); openCatMat(cont); };
      tr.appendChild(n); tr.appendChild(del); tb.appendChild(tr);
    });
    cont.appendChild(tbl);
  };

  window.openCatVeh = (cont)=>{
    cont.innerHTML=""; cont.appendChild(el("h3",null,"Catálogo: Vehículos"));
    const add=el("div","row");
    const name=el("input","input"); name.placeholder="Nombre";
    const b=el("button","btn","Añadir");
    b.onclick=()=>{ const n=name.value.trim(); if(!n) return; state.vehicles.push({id:"V_"+(state.vehicles.length+1), nombre:n, locked:false}); name.value=""; emitChanged(); openCatVeh(cont); };
    add.appendChild(name); add.appendChild(b); cont.appendChild(add);

    const tbl=el("table"); const tb=el("tbody"); tbl.appendChild(tb);
    [...state.vehicles].sort((a,b)=> (a.locked===b.locked?0:(a.locked?-1:1)) || (a.nombre||"").localeCompare(b.nombre||""))
      .forEach((v,idx)=>{
        const i= state.vehicles.findIndex(x=>x.id===v.id);
        const tr=el("tr");
        const n=el("input","input"); n.value=v.nombre; n.oninput=()=>{ v.nombre=n.value; touch(); };
        const del=el("button","btn danger","Eliminar"); del.onclick=()=>{ state.vehicles.splice(i,1); emitChanged(); openCatVeh(cont); };
        tr.appendChild(n); tr.appendChild(del); tb.appendChild(tr);
        lockMark(tr, !!v.locked);
      });
    cont.appendChild(tbl);
  };
})();


(function(){
  "use strict";
  function allPersons(){ return ["CLIENTE", ...(state.staff||[]).map(s=>s.id)]; }
  function collectTotals(){
    const map=new Map();
    allPersons().forEach(pid=>{
      (state.sessions?.[pid]||[]).forEach(s=>{
        (s.materiales||[]).forEach(m=>{
          const key=m.materialTypeId;
          map.set(key,(map.get(key)||0)+Number(m.cantidad||0));
        });
      });
    });
    return map;
  }
  window.renderMateriales = (cont)=>{
    cont.innerHTML="";
    const totals=collectTotals();
    const tbl=el("table"); const thead=el("thead"); const trh=el("tr");
    ["Material","Total"].forEach(h=>trh.appendChild(el("th",null,h))); thead.appendChild(trh); tbl.appendChild(thead);
    const tb=el("tbody");
    const entries = Array.from(totals.entries());
    if(!entries.length){ const tr=el("tr"); const td=el("td"); td.colSpan=2; td.textContent="Sin materiales"; tr.appendChild(td); tb.appendChild(tr); }
    entries.forEach(([id,q])=>{
      const tr=el("tr");
      tr.appendChild(el("td",null, state.materialTypes.find(mt=>mt.id===id)?.nombre||"Material"));
      tr.appendChild(el("td",null, String(q)));
      tb.appendChild(tr);
    });
    tbl.appendChild(tb); cont.appendChild(tbl);
  };
  window.exportCSV = ()=>{
    const totals = (function(){
      const map=new Map();
      ["CLIENTE", ...(state.staff||[]).map(s=>s.id)].forEach(pid=>{
        (state.sessions?.[pid]||[]).forEach(s=>{
          (s.materiales||[]).forEach(m=>{
            map.set(m.materialTypeId,(map.get(m.materialTypeId)||0)+Number(m.cantidad||0));
          });
        });
      });
      return map;
    })();
    const rows=[["Material","Total"]];
    Array.from(totals.entries()).forEach(([id,q])=> rows.push([state.materialTypes.find(mt=>mt.id===id)?.nombre||"Material", String(q)]));
    const csv = rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    const a=document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="materiales.csv"; a.click();
  };
})();


(function(){
  "use strict";
  window.setupMap=(cont)=>{
    cont.innerHTML="";
    cont.appendChild(el("div","mini","Mapa no conectado. Muestra aquí un esquema de localizaciones."));
    const ul=el("ul");
    state.locations.forEach(l=>{
      ul.appendChild(el("li",null, (l.nombre||"-")+"  ["+(l.lat||"?")+","+(l.lng||"?")+"]"));
    });
    cont.appendChild(ul);
  };
})();


(function(){
  "use strict";
  const clienteMeta={id:"CLIENTE",nombre:"Cliente",rol:"CLIENTE"};
  function showOnly(id){
    ["clienteView","catalogView","resultView"].forEach(v=>{ const n=document.getElementById(v); if(n) n.style.display=(v===id)?"":"none"; });
  }
  function personTabs(){
    const tabs=document.getElementById("personTabs");
    if(!tabs) return;
    tabs.innerHTML="";
    const mk=(p,isActive)=>{
      const b=el("button","tab"+(isActive?" active":""), p.nombre);
      b.dataset.pid=p.id;
      b.onclick=()=>{ state.project.view.lastTab=p.id; renderClient(); personTabs(); };
      tabs.appendChild(b);
    };
    const activeId = (state.project.view.lastTab==="CLIENTE"||state.project.view.lastTab==="cliente") ? "CLIENTE" : state.project.view.lastTab;
    mk(clienteMeta, activeId==="CLIENTE");
    (state.staff||[]).forEach(s=> mk(s, activeId===s.id));
  }
  function renderStatus(){
    const t=state.project.updatedAt?new Date(state.project.updatedAt).toLocaleTimeString():"nunca";
    const elSt=document.getElementById("status"); if(elSt) elSt.textContent="Guardado "+t+" • "+(state.project.nombre||"");
  }
  setOnTouched(renderStatus);

  window.renderClient = window.renderClient || function(){};
  const renderStaffList=()=>{
    const box=document.getElementById("staffList"); if(!box) return; box.innerHTML=""; box.className="stafflist";
    state.staff.forEach(p=>{
      const chip=el("div","staffchip");
      const nameEl = el("span",null,p.nombre);
      nameEl.style.cursor="pointer";
      nameEl.onclick=()=>{ state.project.view.lastTab=p.id; renderClient(); personTabs(); };
      chip.appendChild(nameEl);
      const del=el("button","del","X"); del.title="Eliminar"; del.onclick=()=>{ if((state.sessions?.[p.id]||[]).length){ alert("No se puede eliminar: tiene acciones."); return; } state.staff=state.staff.filter(x=>x.id!==p.id); touch(); personTabs(); renderClient(); renderStaffList(); };
      chip.appendChild(del); box.appendChild(chip);
    });
  };

  function openCatalog(which){
    showOnly("catalogView");
    const cont=document.getElementById("catalogView"); cont.innerHTML="";
    cont.appendChild(el("h3",null,"Catálogos"));
    if(which==="loc") openCatLoc(cont);
    if(which==="task") openCatTask(cont);
    if(which==="mat") openCatMat(cont);
    if(which==="veh") openCatVeh(cont);
  }

  function renderResults(tab){
    showOnly("resultView");
    const g=document.getElementById("ganttView"), m=document.getElementById("matsView"), c=document.getElementById("mapCanvas");
    g.style.display=m.style.display=c.style.display="none";
    if(tab==="gantt"){
      g.style.display=""; g.innerHTML="";
      const subt=el("div","subtabs"); const views=["Gantt","Tarjeta","Resumen"]; let active=state.project.view.subGantt||"Gantt";
      const setA=(v)=>{ active=v; state.project.view.subGantt=v; touch(); draw(); };
      views.forEach(v=>{ const b=el("button","subtab"+(v===active?" active":""),v); b.onclick=()=>setA(v); subt.appendChild(b); });
      g.appendChild(subt); const host=el("div"); g.appendChild(host);
      function draw(){
        host.innerHTML="";
        const persons=[clienteMeta,...state.staff];
        if(active==="Gantt") buildGantt(host,persons);
        if(active==="Tarjeta") buildCards(host,persons);
        if(active==="Resumen") buildSummary(host,persons);
        Array.from(subt.children).forEach(b=>b.classList.toggle("active", b.textContent===active));
      }
      draw();
    }
    if(tab==="mats"){ m.style.display=""; renderMateriales(m); const b=el("button","btn small","Exportar CSV"); b.onclick=exportCSV; m.prepend(b); }
    if(tab==="map"){ c.style.display=""; setupMap(c); }
  }

  function rehydrateSelects(){
    const catVisible = (document.getElementById("catalogView")?.style.display!=="none");
    if(catVisible) return;
    renderClient();
  }

  function wire(){
    const $id=(x)=>document.getElementById(x);
    const o=$id("openFile"); if(o) o.onchange=(e)=>{ const f=e.target.files?.[0]; if(f) importJSONFile(f,()=>{ ensureDefaults(); ensureLinkFields(); personTabs(); renderClient(); renderStatus(); renderStaffList(); }); };
    const nb=$id("newBtn"); if(nb) nb.onclick=()=>{ localStorage.clear(); location.reload(); };
    const sb=$id("saveBtn"); if(sb) sb.onclick=exportJSON;

    const pN=$id("pNombre"), pF=$id("pFecha"), pT=$id("pTz");
    if(pN) pN.oninput=(e)=>{ state.project.nombre=e.target.value; touch(); };
    if(pF) pF.oninput=(e)=>{ state.project.fecha=e.target.value; touch(); };
    if(pT) pT.oninput=(e)=>{ state.project.tz=e.target.value; touch(); };

    const addS=$id("addStaff"), newS=$id("newStaff");
    if(addS) addS.onclick=()=>{ const n=(newS?.value||"").trim(); if(!n) return; const id="P_"+(state.staff.length+1); state.staff.push({id,nombre:n,rol:"STAFF"}); if(newS) newS.value=""; touch(); personTabs(); renderClient(); renderStaffList(); };

    const c1=$id("catLoc"), c2=$id("catTask"), c3=$id("catMat"), c4=$id("catVeh");
    if(c1) c1.onclick=()=>openCatalog("loc");
    if(c2) c2.onclick=()=>openCatalog("task");
    if(c3) c3.onclick=()=>openCatalog("mat");
    if(c4) c4.onclick=()=>openCatalog("veh");

    const r1=$id("resGantt"), r2=$id("resMats"), r3=$id("resMap");
    if(r1) r1.onclick=()=>renderResults("gantt");
    if(r2) r2.onclick=()=>renderResults("mats");
    if(r3) r3.onclick=()=>renderResults("map");

    document.addEventListener("catalogs-changed",rehydrateSelects);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    try{
      const raw=localStorage.getItem("eventplan.autosave"); if(raw){ const obj=JSON.parse(raw); if(obj&&obj.project) Object.assign(state,obj); }
    }catch(e){}
    ensureDefaults(); ensureLinkFields();
    const pN=document.getElementById("pNombre"); if(pN) pN.value=state.project.nombre||"";
    const pF=document.getElementById("pFecha"); if(pF) pF.value=state.project.fecha||"";
    const pT=document.getElementById("pTz"); if(pT) pT.value=state.project.tz||"Europe/Madrid";
    personTabs(); renderClient(); renderStatus(); renderStaffList(); wire();
    showOnly("clienteView");
  });
})();

