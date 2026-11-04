/* ==========================================
   ABREGU STUDIOS
   MÓDULO: MIS TAREAS

   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // 1. CONFIGURACIÓN GENERAL
    // ======================================

    const $ = id => document.getElementById(id);

    const CLAVE_TAREAS = "aa_tareas_personalizadas";
    const CLAVE_COMPLETADAS = "aa_tareas_personales_completadas";
    const CLAVE_RUTINAS = "aa_tareas_diarias";
    const CLAVE_JORNADAS = "aa_jornadas";

    const PUNTOS_TAREA = 3;

    const CLIENTES = {
        abregu: "ABREGU PRINT",
        fuze: "FUZE",
        kintex: "KINTEX",
        caedla: "CAEDLA",
        "juan-infante": "JUAN INFANTE",
        intepa: "INTEPA",
        general: "General"
    };

    const DIAS = [
        "Domingo", "Lunes", "Martes",
        "Miércoles", "Jueves", "Viernes", "Sábado"
    ];

    // ======================================
    // 2. DATOS LOCALES Y SINCRONIZACIÓN SEGURA
    // ======================================

    // Se conservan estas claves para el Resumen e Informes.
    // Supabase es la fuente principal, no la caché local.
    const MODULO_NUBE = "tareas";
    const CLAVE_RESPALDO = "aa_tareas_respaldo_pre_supabase_v1";
    const CLAVE_PREPARADO = "aa_tareas_respaldo_preparado_v1";

    function leer(clave, defecto) {
        try {
            const valor = localStorage.getItem(clave);
            return valor ? JSON.parse(valor) : defecto;
        } catch (error) {
            console.error("Error de lectura:", error);
            return defecto;
        }
    }

    // Antes de permitir que la caché pase a reflejar la nube,
    // guardamos una copia inalterada de los cuatro datos originales.
    if (localStorage.getItem(CLAVE_PREPARADO) !== "si") {
        try {
            const respaldo = {
                tareas: leer(CLAVE_TAREAS, []),
                completadas: leer(CLAVE_COMPLETADAS, {}),
                rutinas: leer(CLAVE_RUTINAS, {}),
                jornadas: leer(CLAVE_JORNADAS, {}),
                generadoEn: new Date().toISOString()
            };
            // Nunca sobrescribir un respaldo ya generado.
            if (!localStorage.getItem(CLAVE_RESPALDO)) {
                localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(respaldo));
            }
            localStorage.setItem(CLAVE_PREPARADO, "si");
        } catch (error) {
            console.error("Fallo el respaldo previo a Supabase:", error);
            alert("No se pudo crear el respaldo local de Tareas. Libera espacio y vuelve a abrir la página. No se iniciará la sincronización.");
            return;
        }
    }

    function leerRespaldo() {
        const respaldo = leer(CLAVE_RESPALDO, {});
        return respaldo && typeof respaldo === "object" ? respaldo : {};
    }

    let tareas = [];
    let completadas = {};
    let rutinasCompletadas = {};
    let jornadas = {};

    const db = window.abreguDB;
    let estudioId = null;
    let usuarioId = null;
    let conectado = false;
    let listo = false;
    let ocupado = false;
    const versiones = new Map();

    const panelNube = document.createElement("div");
    panelNube.className = "production-card";
    panelNube.style.cssText = "padding:16px;margin:14px 0 22px;border-left:3px solid #e53d54";
    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    estadoNube.textContent = "Conectando Mis tareas a Supabase...";
    const accionesNube = document.createElement("div");
    accionesNube.className = "form-actions";

    function botonNube(texto) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = texto;
        b.style.cssText = "padding:10px 14px;border-radius:8px;cursor:pointer";
        return b;
    }

    const botonActualizar = botonNube("Actualizar desde Supabase");
    const botonImportar = botonNube("Importar tareas locales");
    const botonRespaldo = botonNube("Descargar respaldo local");
    accionesNube.append(botonActualizar, botonImportar, botonRespaldo);
    panelNube.append(estadoNube, accionesNube);
    // No requiere cambiar ningún HTML.
    const contenido = document.querySelector("main") || document.body;
    contenido.insertBefore(panelNube, contenido.firstChild);

    function mensajeNube(mensaje, error = false) {
        estadoNube.textContent = mensaje;
        estadoNube.style.color = error ? "#ff8492" : "";
    }

    function controlarAcceso() {
        const bloqueado = !listo || ocupado;
        if (typeof botonGuardar !== "undefined") botonGuardar.disabled = bloqueado;
        if (typeof selectorJornada !== "undefined") selectorJornada.disabled = bloqueado;
        botonActualizar.disabled = !conectado || ocupado;
        botonImportar.disabled = bloqueado;
        // En contingencias el respaldo sigue descargable.
        botonRespaldo.disabled = false;
        ["tareas-de-hoy", "lista-todas-tareas"].forEach(id => {
            $(id)?.querySelectorAll("input[type=checkbox],button")
                .forEach(input => { input.disabled = bloqueado; });
        });
    }

    function cacheLocal() {
        // No modificar el respaldo previo.
        try {
            localStorage.setItem(CLAVE_TAREAS, JSON.stringify(tareas));
            localStorage.setItem(CLAVE_COMPLETADAS, JSON.stringify(completadas));
            localStorage.setItem(CLAVE_RUTINAS, JSON.stringify(rutinasCompletadas));
            localStorage.setItem(CLAVE_JORNADAS, JSON.stringify(jornadas));
        } catch (error) {
            console.warn("Datos guardados en la nube, pero falló la caché local:", error);
            mensajeNube("La nube tiene tus datos, pero no se pudo actualizar la copia de este navegador.", true);
        }
    }

    const claveTarea = id => `tarea:${encodeURIComponent(String(id))}`;
    const claveCompletada = (fecha, id) =>
        `completada:${fecha}:${encodeURIComponent(String(id))}`;
    const claveRutina = (fecha, indice) => `rutina:${fecha}:${indice}`;
    const claveJornada = fecha => `jornada:${fecha}`;
    const esFecha = fecha => /^\d{4}-\d{2}-\d{2}$/.test(fecha);

    // Cada tarea, casilla y fecha tiene su propia fila para que
    // dos operaciones distintas no reemplacen un objeto completo.
    async function escribirFila(clave, contenido) {
        if (!conectado || !estudioId) throw new Error("Sin conexión autorizada con Supabase.");
        const previa = versiones.get(clave);
        let consulta;
        if (previa) {
            consulta = db.from("registros_modulos")
                .update({ contenido, actualizado_en: new Date().toISOString() })
                .eq("id", previa.id)
                .eq("estudio_id", estudioId)
                .eq("modulo", MODULO_NUBE)
                .eq("actualizado_en", previa.actualizado_en)
                .select("id,actualizado_en").maybeSingle();
        } else {
            consulta = db.from("registros_modulos")
                .insert({
                    estudio_id: estudioId,
                    modulo: MODULO_NUBE,
                    registro_clave: clave,
                    contenido,
                    creado_por: usuarioId
                })
                .select("id,actualizado_en").single();
        }
        const { data, error } = await consulta;
        if (error) throw error;
        if (!data) throw new Error("Otro navegador modificó este registro. Actualiza desde Supabase antes de repetir el cambio.");
        versiones.set(clave, data);
    }

    async function borrarFila(clave) {
        const previa = versiones.get(clave);
        if (!previa) return;
        const { data, error } = await db.from("registros_modulos")
            .delete()
            .eq("id", previa.id)
            .eq("estudio_id", estudioId)
            .eq("modulo", MODULO_NUBE)
            .eq("actualizado_en", previa.actualizado_en)
            .select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("El registro cambió desde otro navegador. Actualiza Supabase antes de eliminarlo.");
        versiones.delete(clave);
    }

    function registrosDelRespaldo() {
        const r = leerRespaldo();
        const filas = new Map();
        if (Array.isArray(r.tareas)) {
            r.tareas.forEach(tarea => {
                if (tarea && typeof tarea.id === "string" && tarea.id) {
                    filas.set(claveTarea(tarea.id), tarea);
                }
            });
        }
        const completadasAntiguas = r.completadas || {};
        if (completadasAntiguas && typeof completadasAntiguas === "object") {
            Object.entries(completadasAntiguas).forEach(([fecha, ids]) => {
                if (!esFecha(fecha) || !Array.isArray(ids)) return;
                ids.forEach(id => {
                    if (typeof id === "string" && id) {
                        filas.set(claveCompletada(fecha, id), { fecha, id });
                    }
                });
            });
        }
        const rutinasAntiguas = r.rutinas || {};
        if (rutinasAntiguas && typeof rutinasAntiguas === "object") {
            Object.entries(rutinasAntiguas).forEach(([fecha, indices]) => {
                if (!esFecha(fecha) || !Array.isArray(indices)) return;
                indices.forEach(indice => {
                    if (Number.isInteger(indice) && indice >= 0) {
                        filas.set(claveRutina(fecha, indice), { fecha, indice });
                    }
                });
            });
        }
        const jornadasAntiguas = r.jornadas || {};
        if (jornadasAntiguas && typeof jornadasAntiguas === "object") {
            Object.entries(jornadasAntiguas).forEach(([fecha, tipo]) => {
                if (esFecha(fecha) && typeof tipo === "string" && tipo) {
                    filas.set(claveJornada(fecha), { fecha, tipo });
                }
            });
        }
        return [...filas].map(([clave, contenido]) => ({ clave, contenido }));
    }

    function pendientesImportar() {
        return registrosDelRespaldo().filter(fila => !versiones.has(fila.clave));
    }

    function estadoConectado() {
        const pendientes = pendientesImportar();
        botonImportar.hidden = !pendientes.length;
        mensajeNube(
            `Supabase conectado: ${tareas.length} tareas, ` +
            `${Object.values(completadas).reduce((s, a) => s + a.length, 0)} tareas completadas, ` +
            `${Object.values(rutinasCompletadas).reduce((s, a) => s + a.length, 0)} rutinas marcadas y ` +
            `${Object.keys(jornadas).length} jornadas.` +
            (pendientes.length ? ` ${pendientes.length} registros locales pendientes de importar.` : "")
        );
        controlarAcceso();
    }

    async function cargarNube() {
        if (!conectado || ocupado) return;
        ocupado = true;
        listo = false;
        controlarAcceso();
        mensajeNube("Leyendo las tareas desde Supabase...");
        try {
            const filas = [];
            const lote = 500;
            for (let desde = 0; ; desde += lote) {
                const { data, error } = await db.from("registros_modulos")
                    .select("id,registro_clave,contenido,actualizado_en")
                    .eq("estudio_id", estudioId)
                    .eq("modulo", MODULO_NUBE)
                    .order("registro_clave", { ascending: true })
                    .range(desde, desde + lote - 1);
                if (error) throw error;
                filas.push(...(data || []));
                if (!data || data.length < lote) break;
            }
            const tareasNube = [];
            const completadasNube = {};
            const rutinasNube = {};
            const jornadasNube = {};
            const versionesNube = new Map();
            for (const fila of filas) {
                const k = fila.registro_clave;
                const dato = fila.contenido;
                if (!dato || typeof dato !== "object") continue;
                versionesNube.set(k, { id: fila.id, actualizado_en: fila.actualizado_en });
                if (k.startsWith("tarea:") && typeof dato.id === "string") {
                    tareasNube.push(dato);
                } else if (k.startsWith("completada:") && esFecha(dato.fecha) && typeof dato.id === "string") {
                    (completadasNube[dato.fecha] ||= []).push(dato.id);
                } else if (k.startsWith("rutina:") && esFecha(dato.fecha) && Number.isInteger(dato.indice)) {
                    (rutinasNube[dato.fecha] ||= []).push(dato.indice);
                } else if (k.startsWith("jornada:") && esFecha(dato.fecha) && typeof dato.tipo === "string") {
                    jornadasNube[dato.fecha] = dato.tipo;
                }
            }
            versiones.clear();
            versionesNube.forEach((v, k) => versiones.set(k, v));
            tareas = tareasNube;
            completadas = completadasNube;
            rutinasCompletadas = rutinasNube;
            jornadas = jornadasNube;
            cacheLocal();
            idEditando = null;
            formulario.reset();
            actualizarSelectorJornada();
            listo = true;
            actualizarPantalla();
            estadoConectado();
        } catch (error) {
            console.error("Error al leer Tareas de Supabase:", error);
            mensajeNube(`No se pudo leer Supabase: ${error.message || error}`, true);
            // No usar el caché antiguo para realizar escrituras.
            listo = false;
        } finally {
            ocupado = false;
            controlarAcceso();
        }
    }

    async function operacionRemota(accion) {
        if (!listo || ocupado) return false;
        ocupado = true;
        controlarAcceso();
        try {
            await accion();
            cacheLocal();
            actualizarPantalla();
            estadoConectado();
            return true;
        } catch (error) {
            console.error("Error guardando Tareas en Supabase:", error);
            // Releer antes de permitir otra edición: una operación pudo ser parcial.
            listo = false;
            mensajeNube(`No se guardó el cambio: ${error.message || error}. Actualiza desde Supabase si es necesario.`, true);
            return false;
        } finally {
            ocupado = false;
            controlarAcceso();
        }
    }

    botonActualizar.addEventListener("click", cargarNube);

    botonRespaldo.addEventListener("click", () => {
        const archivo = new Blob([JSON.stringify(leerRespaldo(), null, 2)],
            { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(archivo);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `abregu-tareas-respaldo-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    botonImportar.addEventListener("click", async () => {
        if (!listo || ocupado) return;
        const pendientes = pendientesImportar();
        if (!pendientes.length) return;
        if (!confirm(`Se importarán ${pendientes.length} registros antiguos (tareas, casillas y jornadas) sin reemplazar los que ya existen en Supabase. ¿Continuar?`)) return;
        ocupado = true;
        controlarAcceso();
        let importados = 0;
        let omitidos = 0;
        let fallo = null;
        for (const fila of pendientes) {
            try {
                await escribirFila(fila.clave, fila.contenido);
                importados++;
            } catch (error) {
                // Puede existir en nube aunque este navegador no lo haya leído aún.
                if (error?.code === "23505") omitidos++;
                else { fallo = error; break; }
            }
        }
        ocupado = false;
        // Volver a leer después de una importación total o parcial.
        await cargarNube();
        if (fallo) {
            mensajeNube(`Importados: ${importados}. Omitidos: ${omitidos}. Proceso interrumpido: ${fallo.message || fallo}`, true);
        } else {
            alert(`Importación terminada. Importados: ${importados}. Omitidos o existentes: ${omitidos}. Se conservó el respaldo local.`);
        }
    });

    async function iniciarSupabase() {
        if (!db) {
            mensajeNube("No está disponible Supabase. Revisa los scripts de esta página.", true);
            return;
        }
        try {
            const { data: auth, error: errorAuth } = await db.auth.getUser();
            if (errorAuth || !auth?.user) throw new Error("Debes iniciar sesión.");
            usuarioId = auth.user.id;
            const { data: estudio, error: errorEstudio } = await db
                .from("estudios").select("id")
                .eq("propietario_id", usuarioId).maybeSingle();
            if (errorEstudio || !estudio) throw errorEstudio || new Error("No hay estudio autorizado.");
            const { data: miembro, error: errorMiembro } = await db
                .from("miembros_estudio").select("rol,activo")
                .eq("estudio_id", estudio.id).eq("usuario_id", usuarioId).maybeSingle();
            if (errorMiembro || miembro?.rol !== "administrador" || miembro?.activo !== true) {
                throw errorMiembro || new Error("El usuario no tiene permisos de administrador.");
            }
            estudioId = estudio.id;
            conectado = true;
            await cargarNube();
        } catch (error) {
            console.error("Error autenticando Tareas:", error);
            mensajeNube(`Tareas no disponible: ${error.message || error}`, true);
            listo = false;
            controlarAcceso();
        }
    }



    // ======================================
    // 3. FECHAS
    // ======================================

    function fechaLocal(fecha = new Date()) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const dia = String(fecha.getDate()).padStart(2, "0");

        return `${anio}-${mes}-${dia}`;
    }

    function fechaObjeto(valor) {
        return new Date(`${valor}T12:00:00`);
    }

    function numeroDia(valor) {
        return fechaObjeto(valor).getDay();
    }

    const hoy = fechaLocal();

    $("fecha-planificacion").value = hoy;
    $("fecha-tarea").value = hoy;

    function fechaSeleccionada() {
        return $("fecha-planificacion").value || hoy;
    }

    function mostrarFecha() {
        const fecha = fechaSeleccionada();
        const objeto = fechaObjeto(fecha);

        $("fecha-tareas").textContent =
            objeto.toLocaleDateString("es-PE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });

        $("nombre-dia").textContent =
            DIAS[numeroDia(fecha)];
    }

    // ======================================
    // 4. RUTINAS AUTOMÁTICAS
    // ======================================

    // Estas listas coinciden con las rutinas
    // actuales del Resumen General.

    const RUTINAS = {
        1: [
            "Revisar pendientes y publicaciones.",
            "Preparar contenido de FUZE.",
            "Avanzar producción de Abregu.",
            "Limpiar y preparar el estudio.",
            "Revisar cámaras, audio e iluminación.",
            "Preparar LIVE Jóvenes - 6:00 p. m.",
            "Preparar LIVE JUJU - 7:00 p. m."
        ],

        2: [
            "Revisar las tareas pendientes.",
            "Grabar o editar contenido de Abregu.",
            "Preparar publicación de FUZE.",
            "Coordinar programa Mujeres Emprendedoras.",
            "Preparar LIVE de FUZE, si está confirmado.",
            "Revisar clientes y ventas."
        ],

        3: [
            "Revisar metas de producción.",
            "Grabar y editar videos pendientes.",
            "Preparar contenido de FUZE.",
            "Preparar guiones de KINTEX.",
            "Coordinar grabaciones de CAEDLA.",
            "Revisar equipos para el jueves."
        ],

        4: [
            "Revisar equipos antes de salir.",
            "Trasladarse a KINTEX.",
            "Grabar sketches de KINTEX.",
            "Revisar el material grabado.",
            "Trasladarse a CAEDLA.",
            "Grabar procesos de producción de CAEDLA.",
            "Respaldar archivos de ambas marcas."
        ],

        5: [
            "Revisar publicaciones pendientes.",
            "Editar videos de KINTEX.",
            "Editar videos de CAEDLA.",
            "Preparar contenido diario de FUZE.",
            "Coordinar y preparar LIVE de FUZE.",
            "Preparar estudio para INTEPA.",
            "Operar LIVE de INTEPA."
        ],

        6: [
            "Revisar producción semanal.",
            "Finalizar videos pendientes.",
            "Preparar contenido de FUZE.",
            "Preparar LIVE de FUZE, si está confirmado.",
            "Revisar metas de las cuatro marcas.",
            "Organizar publicaciones de la próxima semana.",
            "Preparar informe semanal."
        ],

        0: [
            "Verificar publicación programada de FUZE."
        ]
    };

    // ======================================
    // 5. CONTROL DE TAREAS
    // ======================================

    function corresponde(tarea, fecha) {
        if (fecha < tarea.fecha) return false;

        if (tarea.repeticion === "diaria") return true;

        if (tarea.repeticion === "semanal") {
            return numeroDia(fecha) === numeroDia(tarea.fecha);
        }

        return tarea.fecha === fecha;
    }

    function estaCompletada(id, fecha) {
        return (completadas[fecha] || []).includes(id);
    }

    async function alternarTarea(id, fecha) {
        const marcada = estaCompletada(id, fecha);
        const clave = claveCompletada(fecha, id);
        await operacionRemota(async () => {
            if (marcada) {
                await borrarFila(clave);
                completadas[fecha] = (completadas[fecha] || []).filter(v => v !== id);
            } else {
                await escribirFila(clave, { fecha, id });
                (completadas[fecha] ||= []).push(id);
            }
        });
    }

    async function alternarRutina(indice, fecha) {
        const marcada = (rutinasCompletadas[fecha] || []).includes(indice);
        const clave = claveRutina(fecha, indice);
        await operacionRemota(async () => {
            if (marcada) {
                await borrarFila(clave);
                rutinasCompletadas[fecha] = (rutinasCompletadas[fecha] || []).filter(v => v !== indice);
            } else {
                await escribirFila(clave, { fecha, indice });
                (rutinasCompletadas[fecha] ||= []).push(indice);
            }
        });
    }



    // ======================================
    // 6. CREAR TARJETAS
    // ======================================

    function tarjeta(titulo, descripcion, marcada, accion) {
        const articulo = document.createElement("article");
        articulo.className = "production-card";

        const etiqueta = document.createElement("label");
        etiqueta.style.display = "flex";
        etiqueta.style.gap = "12px";
        etiqueta.style.cursor = "pointer";
        etiqueta.style.alignItems = "flex-start";

        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.checked = marcada;
        casilla.disabled = !listo || ocupado;
        casilla.style.accentColor = "#e51c38";
        casilla.style.marginTop = "5px";

        casilla.addEventListener("change", accion);

        const contenido = document.createElement("div");

        const nombre = document.createElement("h3");
        nombre.textContent = titulo;

        const detalle = document.createElement("p");
        detalle.textContent = descripcion;

        if (marcada) {
            nombre.style.textDecoration = "line-through";
            nombre.style.opacity = "0.65";
        }

        contenido.append(nombre, detalle);
        etiqueta.append(casilla, contenido);
        articulo.appendChild(etiqueta);

        return articulo;
    }

    // ======================================
    // 7. MOSTRAR TAREAS DEL DÍA
    // ======================================

    function mostrarTareasHoy() {
        const fecha = fechaSeleccionada();
        const dia = numeroDia(fecha);

        const contenedor = $("tareas-de-hoy");
        contenedor.replaceChildren();

        // Rutinas del Resumen General

        (RUTINAS[dia] || []).forEach((texto, indice) => {
            const marcada = (
                rutinasCompletadas[fecha] || []
            ).includes(indice);

            contenedor.appendChild(
                tarjeta(
                    texto,
                    "Actividad habitual · +3 puntos",
                    marcada,
                    () => alternarRutina(indice, fecha)
                )
            );
        });

        // Tareas personalizadas

        const delDia = tareas
            .filter(tarea => corresponde(tarea, fecha))
            .sort((a, b) =>
                (a.horaInicio || "99:99").localeCompare(
                    b.horaInicio || "99:99"
                )
            );

        delDia.forEach(tarea => {
            const horario = tarea.horaInicio
                ? `${tarea.horaInicio} - ${tarea.horaFin || "Por definir"}`
                : "Sin horario definido";

            const detalle =
                `${CLIENTES[tarea.cliente] || "General"} · ` +
                `${horario} · Prioridad ${tarea.prioridad}`;

            contenedor.appendChild(
                tarjeta(
                    tarea.titulo,
                    detalle,
                    estaCompletada(tarea.id, fecha),
                    () => alternarTarea(tarea.id, fecha)
                )
            );
        });
    }

    // ======================================
    // 8. INDICADORES Y PUNTOS
    // ======================================

    function actualizarIndicadores() {
        const fecha = fechaSeleccionada();

        const rutinas = RUTINAS[numeroDia(fecha)] || [];

        const marcadas = (
            rutinasCompletadas[fecha] || []
        ).filter(indice =>
            Number.isInteger(indice) &&
            indice >= 0 &&
            indice < rutinas.length
        ).length;

        const delDia = tareas.filter(tarea =>
            corresponde(tarea, fecha)
        );

        const realizadas = delDia.filter(tarea =>
            estaCompletada(tarea.id, fecha)
        ).length;

        const total = rutinas.length + delDia.length;
        const terminadas = marcadas + realizadas;

        $("total-tareas").textContent = total;
        $("tareas-completadas").textContent = terminadas;
        $("tareas-sin-completar").textContent =
            total - terminadas;

        $("puntos-dia").textContent =
            terminadas * PUNTOS_TAREA;
    }

    // ======================================
    // 9. BLOQUES DE HORARIO
    // ======================================

    const HORARIOS = {
        instituto: [
            ["14:00", "14:20", "Organización"],
            ["14:20", "15:40", "Grabaciones"],
            ["15:40", "17:20", "Edición"],
            ["17:20", "18:20", "Ventas y clientes"],
            ["18:20", "19:30", "Publicaciones"],
            ["19:30", "20:00", "Informe y cierre"]
        ],
        completa: [
            ["10:30", "11:00", "Planificación"],
            ["11:00", "13:00", "Grabaciones"],
            ["13:00", "14:00", "Almuerzo"],
            ["14:00", "16:00", "Edición"],
            ["16:00", "17:00", "Ventas"],
            ["17:00", "19:15", "Producción y entregas"],
            ["19:15", "20:00", "Cierre"]
        ]
    };

    function mostrarBloques() {
        const contenedor = $("bloques-horarios");
        contenedor.replaceChildren();

        const fecha = fechaSeleccionada();
        const tipo = jornadas[fecha];

        if (!tipo) {
            const mensaje = document.createElement("p");
            mensaje.textContent =
                "Selecciona un tipo de jornada para ver " +
                "tu horario de referencia.";
            contenedor.appendChild(mensaje);
            return;
        }

        let bloques = HORARIOS[tipo] || [];

        // Jueves de grabación externa
        if (tipo === "completa" && numeroDia(fecha) === 4) {
            bloques = [
                ["10:30", "11:00", "Preparación KINTEX"],
                ["11:00", "13:00", "Grabación KINTEX"],
                ["13:00", "14:00", "Almuerzo"],
                ["14:00", "14:30", "Traslado a CAEDLA"],
                ["14:30", "18:30", "Grabación CAEDLA"],
                ["18:30", "20:00", "Revisión, respaldo y retorno"]
            ];
        }

        if (tipo === "especial") {
            bloques = [
                ["Por definir", "", "Producción o LIVE especial"]
            ];
        }

        bloques.forEach(([inicio, fin, actividad]) => {
            const bloque = document.createElement("article");
            bloque.className = "production-card";

            const titulo = document.createElement("h3");
            titulo.textContent = actividad;

            const detalle = document.createElement("p");
            detalle.textContent = fin
                ? `${inicio} - ${fin}`
                : inicio;

            bloque.append(titulo, detalle);
            contenedor.appendChild(bloque);
        });
    }

    // ======================================
    // 10. CONFIGURAR JORNADA
    // ======================================

    const selectorJornada = $("tipo-jornada");

    // Evitar asumir qué días tienes instituto
    const opcionInicial = document.createElement("option");
    opcionInicial.value = "";
    opcionInicial.textContent = "Seleccionar jornada";
    selectorJornada.prepend(opcionInicial);

    selectorJornada.disabled = false;
    $("fecha-planificacion").disabled = false;

    function actualizarSelectorJornada() {
        selectorJornada.value =
            jornadas[fechaSeleccionada()] || "";
    }

    selectorJornada.addEventListener("change", async () => {
        const fecha = fechaSeleccionada();
        const nuevoTipo = selectorJornada.value;
        const anterior = jornadas[fecha] || "";
        if (nuevoTipo === anterior) return;
        const correcto = await operacionRemota(async () => {
            if (nuevoTipo) {
                await escribirFila(claveJornada(fecha), { fecha, tipo: nuevoTipo });
                jornadas[fecha] = nuevoTipo;
            } else {
                await borrarFila(claveJornada(fecha));
                delete jornadas[fecha];
            }
        });
        if (!correcto) selectorJornada.value = anterior;
    });



    $("fecha-planificacion").addEventListener("change", () => {
        actualizarPantalla();
        actualizarSelectorJornada();
    });

    // ======================================
    // 11. CREAR Y EDITAR TAREAS
    // ======================================

    const formulario = $("form-tarea");
    const botonGuardar = $("guardar-tarea");

    let idEditando = null;

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (!listo || ocupado) return;

        if (!formulario.reportValidity()) return;

        const inicio = $("hora-inicio-tarea").value;
        const fin = $("hora-fin-tarea").value;

        if (inicio && fin && fin <= inicio) {
            alert("La hora final debe ser posterior al inicio.");
            return;
        }

        const anterior = tareas.find(
            tarea => tarea.id === idEditando
        );

        const tarea = {
            id: anterior?.id ||
                (crypto.randomUUID?.() ||
                 `${Date.now()}-${Math.random()}`),

            titulo: $("titulo-tarea").value.trim(),
            cliente: $("cliente-tarea").value,
            categoria: $("categoria-tarea").value,
            prioridad: $("prioridad-tarea").value,
            fecha: $("fecha-tarea").value,
            horaInicio: inicio,
            horaFin: fin,
            repeticion: $("repeticion-tarea").value,
            descripcion: $("descripcion-tarea").value.trim()
        };

        const guardado = await operacionRemota(async () => {
            await escribirFila(claveTarea(tarea.id), tarea);
            if (anterior) {
                tareas = tareas.map(item => item.id === tarea.id ? tarea : item);
            } else {
                tareas.push(tarea);
            }
        });
        if (!guardado) return;



        idEditando = null;
        formulario.reset();
        $("fecha-tarea").value = fechaSeleccionada();
        botonGuardar.textContent = "Guardar tarea";

        actualizarPantalla();

        alert("¡Tarea guardada correctamente!");
    });

    // ======================================
    // 12. EDITAR Y ELIMINAR
    // ======================================

    function editarTarea(id) {
        const tarea = tareas.find(item => item.id === id);
        if (!tarea) return;

        idEditando = id;

        const campos = {
            "titulo-tarea": tarea.titulo,
            "cliente-tarea": tarea.cliente,
            "categoria-tarea": tarea.categoria,
            "prioridad-tarea": tarea.prioridad,
            "fecha-tarea": tarea.fecha,
            "hora-inicio-tarea": tarea.horaInicio,
            "hora-fin-tarea": tarea.horaFin,
            "repeticion-tarea": tarea.repeticion,
            "descripcion-tarea": tarea.descripcion
        };

        Object.entries(campos).forEach(([id, valor]) => {
            $(id).value = valor || "";
        });

        botonGuardar.textContent = "Guardar cambios";

        $("nueva-tarea").scrollIntoView({
            behavior: "smooth"
        });
    }

    async function eliminarTarea(id) {
        if (!listo || ocupado || !confirm("¿Eliminar esta tarea?")) return;
        const eliminado = await operacionRemota(async () => {
            // Primero limpiar las casillas de esa tarea.
            // No es transaccional: si falla una petición, se solicita recargar.
            const sufijo = `:${encodeURIComponent(String(id))}`;
            const claves = [...versiones.keys()].filter(k =>
                k.startsWith("completada:") && k.endsWith(sufijo));
            for (const clave of claves) await borrarFila(clave);
            await borrarFila(claveTarea(id));
            tareas = tareas.filter(tarea => tarea.id !== id);
            Object.keys(completadas).forEach(fecha => {
                completadas[fecha] = (completadas[fecha] || []).filter(v => v !== id);
            });
        });
        if (!eliminado) return;
        if (idEditando === id) {
            formulario.reset();
            idEditando = null;
            botonGuardar.textContent = "Guardar tarea";
        }
        actualizarPantalla();
    }



    // ======================================
    // 13. MOSTRAR TODAS LAS TAREAS
    // ======================================

    const filtroEstado = $("filtro-estado-tarea");
    const filtroCliente = $("filtro-cliente-tarea");

    filtroEstado.disabled = false;
    filtroCliente.disabled = false;

    function mostrarTodas() {
        const contenedor = $("lista-todas-tareas");
        contenedor.replaceChildren();

        const fecha = fechaSeleccionada();

        const filtradas = tareas.filter(tarea => {
            const marcaCorrecta =
                filtroCliente.value === "todas" ||
                tarea.cliente === filtroCliente.value;

            const fechaEvaluada =
                tarea.repeticion === "una-vez"
                    ? tarea.fecha : fecha;

            const terminada =
                estaCompletada(tarea.id, fechaEvaluada);

            const estadoCorrecto =
                filtroEstado.value === "todas" ||
                (filtroEstado.value === "completada" &&
                 terminada) ||
                (filtroEstado.value === "pendiente" &&
                 !terminada);

            return marcaCorrecta && estadoCorrecto;
        });

        if (!filtradas.length) {
            const mensaje = document.createElement("p");
            mensaje.textContent =
                "No hay tareas para este filtro.";
            contenedor.appendChild(mensaje);
            return;
        }

        filtradas.forEach(tarea => {
            const articulo = document.createElement("article");
            articulo.className = "production-card";

            const titulo = document.createElement("h3");
            titulo.textContent = tarea.titulo;

            const detalle = document.createElement("p");
            detalle.textContent =
                `${CLIENTES[tarea.cliente] || "General"} · ` +
                `${tarea.fecha} · ${tarea.repeticion}`;

            const descripcion = document.createElement("p");
            descripcion.textContent =
                tarea.descripcion || "Sin descripción";

            const acciones = document.createElement("div");
            acciones.className = "form-actions";

            const editar = document.createElement("button");
            editar.type = "button";
            editar.textContent = "Editar";
            editar.onclick = () => editarTarea(tarea.id);

            const eliminar = document.createElement("button");
            eliminar.type = "button";
            eliminar.textContent = "Eliminar";
            eliminar.onclick = () => eliminarTarea(tarea.id);

            acciones.append(editar, eliminar);

            articulo.append(
                titulo, detalle, descripcion, acciones
            );

            contenedor.appendChild(articulo);
        });
    }

    filtroEstado.addEventListener("change", mostrarTodas);
    filtroCliente.addEventListener("change", mostrarTodas);

    formulario.addEventListener("reset", () => {
        idEditando = null;
        botonGuardar.textContent = "Guardar tarea";
    });

    // ======================================
    // 14. ACTUALIZAR TODO EL SISTEMA
    // ======================================

    function actualizarPantalla() {
        mostrarFecha();
        mostrarTareasHoy();
        mostrarBloques();
        mostrarTodas();
        actualizarIndicadores();
    }

    botonGuardar.disabled = true;

    const ayuda = formulario.querySelector(".helper-text");
    if (ayuda) {
        ayuda.textContent =
            "Las tareas, rutinas, jornadas y verificaciones se guardan en Supabase. " +
            "Los registros antiguos de este navegador pueden importarse manualmente.";
    }

    // Mostrar una pantalla inicialmente bloqueada hasta recibir datos de la nube.
    actualizarSelectorJornada();
    actualizarPantalla();
    controlarAcceso();
    iniciarSupabase();

    console.log("ABREGU STUDIOS: Mis tareas con Supabase activado.");});
