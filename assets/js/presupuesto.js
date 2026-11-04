/* ABREGU STUDIOS | Presupuesto y rentabilidad | Supabase + respaldo local */
document.addEventListener("DOMContentLoaded", () => {
  "use strict";
  const $ = id => document.getElementById(id);
  const KEY = "aa_finanzas_v1";
  const IGV = 0.18;
  const TARIFAS_INICIALES = [
    ["Alquiler de set equipado (sin operador)", "hora", 140],
    ["Grabación multicámara", "hora", 250],
    ["Grabación multicámara (2 horas)", "sesión", 520],
    ["LIVE profesional completo (2 horas)", "sesión", 600],
    ["LIVE recurrente INTEPA (2 horas)", "sesión", 500],
    ["Hora adicional de LIVE", "hora", 250],
    ["Edición de reel sencillo", "pieza", 130],
    ["Edición de reel avanzado", "pieza", 250],
    ["Edición básica de podcast", "pieza", 260],
    ["Edición premium de podcast", "pieza", 450],
    ["Reel grabado y editado", "pieza", 320],
    ["Video comercial con guion", "pieza", 750],
    ["Jornada de grabación (3 horas)", "jornada", 950],
    ["Pack 3 overlays", "paquete", 250],
    ["Miniatura o portada", "pieza", 70],
    ["Paquete 4 reels mensuales", "paquete", 1500],
    ["Paquete 8 reels mensuales", "paquete", 2800],
    ["Paquete 12 reels mensuales", "paquete", 4500],
    ["Podcast mensual (4 sesiones de 2 h)", "paquete", 2900]
  ].map((x, i) => ({id: `tarifa-${i+1}`, nombre: x[0], unidad: x[1], precio: x[2]}));

  function objeto(v) {return v && typeof v === "object" && !Array.isArray(v);}
  function leer() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null) return {tarifas:TARIFAS_INICIALES, cotizaciones:[], movimientos:[]};
      const x = JSON.parse(raw);
      if (!objeto(x)) throw Error("Formato inválido");
      return {
        tarifas:Array.isArray(x.tarifas)?x.tarifas:TARIFAS_INICIALES,
        cotizaciones:Array.isArray(x.cotizaciones)?x.cotizaciones:[],
        movimientos:Array.isArray(x.movimientos)?x.movimientos:[]
      };
    } catch(e) {
      console.error("Error leyendo Finanzas", e);
      avisar("No se pudieron leer todos los datos guardados. No se reemplazarán hasta que guardes un cambio.", true);
      return {tarifas:TARIFAS_INICIALES, cotizaciones:[], movimientos:[]};
    }
  }
  function avisar(mensaje, error=false) {
    const caja = $("fin-alerta");
    caja.textContent = mensaje;
    caja.style.color = error ? "#ff7d8e" : "#9deac0";
  }
  // Cada acción de edición escribe un solo registro en Supabase.
  // El estado en pantalla solo cambia cuando Supabase confirma el cambio.
  async function persistir(nuevo) {
    if (!conectado || ocupado) {
      avisar("Todavía no está disponible Supabase. No se guardó ningún cambio.", true);
      return false;
    }
    const cambios = [];
    for (const tipo of TIPOS_NUBE) {
      const anteriores = new Map(estado[tipo].map(x => [String(x.id), x]));
      const actuales = new Map(nuevo[tipo].map(x => [String(x.id), x]));
      for (const [id, item] of actuales) {
        if (!anteriores.has(id)) cambios.push({ tipo, id, item, accion: "crear" });
        else if (JSON.stringify(anteriores.get(id)) !== JSON.stringify(item)) {
          cambios.push({ tipo, id, item, accion: "actualizar" });
        }
      }
      for (const id of anteriores.keys()) {
        if (!actuales.has(id)) cambios.push({ tipo, id, accion: "eliminar" });
      }
    }
    // La IU modifica un elemento por operación: nunca ejecutar varias escrituras parciales.
    if (cambios.length !== 1) {
      avisar("La operación no corresponde a un único registro. Recarga desde Supabase.", true);
      return false;
    }
    ocupado = true;
    bloquearFormularios(true);
    try {
      const cambio = cambios[0];
      const clave = claveRegistro(cambio.tipo, cambio.id);
      if (cambio.accion === "crear") {
        await insertarRegistro(cambio.tipo, cambio.item);
      } else {
        const version = versiones.get(clave);
        if (!version) throw Error("No existe una versión cargada para este registro. Actualiza la página.");
        let peticion;
        if (cambio.accion === "actualizar") {
          peticion = db.from("registros_modulos")
            .update({ contenido: cambio.item, actualizado_en: new Date().toISOString() });
        } else {
          peticion = db.from("registros_modulos").delete();
        }
        const { data, error } = await peticion
          .eq("estudio_id", estudioId)
          .eq("modulo", MODULO)
          .eq("registro_clave", clave)
          .eq("actualizado_en", version)
          .select("registro_clave, actualizado_en")
          .maybeSingle();
        if (error) throw error;
        if (!data) throw Error("Este dato cambió desde otra computadora. Actualiza desde Supabase antes de intentar otra vez.");
        if (cambio.accion === "eliminar") versiones.delete(clave);
        else versiones.set(clave, data.actualizado_en);
      }
      estado = nuevo;
      guardarCache();
      return true;
    } catch (error) {
      console.error("Presupuesto: operación rechazada", error);
      avisar("No se guardó el cambio en Supabase: " + mensajeError(error), true);
      return false;
    } finally {
      ocupado = false;
      bloquearFormularios(false);
    }
  }
  function idNuevo() {return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;}
  function fechaHoy() {
    const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function valor(id){return $(id).value.trim();}
  function num(id){const n=Number($(id).value);return Number.isFinite(n)?n:0;}
  function dinero(n){return `S/ ${Number(n||0).toLocaleString("es-PE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
  function nodo(tag, txt, clase) {const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(clase)x.className=clase;return x;}
  function boton(txt,fn,clase="alt"){const b=nodo("button",txt,clase);b.type="button";b.addEventListener("click",fn);return b;}
  function celda(tr,txt){tr.appendChild(nodo("td",txt));}
  function vacio(caja,texto){caja.replaceChildren(nodo("p",texto,"fin-muted"));}
  function descargar(nombre,texto,tipo){const blob=new Blob([texto],{type:tipo});const url=URL.createObjectURL(blob);const a=nodo("a");a.href=url;a.download=nombre;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function csvValor(v){let s=String(v??"");if(/^\s*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  function exportarCSV(nombre,filas){descargar(nombre,"\ufeff"+filas.map(f=>f.map(csvValor).join(";")).join("\r\n"),"text/csv;charset=utf-8");}
  function vFecha(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+"T12:00:00").getTime());}
  let estado = leer();
  let editandoTarifa = null;
  let editandoCotizacion = null;
  let editandoMovimiento = null;


  // ==========================================================
  // CONEXIÓN SEGURA: un registro por tarifa, cotización o movimiento.
  // No se reemplazan listas enteras al editar un solo dato.
  // ==========================================================
  const MODULO = "presupuesto";
  const TIPOS_NUBE = ["tarifas", "cotizaciones", "movimientos"];
  const CLAVE_RESPALDO = "aa_finanzas_v1_respaldo_migracion";
  let db = null;
  let estudioId = null;
  let usuarioId = null;
  let conectado = false;
  let ocupado = false;
  let versiones = new Map();
  let copiaSegura = true;
  let respaldoDescargado = false;

  // Crear copia antes de sustituir el caché local con el contenido remoto.
  // La ausencia de KEY indica que aún no se registró nada en este navegador.
  try {
    const crudo = localStorage.getItem(KEY);
    if (crudo !== null && localStorage.getItem(CLAVE_RESPALDO) === null) {
      localStorage.setItem(CLAVE_RESPALDO, crudo);
    }
  } catch (error) {
    copiaSegura = false;
    console.error("No pudo guardarse el respaldo previo", error);
  }
  estado = { tarifas: [], cotizaciones: [], movimientos: [] };

  function mensajeError(e) {
    return String(e?.message || e || "Error de conexión").slice(0, 220);
  }
  function claveRegistro(tipo, id) {
    return tipo + ":" + String(id);
  }
  function guardarCache() {
    // Solo se guarda una copia local tras la confirmación de lectura/escritura.
    try {
      localStorage.setItem(KEY, JSON.stringify(estado));
    } catch (error) {
      console.warn("No pudo guardarse la copia local de finanzas", error);
      avisar("Los datos están en Supabase, pero falló la copia del navegador.", true);
    }
  }
  function bloquearFormularios(bloquear) {
    document.querySelectorAll(".fin-page form input, .fin-page form select, .fin-page form textarea, .fin-page form button")
      .forEach(campo => { campo.disabled = bloquear; });
  }
  function respaldoLocal() {
    const original = localStorage.getItem(CLAVE_RESPALDO);
    if (original === null) {
      avisar("No hay datos financieros antiguos guardados en este navegador.");
      return;
    }
    descargar("presupuesto-respaldo-local-" + fechaHoy() + ".json", original, "application/json;charset=utf-8");
    respaldoDescargado = true;
    avisar("Respaldo local descargado. Consérvalo en una ubicación privada.");
  }
  function datosAntiguos() {
    const crudo = localStorage.getItem(CLAVE_RESPALDO);
    if (crudo === null) return { tarifas: [], cotizaciones: [], movimientos: [] };
    const datos = JSON.parse(crudo);
    if (!objeto(datos)) throw Error("El respaldo local no es un objeto válido.");
    const out = {};
    for (const tipo of TIPOS_NUBE) {
      out[tipo] = Array.isArray(datos[tipo])
        ? datos[tipo].filter(item => objeto(item) && typeof item.id === "string" && item.id.trim())
        : [];
    }
    return out;
  }
  function faltantes() {
    const datos = datosAntiguos();
    return TIPOS_NUBE.flatMap(tipo => datos[tipo]
      .filter(item => !versiones.has(claveRegistro(tipo, item.id)))
      .map(item => ({tipo, item})));
  }

  const panelNube = nodo("section", undefined, "fin-panel");
  panelNube.style.borderLeft = "3px solid #e32643";
  panelNube.appendChild(nodo("h3", "Supabase · Presupuesto"));
  const textoNube = nodo("p", "Conectando al servidor...", "fin-muted");
  textoNube.setAttribute("role", "status");
  const cuentaNube = nodo("p", "", "fin-muted");
  const accionesNube = nodo("div", undefined, "fin-actions");
  const recargarNube = boton("Actualizar desde Supabase", async () => {
    if (ocupado) return;
    bloquearFormularios(true);
    try {
      await cargarNube();
      avisar("Finanzas actualizadas desde Supabase.");
    } catch (error) {
      avisar("No se pudo actualizar: " + mensajeError(error), true);
    } finally {
      bloquearFormularios(!conectado);
    }
  });
  const exportarLocal = boton("Descargar respaldo local", () => {
    try { respaldoLocal(); } catch (error) { avisar(mensajeError(error), true); }
  });
  const importarLocal = boton("Importar finanzas anteriores", importarAntiguos);
  const activarTarifario = boton("Cargar tarifas de referencia", instalarTarifas);
  accionesNube.append(recargarNube, exportarLocal, importarLocal, activarTarifario);
  panelNube.append(textoNube, cuentaNube, accionesNube);
  $("fin-alerta").insertAdjacentElement("afterend", panelNube);

  function estadoConexion(mensaje, fallo = false) {
    textoNube.textContent = mensaje;
    textoNube.style.color = fallo ? "#ff7d8e" : "#9deac0";
  }
  function actualizarPanel() {
    const total = TIPOS_NUBE.reduce((s, tipo) => s + estado[tipo].length, 0);
    let pendientes = 0;
    try { pendientes = faltantes().length; }
    catch (error) { console.error(error); }
    cuentaNube.textContent = `${estado.tarifas.length} tarifas · ${estado.cotizaciones.length} cotizaciones · ${estado.movimientos.length} movimientos en Supabase. ${pendientes} registros locales pendientes.`;
    importarLocal.disabled = !conectado || ocupado || pendientes === 0;
    activarTarifario.disabled = !conectado || ocupado || estado.tarifas.length !== 0;
    activarTarifario.hidden = estado.tarifas.length !== 0;
    recargarNube.disabled = !conectado || ocupado;
    exportarLocal.disabled = localStorage.getItem(CLAVE_RESPALDO) === null;
    if (!total && !pendientes) {
      cuentaNube.textContent += " No hay movimientos registrados todavía.";
    }
  }

  async function insertarRegistro(tipo, item) {
    const {data, error} = await db.from("registros_modulos")
      .insert({
        estudio_id: estudioId,
        modulo: MODULO,
        registro_clave: claveRegistro(tipo, item.id),
        contenido: item,
        creado_por: usuarioId
      })
      .select("registro_clave, actualizado_en")
      .single();
    if (error) throw error;
    versiones.set(data.registro_clave, data.actualizado_en);
  }

  async function cargarNube() {
    if (!db || !estudioId) throw Error("Falta iniciar sesión en Supabase.");
    const nuevos = { tarifas: [], cotizaciones: [], movimientos: [] };
    const nuevasVersiones = new Map();
    let desde = 0;
    while (true) {
      const {data, error} = await db.from("registros_modulos")
        .select("registro_clave,contenido,actualizado_en")
        .eq("estudio_id", estudioId)
        .eq("modulo", MODULO)
        .order("registro_clave", { ascending: true })
        .range(desde, desde + 499);
      if (error) throw error;
      for (const fila of (data || [])) {
        for (const tipo of TIPOS_NUBE) {
          const prefijo = tipo + ":";
          if (!fila.registro_clave.startsWith(prefijo)) continue;
          const item = fila.contenido;
          if (!objeto(item) || typeof item.id !== "string" ||
              claveRegistro(tipo, item.id) !== fila.registro_clave) continue;
          nuevos[tipo].push(item);
          nuevasVersiones.set(fila.registro_clave, fila.actualizado_en);
        }
      }
      if (!data || data.length < 500) break;
      desde += data.length;
    }
    estado = nuevos;
    versiones = nuevasVersiones;
    guardarCache();
    actualizar();
    actualizarPanel();
    estadoConexion("Supabase conectado. Los cambios se guardan primero en la nube.");
  }

  async function importarAntiguos() {
    if (!conectado || ocupado) return;
    if (!respaldoDescargado) {
      avisar("Primero pulsa «Descargar respaldo local» y guarda el archivo.", true);
      return;
    }
    let pendientes;
    try { pendientes = faltantes(); }
    catch (error) { avisar("No se puede leer el respaldo local: " + mensajeError(error), true); return; }
    if (!pendientes.length) { avisar("Todos los registros locales ya están en Supabase."); return; }
    if (!confirm(`¿Importar ${pendientes.length} registros financieros anteriores? No se reemplazarán los existentes.`)) return;
    ocupado = true;
    bloquearFormularios(true);
    let importados = 0, omitidos = 0;
    try {
      await cargarNube();
      pendientes = faltantes();
      for (const {tipo, item} of pendientes) {
        try { await insertarRegistro(tipo, item); importados++; }
        catch (error) {
          if (error?.code === "23505") omitidos++;
          else throw error;
        }
      }
      await cargarNube();
      avisar(`Importación completada: ${importados} importados y ${omitidos} existentes. Respaldo local conservado.`);
    } catch (error) {
      console.error("Error importando Presupuesto", error);
      avisar("La importación fue parcial: " + mensajeError(error) + ". Actualiza antes de reintentar.", true);
      try { await cargarNube(); } catch (e) { console.error(e); }
    } finally {
      ocupado = false;
      bloquearFormularios(!conectado);
      actualizarPanel();
    }
  }
  async function instalarTarifas() {
    if (!conectado || ocupado || estado.tarifas.length) return;
    try {
      if (faltantes().some(v => v.tipo === "tarifas")) {
        avisar("Tienes tarifas anteriores sin importar. Impórtalas primero para evitar duplicados.", true);
        return;
      }
    } catch (error) { avisar(mensajeError(error), true); return; }
    if (!confirm("¿Crear las tarifas de referencia en Supabase? Son propuestas editables, NO precios oficiales.")) return;
    ocupado = true;
    bloquearFormularios(true);
    try {
      await cargarNube();
      if (estado.tarifas.length) throw Error("Ya hay tarifas en Supabase; no se instalarán duplicados.");
      const filas = TARIFAS_INICIALES.map(item => ({
        estudio_id: estudioId,
        modulo: MODULO,
        registro_clave: claveRegistro("tarifas", item.id),
        contenido: item,
        creado_por: usuarioId
      }));
      const {error} = await db.from("registros_modulos").insert(filas);
      if (error) throw error;
      await cargarNube();
      avisar("Tarifario de referencia creado en Supabase. Verifica los precios antes de cotizar.");
    } catch (error) {
      avisar("No se pudo instalar el tarifario: " + mensajeError(error), true);
    } finally {
      ocupado = false;
      bloquearFormularios(!conectado);
      actualizarPanel();
    }
  }

  async function iniciarSupabase() {
    bloquearFormularios(true);
    if (!copiaSegura) {
      estadoConexion("No se pudo conservar un respaldo local. No se iniciarán las escrituras.", true);
      return;
    }
    try {
      db = window.abreguDB;
      if (!db) throw Error("No se cargó assets/js/supabase.js.");
      const {data:auth, error:authError} = await db.auth.getUser();
      if (authError || !auth?.user) throw Error("Debes iniciar sesión como administrador.");
      usuarioId = auth.user.id;
      const {data:estudio, error:errorEstudio} = await db.from("estudios")
        .select("id").eq("propietario_id", usuarioId).maybeSingle();
      if (errorEstudio || !estudio) throw Error("No se encontró el estudio administrado por esta cuenta.");
      estudioId = estudio.id;
      const {data:miembro, error:errorMiembro} = await db.from("miembros_estudio")
        .select("rol,activo")
        .eq("estudio_id", estudioId).eq("usuario_id", usuarioId).maybeSingle();
      if (errorMiembro || miembro?.rol !== "administrador" || miembro?.activo !== true) {
        throw Error("No tienes permisos de administrador para las finanzas.");
      }
      await cargarNube();
      conectado = true;
      actualizarPanel();
      bloquearFormularios(false);
    } catch (error) {
      console.error("Error conectando presupuesto a Supabase", error);
      conectado = false;
      estadoConexion("No se pudo conectar: " + mensajeError(error), true);
      avisar("Presupuesto está en modo solo lectura; ningún cambio se guardará sin Supabase.", true);
      bloquearFormularios(true);
    }
  }

  // TARIFARIO
  function pintarTarifas(){
    const caja=$("fin-lista-tarifas");caja.replaceChildren();
    if(!estado.tarifas.length){vacio(caja,"Agrega tu primer servicio."); return;}
    const tabla=nodo("table"); const cab=nodo("tr");
    ["Servicio","Unidad","Precio de referencia","Acciones"].forEach(t=>cab.appendChild(nodo("th",t)));
    tabla.appendChild(cab);
    estado.tarifas.forEach(t=>{
      const tr=nodo("tr");celda(tr,t.nombre);celda(tr,t.unidad);celda(tr,dinero(t.precio));
      const td=nodo("td");const acciones=nodo("div",undefined,"fin-actions");
      acciones.append(
        boton("Editar",()=>{
          editandoTarifa=t.id;$("fin-tarifa-nombre").value=t.nombre;$("fin-tarifa-unidad").value=t.unidad;
          $("fin-tarifa-precio").value=t.precio;$("fin-tarifa-guardar").textContent="Guardar cambio";
          $("fin-tarifa-cancelar").hidden=false;$("fin-form-tarifa").scrollIntoView({behavior:"smooth"});
        }),
        boton("Eliminar",async ()=>{
          if(!confirm(`¿Eliminar la tarifa «${t.nombre}»? Las cotizaciones guardadas se conservarán.`))return;
          if(await persistir({...estado,tarifas:estado.tarifas.filter(a=>a.id!==t.id)})){reiniciarTarifa();actualizar();}
        },"warn")
      );td.append(acciones);tr.append(td);tabla.append(tr);
    });caja.append(tabla);
  }
  function reiniciarTarifa(){editandoTarifa=null;$("fin-form-tarifa").reset();$("fin-tarifa-guardar").textContent="Agregar tarifa";$("fin-tarifa-cancelar").hidden=true;}
  $("fin-form-tarifa").addEventListener("submit",async e=>{
    e.preventDefault();if(!e.currentTarget.reportValidity())return;
    const t={id:editandoTarifa||idNuevo(),nombre:valor("fin-tarifa-nombre"),unidad:valor("fin-tarifa-unidad"),precio:num("fin-tarifa-precio")};
    if(!t.nombre||t.precio<0||!Number.isFinite(t.precio)){avisar("Revisa el precio de la tarifa.",true);return;}
    const tarifas=editandoTarifa?estado.tarifas.map(a=>a.id===editandoTarifa?t:a):[...estado.tarifas,t];
    if(await persistir({...estado,tarifas})){reiniciarTarifa();actualizar();avisar("Tarifario guardado.");}
  });
  $("fin-tarifa-cancelar").addEventListener("click",reiniciarTarifa);
  function pintarOpcionesTarifa(){
    const selector=$("fin-cot-servicio"),actual=selector.value;selector.replaceChildren();
    estado.tarifas.forEach(t=>{const o=nodo("option",`${t.nombre} — ${dinero(t.precio)} / ${t.unidad}`);o.value=t.id;selector.append(o);});
    if([...selector.options].some(o=>o.value===actual))selector.value=actual;
  }

  // COTIZACIONES
  const IDS_CALCULO=["fin-cot-servicio","fin-cot-unidades","fin-cot-prep","fin-cot-rodaje","fin-cot-edicion","fin-cot-hora","fin-cot-equipos","fin-cot-fijos","fin-cot-otros","fin-cot-margen","fin-cot-precio","fin-cot-igv"];
  function calcular(){
    const tarifa=estado.tarifas.find(t=>t.id===valor("fin-cot-servicio"));
    const unidades=Math.max(0,num("fin-cot-unidades"));
    const costo=(num("fin-cot-prep")+num("fin-cot-rodaje")+num("fin-cot-edicion"))*num("fin-cot-hora")+num("fin-cot-equipos")+num("fin-cot-fijos")+num("fin-cot-otros");
    const margen=Math.min(0.9,Math.max(0,num("fin-cot-margen")/100));
    const sugerido=Math.ceil(Math.max(costo/(1-margen),Number(tarifa?.precio||0)*unidades)*100)/100;
    const bruto=valor("fin-cot-precio")===""?sugerido:num("fin-cot-precio");
    const conIGV=$("fin-cot-igv").checked;
    const final=bruto*(conIGV?1+IGV:1);
    const margenReal=bruto>0?((bruto-costo)/bruto)*100:0;
    $("fin-cot-costo").textContent=dinero(costo);
    $("fin-cot-sugerido").textContent=dinero(sugerido);
    $("fin-cot-final").textContent=dinero(final);
    $("fin-cot-margen-real").textContent=`${margenReal.toFixed(1)}%`;
    return {tarifa,costo,sugerido,bruto,final,margenReal,conIGV};
  }
  IDS_CALCULO.forEach(id=>$(id).addEventListener("input",calcular));
  $("fin-cot-usar-sugerido").addEventListener("click",()=>{$("fin-cot-precio").value="";calcular();avisar("Se aplicó el precio sugerido automáticamente.");});
  function limpiarCotizacion(){editandoCotizacion=null;$("fin-form-cotizacion").reset();$("fin-cot-fecha").value=fechaHoy();$("fin-cot-guardar").textContent="Guardar cotización";calcular();}
  $("fin-cot-limpiar").addEventListener("click",limpiarCotizacion);
  $("fin-form-cotizacion").addEventListener("submit",async e=>{
    e.preventDefault();if(!e.currentTarget.reportValidity())return;
    const datos=calcular();
    if(!datos.tarifa||!vFecha(valor("fin-cot-fecha"))||!valor("fin-cot-cliente")){avisar("Completa cliente, fecha y servicio.",true);return;}
    const valores=["fin-cot-unidades","fin-cot-prep","fin-cot-rodaje","fin-cot-edicion","fin-cot-hora","fin-cot-equipos","fin-cot-fijos","fin-cot-otros","fin-cot-margen"];
    if(valores.some(id=>num(id)<0)||num("fin-cot-margen")>90||!Number.isInteger(num("fin-cot-unidades"))||num("fin-cot-unidades")<1||datos.bruto<0){avisar("Revisa cantidades, margen y precio.",true);return;}
    const anterior=estado.cotizaciones.find(c=>c.id===editandoCotizacion);
    const q={
      id:editandoCotizacion||idNuevo(),fecha:valor("fin-cot-fecha"),cliente:valor("fin-cot-cliente"),
      servicio:datos.tarifa.nombre,unidad:datos.tarifa.unidad,cantidad:num("fin-cot-unidades"),
      precioBase:datos.tarifa.precio,preparacion:num("fin-cot-prep"),rodaje:num("fin-cot-rodaje"),edicion:num("fin-cot-edicion"),
      costoHora:num("fin-cot-hora"),equipos:num("fin-cot-equipos"),fijos:num("fin-cot-fijos"),otros:num("fin-cot-otros"),
      margenObjetivo:num("fin-cot-margen"),costo:datos.costo,venta:datos.bruto,igv:datos.conIGV,final:datos.final,
      notas:valor("fin-cot-notas"),estado:anterior?.estado||"pendiente"
    };
    const cotizaciones=editandoCotizacion?estado.cotizaciones.map(c=>c.id===editandoCotizacion?q:c):[...estado.cotizaciones,q];
    if(await persistir({...estado,cotizaciones})){limpiarCotizacion();actualizar();avisar("Cotización guardada. No se agregó automáticamente a los ingresos.");}
  });
  function editarCotizacion(q){
    const tarifa=estado.tarifas.find(t=>t.nombre===q.servicio&&t.unidad===q.unidad);
    if(!tarifa){avisar("Esta cotización usa una tarifa eliminada. Crea o selecciona el servicio antes de editar.",true);return;}
    editandoCotizacion=q.id;
    const valores={"fin-cot-fecha":q.fecha,"fin-cot-cliente":q.cliente,"fin-cot-servicio":tarifa.id,"fin-cot-unidades":q.cantidad,"fin-cot-prep":q.preparacion,"fin-cot-rodaje":q.rodaje,"fin-cot-edicion":q.edicion,"fin-cot-hora":q.costoHora,"fin-cot-equipos":q.equipos,"fin-cot-fijos":q.fijos,"fin-cot-otros":q.otros,"fin-cot-margen":q.margenObjetivo,"fin-cot-precio":q.venta,"fin-cot-notas":q.notas};
    Object.entries(valores).forEach(([id,v])=>$(id).value=v??"");$("fin-cot-igv").checked=!!q.igv;
    $("fin-cot-guardar").textContent="Guardar cambios";calcular();$("fin-form-cotizacion").scrollIntoView({behavior:"smooth"});
  }
  function textoCliente(q){
    return `AUDIOVISUAL ABREGU\nCOTIZACIÓN ${q.fecha}\nCliente: ${q.cliente}\nServicio: ${q.servicio}\nCantidad: ${q.cantidad} ${q.unidad}(es)\nPrecio sin IGV: ${dinero(q.venta)}\n${q.igv?`IGV 18%: ${dinero(q.final-q.venta)}\n`:""}TOTAL: ${dinero(q.final)}\n\nAlcance: ${q.notas||"Por definir"}\n\nTarifa sujeta a confirmación de disponibilidad y condiciones.`;
  }
  function pintarCotizaciones(){
    const caja=$("fin-lista-cotizaciones");caja.replaceChildren();
    if(!estado.cotizaciones.length){vacio(caja,"Aún no hay cotizaciones guardadas.");return;}
    [...estado.cotizaciones].sort((a,b)=>b.fecha.localeCompare(a.fecha)).forEach(q=>{
      const card=nodo("article",undefined,"fin-item");card.append(nodo("strong",`${q.cliente} · ${q.servicio}`));
      card.append(nodo("p",`${q.fecha} · ${q.cantidad} ${q.unidad}(es) · ${dinero(q.final)}${q.igv?" (incl. IGV)":" (sin IGV)"}`));
      card.append(nodo("p",`Costo estimado ${dinero(q.costo)} · Margen estimado ${q.venta>0?((q.venta-q.costo)/q.venta*100).toFixed(1):0}%`,"fin-muted"));
      if(q.notas)card.append(nodo("p",q.notas,"fin-muted"));
      const estadoRow=nodo("div",undefined,"fin-actions");
      const etiqueta=nodo("label","Estado: ");const select=nodo("select");select.style.maxWidth="190px";
      [["pendiente","Pendiente"],["aceptada","Aceptada"],["rechazada","Rechazada"]].forEach(([v,t])=>{const o=nodo("option",t);o.value=v;select.append(o);});
      select.value=q.estado;select.addEventListener("change",async ()=>{
        const arr=estado.cotizaciones.map(c=>c.id===q.id?{...c,estado:select.value}:c);
        if(await persistir({...estado,cotizaciones:arr})){actualizar();avisar("Estado guardado. Aceptada no significa cobrada.");}
      });etiqueta.append(select);estadoRow.append(etiqueta);
      estadoRow.append(boton("Editar",()=>editarCotizacion(q)));
      estadoRow.append(boton("Copiar para cliente",()=>{const t=textoCliente(q);if(navigator.clipboard?.writeText){navigator.clipboard.writeText(t).then(()=>avisar("Cotización copiada."),()=>{window.prompt("Copia la cotización:",t);});}else{window.prompt("Copia la cotización:",t);}}));
      estadoRow.append(boton("Eliminar",async ()=>{if(!confirm(`¿Eliminar la cotización de ${q.cliente}?`))return; if(await persistir({...estado,cotizaciones:estado.cotizaciones.filter(c=>c.id!==q.id)})){if(editandoCotizacion===q.id)limpiarCotizacion();actualizar();}},"warn"));
      card.append(estadoRow);caja.append(card);
    });
  }

  // MOVIMIENTOS: solo los cobros y gastos registrados cuentan en el resultado mensual.
  function limpiarMovimiento(){editandoMovimiento=null;$("fin-form-movimiento").reset();$("fin-mov-fecha").value=fechaHoy();const b=$("fin-form-movimiento").querySelector('button[type="submit"]');b.textContent="Registrar movimiento";}
  $("fin-form-movimiento").addEventListener("submit",async e=>{
    e.preventDefault();if(!e.currentTarget.reportValidity())return;
    const m={id:editandoMovimiento||idNuevo(),fecha:valor("fin-mov-fecha"),tipo:valor("fin-mov-tipo"),concepto:valor("fin-mov-concepto"),tercero:valor("fin-mov-tercero"),categoria:valor("fin-mov-categoria"),monto:Math.round(num("fin-mov-monto")*100)/100,nota:valor("fin-mov-nota")};
    if(!vFecha(m.fecha)||!m.concepto||!Number.isFinite(m.monto)||m.monto<=0){avisar("Revisa fecha, concepto y monto.",true);return;}
    const movimientos=editandoMovimiento?estado.movimientos.map(a=>a.id===editandoMovimiento?m:a):[...estado.movimientos,m];
    if(await persistir({...estado,movimientos})){limpiarMovimiento();actualizar();avisar("Movimiento guardado.");}
  });
  function editarMovimiento(m){
    editandoMovimiento=m.id;
    const campos={"fin-mov-fecha":m.fecha,"fin-mov-tipo":m.tipo,"fin-mov-concepto":m.concepto,"fin-mov-tercero":m.tercero,"fin-mov-categoria":m.categoria,"fin-mov-monto":m.monto,"fin-mov-nota":m.nota};
    Object.entries(campos).forEach(([id,v])=>$(id).value=v??"");
    $("fin-form-movimiento").querySelector('button[type="submit"]').textContent="Guardar cambios";
    $("fin-form-movimiento").scrollIntoView({behavior:"smooth"});
  }
  function movimientosMes(){const mes=$("fin-mes").value;return estado.movimientos.filter(m=>m.fecha?.slice(0,7)===mes).sort((a,b)=>b.fecha.localeCompare(a.fecha));}
  function pintarMovimientos(){
    const caja=$("fin-lista-movimientos"),movs=movimientosMes();caja.replaceChildren();
    if(!movs.length){vacio(caja,"No hay ingresos ni gastos registrados en este mes.");return;}
    const tabla=nodo("table"),cab=nodo("tr");["Fecha","Tipo","Concepto","Cliente/proveedor","Monto","Acciones"].forEach(t=>cab.append(nodo("th",t)));tabla.append(cab);
    movs.forEach(m=>{
      const tr=nodo("tr");[m.fecha,m.tipo==="ingreso"?"Ingreso":"Gasto",m.concepto,m.tercero||"—",dinero(m.monto)].forEach(v=>celda(tr,v));
      const td=nodo("td"),acciones=nodo("div",undefined,"fin-actions");
      acciones.append(boton("Editar",()=>editarMovimiento(m)),boton("Eliminar",async ()=>{
        if(!confirm(`¿Eliminar el movimiento «${m.concepto}» de ${dinero(m.monto)}?`))return;
        if(await persistir({...estado,movimientos:estado.movimientos.filter(x=>x.id!==m.id)})){if(editandoMovimiento===m.id)limpiarMovimiento();actualizar();}
      },"warn"));td.append(acciones);tr.append(td);tabla.append(tr);
    });caja.append(tabla);
  }
  function pintarResumen(){
    const movs=movimientosMes();const ingresos=movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+Number(m.monto||0),0);
    const gastos=movs.filter(m=>m.tipo==="gasto").reduce((a,m)=>a+Number(m.monto||0),0);
    $("fin-ingresos").textContent=dinero(ingresos);$("fin-gastos").textContent=dinero(gastos);$("fin-resultado").textContent=dinero(ingresos-gastos);
    $("fin-resultado").style.color=ingresos-gastos<0?"#ff7d8e":"#9deac0";
    $("fin-cotizaciones").textContent=String(estado.cotizaciones.filter(c=>c.estado==="pendiente"&&c.fecha?.slice(0,7)===$("fin-mes").value).length);
  }
  $("fin-mes").addEventListener("change",()=>{pintarResumen();pintarMovimientos();});

  // EXPORTACIONES
  $("fin-exportar-movs").addEventListener("click",()=>{
    const filas=[["Fecha","Tipo","Concepto","Tercero","Categoría","Monto S/","Nota"]];
    movimientosMes().forEach(m=>filas.push([m.fecha,m.tipo,m.concepto,m.tercero,m.categoria,m.monto,m.nota]));
    exportarCSV(`movimientos-${$("fin-mes").value}.csv`,filas);avisar("Movimientos exportados.");
  });
  $("fin-exportar-cots").addEventListener("click",()=>{
    const filas=[["Fecha","Cliente","Servicio","Cantidad","Costo interno S/","Venta sin IGV S/","IGV","Total S/","Estado","Alcance"]];
    estado.cotizaciones.forEach(q=>filas.push([q.fecha,q.cliente,q.servicio,q.cantidad,q.costo,q.venta,q.igv?"Sí":"No",q.final,q.estado,q.notas]));
    exportarCSV(`cotizaciones-${fechaHoy()}.csv`,filas);avisar("Cotizaciones exportadas.");
  });
  $("fin-respaldo").addEventListener("click",()=>{
    descargar(`finanzas-audiovisual-abregu-${fechaHoy()}.json`,JSON.stringify({formato:"aa_finanzas_v1",creado:new Date().toISOString(),datos:estado},null,2),"application/json;charset=utf-8");
    avisar("Respaldo descargado. Guárdalo en un lugar seguro.");
  });
  function actualizar(){pintarOpcionesTarifa();pintarTarifas();pintarCotizaciones();pintarMovimientos();pintarResumen();calcular();actualizarPanel();}
  $("fin-mes").value=fechaHoy().slice(0,7);
  $("fin-cot-fecha").value=fechaHoy();$("fin-mov-fecha").value=fechaHoy();
  actualizar();
  iniciarSupabase();
});