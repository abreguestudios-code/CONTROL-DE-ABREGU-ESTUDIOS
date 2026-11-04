/* ==========================================
   ABREGU STUDIOS
   MODULO: AGENDA SEMANAL
   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const $ = id => document.getElementById(id);

    const CLAVE = "aa_agenda_eventos";

    const CLIENTES = {
        abregu: "ABREGU PRINT",
        fuze: "FUZE",
        kintex: "KINTEX",
        caedla: "CAEDLA",
        "juan-infante": "JUAN INFANTE",
        intepa: "INTEPA",
        general: "General"
    };

    const formulario = $("form-agenda");
    const listaSemana = $("agenda-semana");
    const listaDia = $("agenda-dia");
    const listaAdicional = $("lista-actividades");
    const selectorFecha = $("fecha-agenda");
    const botonGuardar = $("guardar-actividad");

    if (!formulario || !listaSemana ||
        !listaDia || !listaAdicional ||
        !selectorFecha || !botonGuardar) {

        console.error(
            "Faltan elementos de Agenda Semanal."
        );

        return;
    }

    // ======================================
    // 1. ALMACENAMIENTO LOCAL
    // ======================================

    function leer(clave, defecto) {

        try {
            const texto = localStorage.getItem(clave);

            return texto === null
                ? defecto
                : JSON.parse(texto);

        } catch (error) {
            console.warn("Error al leer:", clave);
            return defecto;
        }
    }

    function leerArray(clave) {
        const datos = leer(clave, []);

        return Array.isArray(datos) ? datos : [];
    }

    // Supabase es la fuente principal de Agenda.
    // Guardamos una copia INTACTA de los eventos locales antes de cargar la nube.
    const MODULO_NUBE = "agenda";
    const CLAVE_RESPALDO = "aa_agenda_respaldo_pre_supabase_v1";
    const CLAVE_PREPARADO = "aa_agenda_respaldo_preparado_v1";

    if (localStorage.getItem(CLAVE_PREPARADO) !== "si") {
        try {
            if (localStorage.getItem(CLAVE_RESPALDO) === null) {
                localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(leerArray(CLAVE)));
            }
            localStorage.setItem(CLAVE_PREPARADO, "si");
        } catch (error) {
            console.error("No se pudo respaldar la Agenda", error);
            alert("No se pudo crear el respaldo local de Agenda. No se iniciará la sincronización.");
            return;
        }
    }

    function leerRespaldo() {
        const datos = leerArray(CLAVE_RESPALDO);
        return datos.filter(a => a && typeof a.id === "string" && a.id.trim());
    }

    let actividades = [];
    let idEditando = null;
    let estudioId = null;
    let usuarioId = null;
    let conectado = false;
    let listo = false;
    let ocupado = false;
    const db = window.abreguDB;
    const versiones = new Map();

    // Datos cruzados de otros módulos: cargados desde Supabase, no desde
    // una caché que podría pertenecer a otro dispositivo o sesión.
    let referencias = {
        lives: [],
        tareas: [],
        completadas: {},
        producciones: [],
        jornadas: {}
    };

    const panelNube = document.createElement("div");
    panelNube.className = "production-card";
    panelNube.style.cssText =
        "padding:16px;margin:14px 0 22px;border-left:3px solid #e53d54";
    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    estadoNube.textContent = "Conectando Agenda Semanal a Supabase...";
    const botonesNube = document.createElement("div");
    botonesNube.className = "form-actions";

    function botonNube(texto) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = texto;
        return b;
    }

    const botonActualizar = botonNube("Actualizar desde Supabase");
    const botonImportar = botonNube("Importar actividades locales");
    const botonRespaldo = botonNube("Descargar respaldo local");
    botonesNube.append(botonActualizar, botonImportar, botonRespaldo);
    panelNube.append(estadoNube, botonesNube);
    formulario.before(panelNube);

    const claveActividad = id => `actividad:${encodeURIComponent(String(id))}`;

    function mostrarEstado(mensaje, error = false) {
        estadoNube.textContent = mensaje;
        estadoNube.style.color = error ? "#ff8492" : "";
    }

    function pendientesImportar() {
        const ids = new Set(actividades.map(a => String(a.id)));
        return leerRespaldo().filter(a => !ids.has(String(a.id)));
    }

    function actualizarDisponibilidad() {
        const bloqueado = !listo || ocupado;
        botonGuardar.disabled = bloqueado;
        botonActualizar.disabled = !conectado || ocupado;
        botonImportar.hidden = listo && pendientesImportar().length === 0;
        botonImportar.disabled = bloqueado || !pendientesImportar().length;
        botonRespaldo.disabled = false;
        listaAdicional.querySelectorAll("button").forEach(b => {
            b.disabled = bloqueado;
        });
    }

    function guardarCacheLocal() {
        // Clave compartida con el resto de ABREGU STUDIOS.
        // JAMÁS sobrescribimos CLAVE_RESPALDO.
        try {
            localStorage.setItem(CLAVE, JSON.stringify(actividades));
        } catch (error) {
            console.warn("Agenda guardada en nube; falló la caché local", error);
            mostrarEstado("Agenda guardada en Supabase, pero no se actualizó la copia local.", true);
        }
    }

    function pintarEstado() {
        const pendientes = pendientesImportar();
        mostrarEstado(
            `Supabase conectado: ${actividades.length} actividades de Agenda. ` +
            `${referencias.lives.length} LIVE, ` +
            `${referencias.tareas.length} tareas y ` +
            `${referencias.producciones.length} producciones consultadas.` +
            (pendientes.length ? ` ${pendientes.length} actividades locales pendientes de importar.` : "")
        );
        actualizarDisponibilidad();
    }

    // Recuperación paginada para no depender del límite de filas de PostgREST.
    async function leerModulo(modulo) {
        const filas = [];
        const lote = 500;
        for (let desde = 0; ; desde += lote) {
            const { data, error } = await db.from("registros_modulos")
                .select("id,registro_clave,contenido,actualizado_en")
                .eq("estudio_id", estudioId)
                .eq("modulo", modulo)
                .order("registro_clave", { ascending: true })
                .range(desde, desde + lote - 1);
            if (error) throw error;
            filas.push(...(data || []));
            if (!data || data.length < lote) break;
        }
        return filas;
    }

    async function cargarNube() {
        if (!conectado || ocupado) return;
        ocupado = true;
        listo = false;
        actualizarDisponibilidad();
        mostrarEstado("Cargando Agenda y actividades relacionadas desde Supabase...");
        try {
            // Todas las consultas deben terminar antes de sustituir las vistas.
            const [filasAgenda, filasLives, filasTareas, filasProduccion] =
                await Promise.all([
                    leerModulo("agenda"),
                    leerModulo("lives"),
                    leerModulo("tareas"),
                    leerModulo("produccion")
                ]);

            const nuevasVersiones = new Map();
            const nuevasActividades = [];
            for (const fila of filasAgenda) {
                const a = fila.contenido;
                if (!fila.registro_clave?.startsWith("actividad:") ||
                    !a || typeof a !== "object" ||
                    typeof a.id !== "string" || !a.id) continue;
                nuevasVersiones.set(fila.registro_clave, {
                    id: fila.id,
                    actualizado_en: fila.actualizado_en
                });
                nuevasActividades.push(a);
            }

            const nuevasReferencias = {
                lives: filasLives.map(f => f.contenido)
                    .filter(l => l && typeof l === "object" && l.id),
                tareas: [],
                completadas: {},
                producciones: filasProduccion.map(f => f.contenido)
                    .filter(v => v && typeof v === "object" && v.id),
                jornadas: {}
            };
            for (const fila of filasTareas) {
                const clave = fila.registro_clave || "";
                const dato = fila.contenido;
                if (!dato || typeof dato !== "object") continue;
                if (clave.startsWith("tarea:") && typeof dato.id === "string") {
                    nuevasReferencias.tareas.push(dato);
                } else if (clave.startsWith("completada:") &&
                    typeof dato.fecha === "string" && typeof dato.id === "string") {
                    (nuevasReferencias.completadas[dato.fecha] ||= []).push(dato.id);
                } else if (clave.startsWith("jornada:") &&
                    typeof dato.fecha === "string" && typeof dato.tipo === "string") {
                    nuevasReferencias.jornadas[dato.fecha] = dato.tipo;
                }
            }

            versiones.clear();
            nuevasVersiones.forEach((valor, clave) => versiones.set(clave, valor));
            actividades = nuevasActividades;
            referencias = nuevasReferencias;
            listo = true;
            guardarCacheLocal();
            actualizarAgenda();
            pintarEstado();
        } catch (error) {
            console.error("Error al cargar Agenda desde Supabase", error);
            mostrarEstado(`No se pudo cargar Supabase: ${error.message || error}. Sin cambios habilitados.`, true);
        } finally {
            ocupado = false;
            actualizarDisponibilidad();
        }
    }

    async function iniciarSupabase() {
        try {
            if (!db) throw new Error("No se cargó supabase.js.");
            const { data, error } = await db.auth.getUser();
            if (error || !data?.user) throw new Error("Debes iniciar sesión.");
            usuarioId = data.user.id;
            const { data: estudio, error: errorEstudio } = await db.from("estudios")
                .select("id")
                .eq("propietario_id", usuarioId)
                .maybeSingle();
            if (errorEstudio || !estudio) throw new Error("No se encontró el estudio de esta cuenta.");
            const { data: miembro, error: errorMiembro } = await db.from("miembros_estudio")
                .select("rol,activo")
                .eq("estudio_id", estudio.id)
                .eq("usuario_id", usuarioId)
                .maybeSingle();
            if (errorMiembro || !miembro || miembro.rol !== "administrador" || miembro.activo !== true) {
                throw new Error("La cuenta no tiene acceso de administrador.");
            }
            estudioId = estudio.id;
            conectado = true;
            await cargarNube();
        } catch (error) {
            console.error("Agenda: no se pudo verificar acceso", error);
            mostrarEstado(`Agenda sin conexión autorizada: ${error.message || error}`, true);
            conectado = false;
            listo = false;
            actualizarDisponibilidad();
        }
    }

    // Actualiza o inserta UNA actividad, con control de versión en edición.
    async function guardarActividadRemota(actividad, esEdicion) {
        const clave = claveActividad(actividad.id);
        const previa = versiones.get(clave);
        if (esEdicion && !previa) throw new Error("La actividad ya no está disponible. Actualiza Agenda.");
        let consulta;
        if (previa) {
            const siguienteFecha = new Date(Math.max(
                Date.now(), Date.parse(previa.actualizado_en || "") + 1 || 0
            )).toISOString();
            consulta = db.from("registros_modulos")
                .update({ contenido: actividad, actualizado_en: siguienteFecha })
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
                    contenido: actividad,
                    creado_por: usuarioId
                })
                .select("id,actualizado_en").single();
        }
        const { data, error } = await consulta;
        if (error) throw error;
        if (!data) throw new Error("La actividad cambió desde otra computadora. Actualiza Supabase.");
        versiones.set(clave, data);
        actividades = esEdicion
            ? actividades.map(a => a.id === actividad.id ? actividad : a)
            : [...actividades, actividad];
    }

    async function borrarActividadRemota(id) {
        const clave = claveActividad(id);
        const previa = versiones.get(clave);
        if (!previa) throw new Error("La actividad ya no está cargada. Actualiza Supabase.");
        const { data, error } = await db.from("registros_modulos")
            .delete()
            .eq("id", previa.id)
            .eq("estudio_id", estudioId)
            .eq("modulo", MODULO_NUBE)
            .eq("actualizado_en", previa.actualizado_en)
            .select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("La actividad fue cambiada por otra computadora. Actualiza Supabase.");
        versiones.delete(clave);
        actividades = actividades.filter(a => a.id !== id);
    }

    async function ejecutarCambio(accion) {
        if (!listo || ocupado) return false;
        ocupado = true;
        actualizarDisponibilidad();
        try {
            await accion();
            guardarCacheLocal();
            actualizarAgenda();
            pintarEstado();
            return true;
        } catch (error) {
            console.error("Agenda: error guardando en Supabase", error);
            listo = false;  // No permitir continuar sobre una versión obsoleta.
            mostrarEstado(`No se aplicó el cambio: ${error.message || error}. Actualiza desde Supabase.`, true);
            return false;
        } finally {
            ocupado = false;
            actualizarDisponibilidad();
        }
    }

    function descargarRespaldo() {
        const blob = new Blob([JSON.stringify(leerRespaldo(), null, 2)], {
            type: "application/json;charset=utf-8"
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "abregu-studios-agenda-respaldo-local.json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importarLocales() {
        if (!listo || ocupado) return;
        const pendientes = pendientesImportar();
        if (!pendientes.length) return;
        if (!confirm(`¿Importar ${pendientes.length} actividades locales? Los registros existentes NO serán reemplazados.`)) return;
        ocupado = true;
        actualizarDisponibilidad();
        let importados = 0;
        let omitidos = 0;
        let fallo = null;
        try {
            for (const actividad of pendientes) {
                const { error } = await db.from("registros_modulos").insert({
                    estudio_id: estudioId,
                    modulo: MODULO_NUBE,
                    registro_clave: claveActividad(actividad.id),
                    contenido: actividad,
                    creado_por: usuarioId
                });
                if (error?.code === "23505") {
                    omitidos++;
                } else if (error) {
                    fallo = error;
                    break;
                } else {
                    importados++;
                }
            }
        } catch (error) {
            fallo = error;
        } finally {
            ocupado = false;
            actualizarDisponibilidad();
        }
        await cargarNube();
        if (fallo) {
            alert(`Importadas: ${importados}. Omitidas: ${omitidos}. Error: ${fallo.message}. El respaldo local se conserva.`);
        } else {
            alert(`Importadas: ${importados}. Omitidas o con conflicto: ${omitidos}. El respaldo local se conserva.`);
        }
    }

    botonActualizar.addEventListener("click", cargarNube);
    botonImportar.addEventListener("click", importarLocales);
    botonRespaldo.addEventListener("click", descargarRespaldo);
    actualizarDisponibilidad();

    // ======================================
    // 2. FUNCIONES DE FECHA
    // ======================================

    function fechaLocal(fecha = new Date()) {

        const anio = fecha.getFullYear();

        const mes = String(
            fecha.getMonth() + 1
        ).padStart(2, "0");

        const dia = String(
            fecha.getDate()
        ).padStart(2, "0");

        return `${anio}-${mes}-${dia}`;
    }

    function convertirFecha(texto) {

        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto || "")) {
            return null;
        }

        const [anio, mes, dia] =
            texto.split("-").map(Number);

        const fecha = new Date(
            anio, mes - 1, dia, 12
        );

        return fechaLocal(fecha) === texto
            ? fecha
            : null;
    }

    function sumarDias(fecha, cantidad) {

        const nueva = new Date(fecha);

        nueva.setDate(
            nueva.getDate() + cantidad
        );

        return nueva;
    }

    function inicioDeSemana(fecha) {

        const lunes = new Date(fecha);

        const diferencia =
            (lunes.getDay() + 6) % 7;

        lunes.setDate(
            lunes.getDate() - diferencia
        );

        return lunes;
    }

    function mostrarFecha(fecha) {

        return fecha.toLocaleDateString("es-PE", {
            weekday: "long",
            day: "numeric",
            month: "short"
        });
    }

    let fechaActiva = fechaLocal();

    let lunesActual = inicioDeSemana(
        convertirFecha(fechaActiva)
    );

    // ======================================
    // 3. FUNCIONES DE HORARIO
    // ======================================

    function minutos(hora) {

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(
            hora || ""
        )) {
            return null;
        }

        const [h, m] = hora.split(":").map(Number);

        return h * 60 + m;
    }

    function horaDesdeMinutos(total) {

        if (total >= 1440) {
            return "";
        }

        const hora = String(
            Math.floor(total / 60)
        ).padStart(2, "0");

        const minuto = String(
            total % 60
        ).padStart(2, "0");

        return `${hora}:${minuto}`;
    }

    // ======================================
    // 4. OBTENER EVENTOS DE OTROS MODULOS
    // ======================================

    function obtenerEventos(fecha) {

        const eventos = [];

        // ACTIVIDADES DE AGENDA

        actividades
            .filter(a => a.fecha === fecha)
            .forEach(a => {

                eventos.push({
                    ...a,
                    origen: "agenda"
                });

            });

        // LIVE CONTROL

        const lives = referencias.lives;

        lives.forEach(live => {

            if (
                live.fecha !== fecha ||
                live.estado === "cancelado"
            ) {
                return;
            }

            const inicio = minutos(live.hora);
            const duracion = Number(live.duracion);

            const fin =
                inicio !== null && duracion > 0
                    ? horaDesdeMinutos(
                        inicio + duracion
                    )
                    : "";

            eventos.push({

                id: `live-${live.id}`,
                origen: "live",
                tipo: "live",

                titulo: live.nombre || "LIVE",

                cliente: live.cliente,
                fecha: fecha,

                inicio: live.hora || "",
                fin: fin,

                lugar: "Estudio audiovisual",
                estado: live.estado,

                notas:
                    live.tema || "Tema por confirmar"
            });

        });

        // MIS TAREAS

        const tareas = referencias.tareas;

        const completadas = referencias.completadas;

        tareas.forEach(tarea => {

            if (
                !tarea.fecha ||
                fecha < tarea.fecha
            ) {
                return;
            }

            const diaActual =
                convertirFecha(fecha).getDay();

            const diaOriginal =
                convertirFecha(tarea.fecha)?.getDay();

            const corresponde =

                tarea.repeticion === "diaria" ||

                (
                    tarea.repeticion === "semanal" &&
                    diaActual === diaOriginal
                ) ||

                (
                    (
                        !tarea.repeticion ||
                        tarea.repeticion === "una-vez"
                    ) &&
                    fecha === tarea.fecha
                );

            if (!corresponde) return;

            const terminada =
                Array.isArray(completadas?.[fecha]) &&
                completadas[fecha].includes(tarea.id);

            eventos.push({

                id: `tarea-${tarea.id}-${fecha}`,

                origen: "tarea",

                tipo:
                    tarea.categoria || "otro",

                titulo:
                    tarea.titulo || "Tarea",

                cliente: tarea.cliente,

                fecha: fecha,

                inicio: tarea.horaInicio || "",
                fin: tarea.horaFin || "",

                estado: terminada
                    ? "completada"
                    : "pendiente",

                notas: tarea.descripcion || ""
            });

        });

        // PRODUCCION AUDIOVISUAL

        const producciones = referencias.producciones;

        producciones.forEach(video => {

            if (video.fechaGrabacion !== fecha) {
                return;
            }

            eventos.push({

                id: `video-${video.id}`,

                origen: "produccion",
                tipo: "grabacion",

                titulo:
                    `Grabación: ${video.nombre}`,

                cliente: video.marca,

                fecha: fecha,

                inicio: "",
                fin: "",

                lugar: video.locacion || "",

                estado: video.estado || "idea",

                notas: "Hora por coordinar"
            });

        });

        // ORDENAR POR HORA

        eventos.sort((a, b) => {

            if (!a.inicio) return b.inicio ? 1 : 0;
            if (!b.inicio) return -1;

            return a.inicio.localeCompare(
                b.inicio
            );
        });

        return eventos;
    }

    // ======================================
    // 5. OBTENER LA SEMANA
    // ======================================

    function obtenerSemana() {

        return Array.from(
            { length: 7 },
            (_, indice) => {

                const fecha = fechaLocal(
                    sumarDias(lunesActual, indice)
                );

                return {
                    fecha,
                    eventos: obtenerEventos(fecha)
                };
            }
        );
    }

    // ======================================
    // 6. CREAR ELEMENTOS VISUALES
    // ======================================

    function elemento(tag, texto, clase) {

        const nodo = document.createElement(tag);

        if (texto !== undefined) {
            nodo.textContent = texto;
        }

        if (clase) {
            nodo.className = clase;
        }

        return nodo;
    }

    function mostrarVacio(
        contenedor,
        titulo,
        descripcion
    ) {

        const caja = elemento(
            "div",
            undefined,
            "empty-state"
        );

        caja.append(
            elemento("h3", titulo),
            elemento("p", descripcion)
        );

        contenedor.appendChild(caja);
    }

    // ======================================
    // 7. TARJETAS DE EVENTOS
    // ======================================

    function crearTarjeta(evento, editable = false) {

        const tarjeta = elemento(
            "article",
            undefined,
            "production-card"
        );

        tarjeta.appendChild(
            elemento("h3", evento.titulo)
        );

        const horario = evento.inicio
            ? `${evento.inicio}${
                evento.fin
                    ? " - " + evento.fin
                    : " (fin por definir)"
            }`
            : "Hora por definir";

        tarjeta.appendChild(
            elemento(
                "p",
                `${horario} · ${
                    CLIENTES[evento.cliente] ||
                    evento.cliente ||
                    "General"
                }`
            )
        );

        tarjeta.appendChild(
            elemento(
                "p",
                `Tipo: ${evento.tipo || "otro"}`
            )
        );

        tarjeta.appendChild(
            elemento(
                "p",
                `Origen: ${evento.origen}`
            )
        );

        if (evento.estado) {

            tarjeta.appendChild(
                elemento(
                    "p",
                    `Estado: ${evento.estado}`
                )
            );
        }

        if (evento.lugar) {

            tarjeta.appendChild(
                elemento(
                    "p",
                    `Lugar: ${evento.lugar}`
                )
            );
        }

        if (evento.notas) {

            tarjeta.appendChild(
                elemento("p", evento.notas)
            );
        }

        // BOTONES PARA ACTIVIDADES PROPIAS

        if (
            editable &&
            evento.origen === "agenda"
        ) {

            const acciones = elemento(
                "div",
                undefined,
                "form-actions"
            );

            const editar = elemento(
                "button",
                "Editar"
            );

            editar.type = "button";

            editar.addEventListener(
                "click",
                () => editarActividad(evento.id)
            );

            const eliminar = elemento(
                "button",
                "Eliminar"
            );

            eliminar.type = "button";

            eliminar.addEventListener(
                "click",
                () => eliminarActividad(evento.id)
            );

            acciones.append(editar, eliminar);

            tarjeta.appendChild(acciones);
        }

        return tarjeta;
    }

    // ======================================
    // 8. ACTUALIZAR AGENDA
    // ======================================

    function actualizarAgenda() {

        const dias = obtenerSemana();

        const todos = dias.flatMap(
            dia => dia.eventos
        );

        const fin = sumarDias(
            lunesActual, 6
        );

        $("semana-actual").textContent =

            lunesActual.toLocaleDateString(
                "es-PE",
                {
                    day: "2-digit",
                    month: "short"
                }
            ) +

            " - " +

            fin.toLocaleDateString(
                "es-PE",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );

        // INDICADORES

        $("agenda-total").textContent =
            todos.length;

        $("agenda-grabaciones").textContent =
            todos.filter(
                e => e.tipo === "grabacion"
            ).length;

        $("agenda-lives").textContent =
            todos.filter(e =>

                e.origen === "live" &&

                [
                    "programado",
                    "preparacion",
                    "listo"
                ].includes(e.estado) &&

                Boolean(e.inicio)

            ).length;

        // HORAS PLANIFICADAS
        // Se combinan intervalos superpuestos.

        let minutosTotales = 0;

        dias.forEach(dia => {

            const intervalos = dia.eventos
                .map(e => [
                    minutos(e.inicio),
                    minutos(e.fin)
                ])
                .filter(([inicio, fin]) =>
                    inicio !== null &&
                    fin !== null &&
                    fin > inicio
                )
                .sort((a, b) => a[0] - b[0]);

            let actual = null;

            intervalos.forEach(([inicio, fin]) => {

                if (!actual) {

                    actual = [inicio, fin];

                } else if (inicio <= actual[1]) {

                    actual[1] = Math.max(
                        actual[1], fin
                    );

                } else {

                    minutosTotales +=
                        actual[1] - actual[0];

                    actual = [inicio, fin];
                }
            });

            if (actual) {

                minutosTotales +=
                    actual[1] - actual[0];
            }

        });

        $("agenda-horas").textContent =
            (minutosTotales / 60).toLocaleString(
                "es-PE",
                {
                    maximumFractionDigits: 1
                }
            );

        // ==================================
        // MOSTRAR SEMANA COMPLETA
        // ==================================

        listaSemana.replaceChildren();

        dias.forEach(dia => {

            const tarjeta = elemento(
                "section",
                undefined,
                "production-card"
            );

            tarjeta.appendChild(
                elemento(
                    "h3",
                    mostrarFecha(
                        convertirFecha(dia.fecha)
                    )
                )
            );

            // TIPO DE JORNADA

            const jornadas = referencias.jornadas;

            const tipoJornada =
                jornadas?.[dia.fecha];

            if (tipoJornada) {

                tarjeta.appendChild(
                    elemento(
                        "p",
                        `Jornada: ${tipoJornada}`
                    )
                );
            }

            // ACTIVIDADES

            if (!dia.eventos.length) {

                tarjeta.appendChild(
                    elemento(
                        "p",
                        "Sin actividades registradas"
                    )
                );

            }

            dia.eventos.forEach(evento => {

                const hora =
                    evento.inicio || "Sin hora";

                tarjeta.appendChild(
                    elemento(
                        "p",
                        `${hora} · ${evento.titulo}`
                    )
                );

            });

            listaSemana.appendChild(tarjeta);

        });

        // ==================================
        // MOSTRAR FECHA SELECCIONADA
        // ==================================

        selectorFecha.value = fechaActiva;

        listaDia.replaceChildren();

        const eventosDia =
            obtenerEventos(fechaActiva);

        if (!eventosDia.length) {

            mostrarVacio(
                listaDia,
                "Día sin actividades",
                "No hay eventos registrados."
            );

        } else {

            eventosDia.forEach(evento => {

                listaDia.appendChild(
                    crearTarjeta(evento)
                );

            });
        }

        // ==================================
        // ACTIVIDADES ADICIONALES
        // ==================================

        listaAdicional.replaceChildren();

        if (!actividades.length) {

            mostrarVacio(
                listaAdicional,
                "Sin actividades adicionales",
                "Crea reuniones, traslados o eventos."
            );

        } else {

            [...actividades]
                .sort((a, b) =>

                    `${a.fecha} ${a.inicio}`
                        .localeCompare(
                            `${b.fecha} ${b.inicio}`
                        )

                )
                .forEach(evento => {

                    listaAdicional.appendChild(
                        crearTarjeta(
                            {
                                ...evento,
                                origen: "agenda"
                            },
                            true
                        )
                    );

                });
        }
    }

    // ======================================
    // 9. DETECTAR CRUCES DE HORARIOS
    // ======================================

    function detectarCruces(nuevo) {

        const inicio = minutos(nuevo.inicio);
        const fin = minutos(nuevo.fin);

        return obtenerEventos(nuevo.fecha)
            .filter(evento => {

                if (
                    evento.origen === "agenda" &&
                    evento.id === nuevo.id
                ) {
                    return false;
                }

                const otroInicio =
                    minutos(evento.inicio);

                const otroFin =
                    minutos(evento.fin);

                return (
                    otroInicio !== null &&
                    otroFin !== null &&
                    inicio < otroFin &&
                    otroInicio < fin
                );
            });
    }

    // ======================================
    // 10. REGISTRAR ACTIVIDADES
    // ======================================

    formulario.addEventListener(
        "submit",
        async eventoFormulario => {

            eventoFormulario.preventDefault();
            if (!listo || ocupado) return;

            if (!formulario.reportValidity()) {
                return;
            }

            const actividad = {

                id: idEditando ||
                    (
                        window.crypto?.randomUUID?.() ||
                        `${Date.now()}-${Math.random()}`
                    ),

                titulo:
                    $("actividad-titulo").value.trim(),

                tipo:
                    $("actividad-tipo").value,

                cliente:
                    $("actividad-cliente").value,

                fecha:
                    $("actividad-fecha").value,

                inicio:
                    $("actividad-inicio").value,

                fin:
                    $("actividad-fin").value,

                lugar:
                    $("actividad-lugar").value,

                prioridad:
                    $("actividad-prioridad").value,

                notas:
                    $("actividad-notas").value.trim()

            };

            // VALIDAR HORARIOS

            if (
                !actividad.titulo ||
                !convertirFecha(actividad.fecha) ||
                minutos(actividad.fin) <=
                minutos(actividad.inicio)
            ) {

                alert(
                    "Revisa la fecha y las horas. " +
                    "La hora final debe ser posterior."
                );

                return;
            }

            // DETECTAR CRUCES

            const cruces =
                detectarCruces(actividad);

            if (cruces.length > 0) {

                const continuar = confirm(
                    `Este horario coincide con ` +
                    `${cruces.length} actividad(es). ` +
                    `¿Deseas guardarlo igualmente?`
                );

                if (!continuar) return;
            }

            const eraEdicion = Boolean(idEditando);
            const guardado = await ejecutarCambio(
                () => guardarActividadRemota(actividad, eraEdicion)
            );
            if (!guardado) return;

            idEditando = null;

            formulario.reset();

            botonGuardar.textContent =
                "Guardar actividad";

            fechaActiva = actividad.fecha;

            lunesActual = inicioDeSemana(
                convertirFecha(fechaActiva)
            );

            $("actividad-fecha").value =
                fechaActiva;

            actualizarAgenda();

            alert(
                "¡Actividad guardada correctamente!"
            );
        }
    );

    // ======================================
    // 11. EDITAR ACTIVIDADES
    // ======================================

    function editarActividad(id) {

        const actividad = actividades.find(
            item => item.id === id
        );

        if (!actividad) return;

        idEditando = id;

        const campos = {

            "actividad-titulo": actividad.titulo,
            "actividad-tipo": actividad.tipo,
            "actividad-cliente": actividad.cliente,

            "actividad-fecha": actividad.fecha,

            "actividad-inicio": actividad.inicio,
            "actividad-fin": actividad.fin,

            "actividad-lugar": actividad.lugar,

            "actividad-prioridad":
                actividad.prioridad,

            "actividad-notas": actividad.notas
        };

        Object.entries(campos).forEach(
            ([idCampo, valor]) => {

                $(idCampo).value = valor || "";

            }
        );

        botonGuardar.textContent =
            "Guardar cambios";

        $("nueva-actividad").scrollIntoView({
            behavior: "smooth"
        });
    }

    // ======================================
    // 12. ELIMINAR ACTIVIDADES
    // ======================================

    async function eliminarActividad(id) {
        if (!listo || ocupado) return;

        if (!confirm(
            "¿Seguro que deseas eliminar esta actividad?"
        )) {
            return;
        }

        const eliminado = await ejecutarCambio(
            () => borrarActividadRemota(id)
        );
        if (!eliminado) return;

        if (idEditando === id) {

            idEditando = null;
            formulario.reset();
        }

        actualizarAgenda();
    }

    // ======================================
    // 13. LIMPIAR FORMULARIO
    // ======================================

    formulario.addEventListener("reset", () => {

        idEditando = null;

        botonGuardar.textContent =
            "Guardar actividad";

    });

    // ======================================
    // 14. NAVEGAR ENTRE SEMANAS
    // ======================================

    function moverSemana(cantidadDias) {

        fechaActiva = fechaLocal(
            sumarDias(
                convertirFecha(fechaActiva),
                cantidadDias
            )
        );

        lunesActual = inicioDeSemana(
            convertirFecha(fechaActiva)
        );

        actualizarAgenda();
    }

    $("semana-anterior").disabled = false;
    $("semana-siguiente").disabled = false;
    $("semana-hoy").disabled = false;

    $("semana-anterior").addEventListener(
        "click",
        () => moverSemana(-7)
    );

    $("semana-siguiente").addEventListener(
        "click",
        () => moverSemana(7)
    );

    $("semana-hoy").addEventListener(
        "click",
        () => {

            fechaActiva = fechaLocal();

            lunesActual = inicioDeSemana(
                convertirFecha(fechaActiva)
            );

            actualizarAgenda();
        }
    );

    // ======================================
    // 15. SELECCIONAR FECHA
    // ======================================

    selectorFecha.disabled = false;

    selectorFecha.addEventListener(
        "change",
        () => {

            if (!convertirFecha(
                selectorFecha.value
            )) {
                return;
            }

            fechaActiva = selectorFecha.value;

            lunesActual = inicioDeSemana(
                convertirFecha(fechaActiva)
            );

            actualizarAgenda();
        }
    );

    // ======================================
    // 16. INICIAR AGENDA
    // ======================================

    actualizarDisponibilidad();

    $("actividad-fecha").value = fechaActiva;

    const ayuda = formulario.querySelector(
        ".helper-text"
    );

    if (ayuda) {

        ayuda.textContent =
            "Las actividades se guardan en Supabase. " +
            "Los LIVE, tareas y grabaciones se consultan también en la nube.";
    }

    // En otras pestañas solo actualizamos desde Supabase.
    window.addEventListener("storage", evento => {
        if (evento.key === CLAVE && conectado && !ocupado) {
            cargarNube();
        }
    });

    // Al regresar al navegador, consultar cambios externos sin sobrescribir
    // las fichas en edición; el control de versión evita pisar cambios ajenos.
    window.addEventListener("focus", () => {
        if (conectado && !ocupado) cargarNube();
    });

    actualizarAgenda();
    iniciarSupabase();

    console.log(
        "ABREGU STUDIOS: Agenda Semanal con Supabase inicializada."
    );

});