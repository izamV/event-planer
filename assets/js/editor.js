(function(){
  "use strict";
  const autoGrow=(ta)=>{ ta.style.height="auto"; ta.style.height=(ta.scrollHeight)+"px"; };
  const lockChip=(txt)=>{ const d=el("div","lock-chip"); d.appendChild(el("span","ico","🔒")); d.appendChild(el("span",null,txt||"-")); return d; };

  window.renderVerticalEditor = (container,pid)=>{
    ensureSessionDefaults();
    container.innerHTML="";

    const list=getPersonSessions(pid);
    if(!list.length){ container.appendChild(el("div","mini","No hay acciones.")); return; }

    const computeTransportFlow=(targetIdx)=>{
      let cur=null;
      for(let i=0;i<list.length;i++){
        const item=list[i];
        if(i===targetIdx){
          return {origin:cur,destination:item.locationId||cur};
        }
        if(i===0 && !isTransportSession(item)){
          cur=item.locationId||cur;
          continue;
        }
        if(isTransportSession(item)){
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

      const sel=el("div","selcell");
      const header=el("div","slot-index");
      const bSel=el("button","btn chip",String(idx+1)); bSel.title="Seleccionar"; bSel.onclick=(e)=>{ e.stopPropagation(); setSelected(pid,idx); renderVerticalEditor(container,pid); };
      const bDel=el("button","btn danger icon","✕"); bDel.title="Eliminar"; bDel.onclick=(e)=>{ e.stopPropagation(); deleteAtIndex(pid,idx); renderVerticalEditor(container,pid); };
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
      row.appendChild(sel);

      const tdiv=el("div","param task-cell");
      const tlabel=el("label",null,"Tarea");
      tdiv.appendChild(tlabel);
      const nameInput=el("input","input");
      nameInput.placeholder="Nombre de la acción";
      nameInput.value=getSessionActionName(s);
      nameInput.oninput=()=>{ s.actionName=nameInput.value; };
      nameInput.onchange=()=>{
        s.actionName=nameInput.value.trim();
        ensureActionForSession(s,pid);
        recomputeLocations(pid);
        touch();
        renderVerticalEditor(container,pid);
      };
      tdiv.appendChild(nameInput);
      const typeWrap=el("div","task-type-selector");
      const makeTypeOption=(value,label)=>{
        const wrap=el("label","task-type-option");
        const radio=el("input"); radio.type="radio"; radio.name=`type_${pid}_${s.id}`; radio.value=value; radio.checked=(String(s.actionMode||"normal").toLowerCase()===value);
        radio.onchange=()=>{
          if(!radio.checked) return;
          s.actionMode=value;
          ensureActionForSession(s,pid);
          if(value!=="transporte"){ s.vehicleId=null; }
          recomputeLocations(pid);
          touch();
          renderVerticalEditor(container,pid);
        };
        wrap.appendChild(radio);
        wrap.appendChild(el("span",null,label));
        return wrap;
      };
      typeWrap.appendChild(makeTypeOption("normal","Normal"));
      typeWrap.appendChild(makeTypeOption("transporte","Transporte"));
      tdiv.appendChild(typeWrap);
      row.appendChild(tdiv);

      const ldiv=el("div","param location-cell");
      if(idx===0 && !isTransportSession(s)){
        ldiv.innerHTML="<label>Localizacion inicial</label>";
        const lsel=el("select","input"); const l0=el("option",null,"- seleccionar -"); l0.value=""; lsel.appendChild(l0);
        state.locations.forEach(l=>{ const o=el("option",null,l.nombre); o.value=l.id; if(l.id===s.locationId) o.selected=true; lsel.appendChild(o); });
        lsel.onchange=()=>{
          s.locationId=lsel.value||null; recomputeLocations(pid);
          state.localizacionInicial=state.localizacionInicial||{};
          state.localizacionInicial[pid]=s.locationId||null;
          touch();
          renderVerticalEditor(container,pid);
        };
        ldiv.appendChild(lsel);
      }else if(isTransportSession(s)){
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
      if(isTransportSession(s)){
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
      const items=s.materiales||[];
      if(items.length){
        const tbl=el("table","matlist");
        const thead=el("thead"); const hr=el("tr");
        ["Material","Cantidad"].forEach(h=>hr.appendChild(el("th",null,h)));
        thead.appendChild(hr); tbl.appendChild(thead);
        const tb=el("tbody");
        items.forEach(m=>{
          const tr=el("tr");
          tr.appendChild(el("td",null, state.materialTypes.find(mt=>mt.id===m.materialTypeId)?.nombre || "Material"));
          tr.appendChild(el("td","qty", String(parseInt(m.cantidad||"0",10)||0)));
          tb.appendChild(tr);
        });
        tbl.appendChild(tb); mdiv.appendChild(tbl);
      }else{
        mdiv.appendChild(el("div","materials-summary","Sin materiales"));
      }
      row.appendChild(mdiv);

      const ndiv=el("div","param notes-cell");
      const nlabel=el("label",null,"Notas");
      const ta=el("textarea","input"); ta.rows=3; ta.value=String(s.comentario||""); ta.placeholder="Comentarios de la accion";
      ta.oninput=()=>{ s.comentario=ta.value; touch(); autoGrow(ta); };
      setTimeout(()=>autoGrow(ta),0); ndiv.appendChild(nlabel); ndiv.appendChild(ta); row.appendChild(ndiv);

      container.appendChild(row);
    });
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

