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
      row.appendChild(el("div","time", toHHMM(s.startMin)+"-"+toHHMM(s.endMin)));

      
// Duración
const ddiv=el("div","param");
ddiv.innerHTML="<label>Duracion (min)</label>";
const din=el("input","input");
din.type="number"; din.min="5"; din.step="5";
din.value=String((s.endMin-s.startMin));
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
      const tdiv=el("div","param"); tdiv.innerHTML="<label>Tarea</label>";
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
      const ldiv=el("div","param");
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
      const vdiv=el("div","param"); vdiv.innerHTML="<label>Vehiculo</label>";
      if(s.taskTypeId===TASK_TRANSP){
        const vsel=el("select","input"); const v0=el("option",null,"- seleccionar -"); v0.value=""; vsel.appendChild(v0);
        state.vehicles.forEach(v=>{ const o=el("option",null,v.nombre); o.value=v.id; if(v.id===s.vehicleId) o.selected=true; vsel.appendChild(o); });
        if(!s.vehicleId){ const def=state.vehicles.find(v=>v.id==="V_WALK")?.id; if(def) s.vehicleId=def; }
        vsel.onchange=()=>{ s.vehicleId=vsel.value||null; touch(); };
        vdiv.appendChild(vsel);
      }else vdiv.appendChild(lockChip("No aplica"));
      row.appendChild(vdiv);

      // Materiales + Vínculos
      const mdiv=el("div","param"); mdiv.innerHTML="<label>Materiales</label>";
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
      const ndiv=el("div","param"); ndiv.innerHTML="<label>Notas</label>";
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

