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
    const first=list[0];
    if(first && first.taskTypeId===TASK_TRANSP){
      first.taskTypeId=null;
      first.vehicleId=null;
      recomputeLocations(pid);
      touch();
    }
    if(!list.length){ container.appendChild(el("div","mini","No hay acciones.")); return; }

    const computeTransportFlow=(targetIdx)=>{
      let cur=null;
      for(let i=0;i<list.length;i++){
        const item=list[i];
        if(i===targetIdx){
          return {origin:cur,destination:item.locationId||cur};
        }
        if(i===0 && item.taskTypeId!==TASK_TRANSP){
          cur=item.locationId||cur;
          continue;
        }
        if(item.taskTypeId===TASK_TRANSP){
          const dest=item.locationId||cur;
          cur=dest;
        }else{
          cur=item.locationId||cur;
        }
      }
      const fallback=list[targetIdx];
      return {origin:cur,destination:fallback?.locationId||cur};
    };

    list.forEach((s,idx)=>{
      const row=el("div","vrow"); if(getSelected(pid)===idx) row.classList.add("selected");

      if(linkMode.active){
        row.classList.add("canlink");
        row.onclick=()=>{
          let result;
          if(linkMode.kind==="prev"){ result=setPrevLink(linkMode.sourceId,s.id); }
          else { result=setPostLink(linkMode.sourceId,s.id); }
          if(!result.ok){ alert(result.msg); return; }
          if(result.msg && window.flashStatus){ window.flashStatus(result.msg); }
          linkMode.active=false; renderClient();
        };
      }

      const sel=el("div","selcell");
      const header=el("div","slot-index");
      const bSel=el("button","btn chip",String(idx+1)); bSel.title="Seleccionar"; bSel.onclick=(e)=>{ e.stopPropagation(); setSelected(pid,idx); renderVerticalEditor(container,pid); };
      const bDel=el("button","btn danger icon","✕"); bDel.title="Eliminar"; bDel.onclick=(e)=>{ e.stopPropagation(); deleteAtIndex(pid,idx); renderClient(); };
      const range=el("span","time-range", toHHMM(s.startMin)+"-"+toHHMM(s.endMin));
      const timeAdjust=el("div","time-adjust");
      const doResize=(delta)=>{
        const cur=s.endMin-s.startMin;
        const target=Math.max(5, cur+delta);
        const nd=Math.max(5, Math.round(target/5)*5);
        if(nd===cur) return;
        resizeSegment(pid, idx, nd);
        renderVerticalEditor(container,pid);
      };
      const plus=el("button","icon-btn","+"); plus.title="Aumentar duracion"; plus.onclick=(e)=>{ e.stopPropagation(); doResize(5); };
      const minus=el("button","icon-btn","−"); minus.title="Reducir duracion"; minus.onclick=(e)=>{ e.stopPropagation(); doResize(-5); };
      timeAdjust.appendChild(plus); timeAdjust.appendChild(minus);
      const timeDisplay=el("div","time-display");
      const timeMain=el("div","time-main");
      timeMain.appendChild(range); timeMain.appendChild(timeAdjust);
      timeDisplay.appendChild(timeMain);
      const durationHint=el("div","duration-hint","Duración: "+String(s.endMin-s.startMin)+" min");
      timeDisplay.appendChild(durationHint);
      header.appendChild(bSel); header.appendChild(bDel); header.appendChild(timeDisplay);
      sel.appendChild(header);

      const timeTools=el("div","time-tools");
      const linkHints=el("div","link-hints");
      const formatSessionLabel=(info,fallback)=> info? `${info.pid} · #${info.index+1}` : (fallback? `#${fallback}` : "#?");
      const selfInfo={pid,index:idx,session:s};
      const addLinkHint=(label,text,onRemove,extra=[])=>{
        const wrap=el("div","duration-hint link-hint");
        wrap.appendChild(el("span",null,`${label}: ${text}`));
        extra.forEach(btn=>wrap.appendChild(btn));
        const close=el("button","btn danger small","✕"); close.title="Quitar vinculo"; close.onclick=(e)=>{ e.stopPropagation(); onRemove(); };
        wrap.appendChild(close);
        linkHints.appendChild(wrap);
      };
      if(s.prevId){
        const other=findSessionById(s.prevId);
        if(s.linkPrevRole==="pre-main"){
          addLinkHint("Vinculación PRE", `${formatSessionLabel(other,s.prevId)} → ${formatSessionLabel(selfInfo,s.id)}`, ()=>{ clearPrevLink(s.id); renderClient(); });
        }else if(s.linkPrevRole==="pre-target"){
          addLinkHint("Vinculación PRE", `${formatSessionLabel(selfInfo,s.id)} → ${formatSessionLabel(other,s.prevId)}`, ()=>{ clearPostLink(s.prevId); renderClient(); });
        }
      }
      if(s.nextId){
        const other=findSessionById(s.nextId);
        if(s.linkNextRole==="post-main"){
          addLinkHint("Vinculación POST", `${formatSessionLabel(selfInfo,s.id)} → ${formatSessionLabel(other,s.nextId)}`, ()=>{ clearPostLink(s.id); renderClient(); });
        }else if(s.linkNextRole==="post-target"){
          const extras=[];
          if(s.taskTypeId===TASK_MONTAGE){
            const r=el("button","icon-btn ghost","⟳"); r.title="Re-sincronizar materiales del principal"; r.onclick=(e)=>{ e.stopPropagation(); resyncPrevMaterials(s.id); renderClient(); }; extras.push(r);
          }
          addLinkHint("Vinculación POST", `${formatSessionLabel(other,s.nextId)} → ${formatSessionLabel(selfInfo,s.id)}`, ()=>{ clearPrevLink(s.nextId); renderClient(); }, extras);
        }
      }
      if(linkHints.childElementCount){
        timeTools.appendChild(linkHints);
        sel.appendChild(timeTools);
      }

      const linkWrap=el("div","link-controls under-slot");
      const bPrev=el("button","icon-btn ghost","◀"); bPrev.title="Vincular PRE"; bPrev.onclick=(e)=>{ e.stopPropagation(); linkMode.active=true; linkMode.kind="prev"; linkMode.sourceId=s.id; renderClient(); };
      const bPost=el("button","icon-btn ghost","▶"); bPost.title="Vincular POST"; bPost.onclick=(e)=>{ e.stopPropagation(); linkMode.active=true; linkMode.kind="post"; linkMode.sourceId=s.id; renderClient(); };
      linkWrap.appendChild(bPrev); linkWrap.appendChild(bPost);
      sel.appendChild(linkWrap);
      row.appendChild(sel);

      const tdiv=el("div","param task-cell"); tdiv.innerHTML="<label>Tarea</label>";
      const tsel=el("select","input"); const t0=el("option",null,"- seleccionar -"); t0.value=""; tsel.appendChild(t0);
      const allowMont=!!s.nextId; const allowDesm=!!s.prevId;
      state.taskTypes.forEach(t=>{
        const isM=t.id===TASK_MONTAGE, isD=t.id===TASK_DESMONT;
        if(isM && !allowMont) return;
        if(isD && !allowDesm) return;
        if(idx===0 && t.id===TASK_TRANSP) return;
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

      const ldiv=el("div","param location-cell");
      if(idx===0 && s.taskTypeId!==TASK_TRANSP){
        ldiv.innerHTML="<label>Localizacion inicial</label>";
        const name=state.locations.find(x=>x.id===s.locationId)?.nombre || "-";
        ldiv.appendChild(lockChip(name));
      }else if(s.taskTypeId===TASK_TRANSP){
        ldiv.classList.add("stacked");
        ldiv.innerHTML="<label>Destino</label>";
        const lsel=el("select","input"); const l0=el("option",null,"- seleccionar -"); l0.value=""; lsel.appendChild(l0);
        state.locations.forEach(l=>{ const o=el("option",null,l.nombre); o.value=l.id; if(l.id===s.locationId) o.selected=true; lsel.appendChild(o); });
        lsel.onchange=()=>{ s.locationId=lsel.value||null; recomputeLocations(pid); touch(); renderVerticalEditor(container,pid); };
        ldiv.appendChild(lsel);
        const flow=computeTransportFlow(idx);
        const originName=state.locations.find(x=>x.id===flow.origin)?.nombre || "-";
        const destName=state.locations.find(x=>x.id===flow.destination)?.nombre || "-";
        const flowText=`Origen → ${originName} · Destino → ${destName}`;
        ldiv.appendChild(el("div","duration-hint transport-flow",flowText));
      }else{
        const name=state.locations.find(x=>x.id===s.locationId)?.nombre || "-";
        ldiv.appendChild(lockChip(name));
      }
      row.appendChild(ldiv);

      const vdiv=el("div","param vehicle-cell"); vdiv.innerHTML="<label>Vehiculo</label>";
      if(s.taskTypeId===TASK_TRANSP){
        const vsel=el("select","input"); const v0=el("option",null,"- seleccionar -"); v0.value=""; vsel.appendChild(v0);
        state.vehicles.forEach(v=>{ const o=el("option",null,v.nombre); o.value=v.id; if(v.id===s.vehicleId) o.selected=true; vsel.appendChild(o); });
        if(!s.vehicleId){ const def=state.vehicles.find(v=>v.id==="V_WALK")?.id; if(def) s.vehicleId=def; }
        vsel.onchange=()=>{ s.vehicleId=vsel.value||null; touch(); };
        vdiv.appendChild(vsel);
      }else vdiv.appendChild(lockChip("No aplica"));
      row.appendChild(vdiv);

      const mdiv=el("div","param materials-cell");
      const mheader=el("div","materials-header");
      const mlabel=el("label",null,"Materiales");
      mheader.appendChild(mlabel); mdiv.appendChild(mheader);

      const selected = (getSelected(pid)===idx);
      if(selected){
        const add=el("div","materials-add");
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
          const act=el("td","act");
          const p=el("button","icon-btn ghost","+"); p.title="Sumar"; p.onclick=(e)=>{ e.stopPropagation(); inc(m.materialTypeId); };
          const r=el("button","icon-btn ghost","−"); r.title="Restar"; r.onclick=(e)=>{ e.stopPropagation(); dec(m.materialTypeId); };
          const d=el("button","icon-btn danger","✕"); d.title="Eliminar"; d.onclick=(e)=>{ e.stopPropagation(); del(m.materialTypeId); };
          act.appendChild(p); act.appendChild(r); act.appendChild(d); tr.appendChild(act); tb.appendChild(tr);
        });
        if(!(s.materiales||[]).length){ const tr=el("tr"); const td=el("td"); td.colSpan=3; td.textContent="Sin materiales"; tr.appendChild(td); tb.appendChild(tr); }
        tbl.appendChild(tb); mdiv.appendChild(tbl);
      }else{
        const txt=(s.materiales||[]).map(m=> (state.materialTypes.find(mt=>mt.id===m.materialTypeId)?.nombre||"Material")+" x "+(parseInt(m.cantidad||"0",10)||0)).join(", ");
        mdiv.appendChild(el("div","materials-summary", txt||"Sin materiales"));
      }
      row.appendChild(mdiv);

      const ndiv=el("div","param notes-cell");
      const nlabel=el("label",null,"Notas");
      const ta=el("textarea","input"); ta.rows=3; ta.value=String(s.comentario||""); ta.placeholder="Comentarios de la accion";
      ta.oninput=()=>{ s.comentario=ta.value; touch(); autoGrow(ta); };
      setTimeout(()=>autoGrow(ta),0); ndiv.appendChild(nlabel); ndiv.appendChild(ta); row.appendChild(ndiv);

      container.appendChild(row);
    });

    document.onkeydown=(e)=>{ if(e.key==="Escape" && linkMode.active){ linkMode.active=false; renderClient(); } };
  };
  // Render de vista completo (toolbar mínima incluida)
  window.renderClient = ()=>{
    const pid = (state.project.view.lastTab==="CLIENTE" || !state.project.view.lastTab)? "CLIENTE" : state.project.view.lastTab;
    const root=$("#clienteView"); if(!root) return;
    root.innerHTML="";
    const sessions=getPersonSessions(pid);
    state.localizacionInicial=state.localizacionInicial||{};
    const bar=el("div","toolbar");
    if(!sessions.length){
      const lbl=el("span","mini","Hora inicio");
      const ti=el("input","input"); ti.type="time";
      ti.value = toHHMM(state.horaInicial?.[pid] ?? 9*60);
      ti.onchange=()=>{
        state.horaInicial[pid]=toMin(ti.value||"09:00");
        if(sessions.length){
          rebaseTo(pid,state.horaInicial[pid]);
        }else{
          touch();
        }
        renderClient();
      };
      const lloc=el("span","mini","Localizacion inicio");
      const lsel=el("select","input");
      const l0=el("option",null,"- seleccionar -"); l0.value=""; lsel.appendChild(l0);
      const initialLoc=state.localizacionInicial?.[pid] ?? null;
      state.locations.forEach(l=>{ const o=el("option",null,l.nombre); o.value=l.id; if(l.id===initialLoc) o.selected=true; lsel.appendChild(o); });
      lsel.onchange=()=>{
        state.localizacionInicial[pid]=lsel.value||null;
        touch();
        renderClient();
      };
      bar.appendChild(lbl); bar.appendChild(ti); bar.appendChild(lloc); bar.appendChild(lsel);
    }
    const add=el("button","btn primary","Crear accion");
    add.onclick=()=>{ const idx=getSelected(pid); addAfterIndex(pid, (idx==null? -1: idx), 15); renderClient(); };
    bar.appendChild(add); root.appendChild(bar);

    const v=el("div","vlist"); root.appendChild(v);
    renderVerticalEditor(v,pid);
  };
})();

