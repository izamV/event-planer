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
