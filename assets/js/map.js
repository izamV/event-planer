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
