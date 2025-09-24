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
      const n=name.value.trim();
      const raw=(latlng.value||"").trim();
      const parts=raw.split(",").map(s=>s.trim()).filter(Boolean);
      const lat=parts[0];
      const lng=parts[1];
      const latNum=Number(lat);
      const lngNum=Number(lng);
      if(!n) return;
      if(parts.length<2 || !lat || !lng || !Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum)>90 || Math.abs(lngNum)>180){
        latlng.classList.add("err");
        if(typeof flashStatus==="function") flashStatus("Introduce latitud y longitud válidas");
        return;
      }
      latlng.classList.remove("err");
      state.locations.push({id:"L_"+(state.locations.length+1), nombre:n, lat:lat, lng:lng});
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
    const tipo=el("select","input");
    [{value:"normal",label:"Normal"},{value:"transporte",label:"Transporte"}].forEach(opt=>{ const o=el("option",null,opt.label); o.value=opt.value; tipo.appendChild(o); });
    const owner=el("input","input"); owner.placeholder="Quién"; owner.value="CLIENTE";
    const color=el("input","input"); color.type="color"; color.value="#60a5fa";
    const b=el("button","btn","Añadir");
    b.onclick=()=>{
      const n=name.value.trim(); if(!n) return;
      const quien=(owner.value||"CLIENTE").trim();
      ensureActionCatalogEntry({nombre:n, tipo:tipo.value, quien, color:color.value||"#60a5fa"});
      name.value=""; owner.value="CLIENTE"; emitChanged(); openCatTask(cont);
    };
    add.appendChild(name); add.appendChild(tipo); add.appendChild(owner); add.appendChild(color); add.appendChild(b); cont.appendChild(add);

    const tbl=el("table");
    const thead=el("thead"); const thr=el("tr");
    ["Nombre","Tipo","Quién","Color","Acciones"].forEach(h=>thr.appendChild(el("th",null,h)));
    thead.appendChild(thr); tbl.appendChild(thead);
    const tb=el("tbody"); tbl.appendChild(tb);
    const order=id=>({[TASK_TRANSP]:0,[TASK_MONTAGE]:1,[TASK_DESMONT]:2}[id]??9);
    [...state.taskTypes].sort((a,b)=> (a.locked===b.locked? order(a.id)-order(b.id) : (a.locked?-1:1)) || (a.nombre||"").localeCompare(b.nombre||""))
      .forEach((t)=>{
        const i= state.taskTypes.findIndex(x=>x.id===t.id);
        const tr=el("tr");
        const n=el("input","input"); n.value=t.nombre||""; n.oninput=()=>{ t.nombre=n.value; touch(); };
        const sTipo=el("select","input");
        [{value:"normal",label:"Normal"},{value:"transporte",label:"Transporte"}].forEach(opt=>{ const o=el("option",null,opt.label); o.value=opt.value; if(opt.value===(t.tipo||"normal")) o.selected=true; sTipo.appendChild(o); });
        sTipo.onchange=()=>{ t.tipo=sTipo.value; touch(); };
        const q=el("input","input"); q.value=t.quien||""; q.placeholder="Quién"; q.oninput=()=>{ t.quien=q.value; touch(); };
        const c=el("input","input"); c.type="color"; c.value=t.color||"#60a5fa"; c.oninput=()=>{ t.color=c.value; touch(); };
        const del=el("button","btn danger","Eliminar"); del.onclick=()=>{ state.taskTypes.splice(i,1); emitChanged(); openCatTask(cont); };
        tr.appendChild(n); tr.appendChild(sTipo); tr.appendChild(q); tr.appendChild(c); tr.appendChild(del); tb.appendChild(tr);
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
