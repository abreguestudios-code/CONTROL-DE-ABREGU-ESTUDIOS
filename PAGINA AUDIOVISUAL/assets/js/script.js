/* ==========================================
   ABREGU STUDIOS
   Panel principal — Resumen conectado a Supabase

   Mantiene los mismos elementos HTML y las claves
   compartidas del proyecto. La nube es la fuente
   de datos; este panel NO sobrescribe localStorage.
========================================== */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const $ = id => document.getElementById(id);
    const db = window.abreguDB;
    const MODULOS = ["produccion", "publicaciones", "resumen", "tareas", "configuracion"];
    const MARCAS = ["abregu", "fuze", "kintex", "caedla"];
    const METAS_PREDETERMINADAS = { abregu: 4, fuze: 7, kintex: 2, caedla: 3 };
    const PUNTOS_PREDETERMINADOS = { video: 10, tarea: 3 };

    let estudioId = null;
    let usuarioId = null;
    let conectado = false;
    let ocupado = false;
    let errorActual = false;
    let producciones = [];
    let publicacionesExternas = [];
    let tareasPersonalizadas = [];
    let completadasPersonalizadas = {};
    let rutinasCompletadas = {};
    let configuracion = null;
    let versionesRutinas = new Map();

    function fechaLocal(fecha = new Date()) {
        const anio = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const dia = String(fecha.getDate()).padStart(2, "0");
        return `${anio}-${mes}-${dia}`;
    }

    function fechaValida(valor) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || "")) return false;
        const fecha = new Date(`${valor}T12:00:00`);
        return !Number.isNaN(fecha.getTime()) && fechaLocal(fecha) === valor;
    }

    function inicioDeSemana(fecha) {
        const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
        lunes.setDate(lunes.getDate() - (lunes.getDay() + 6) % 7);
        return lunes;
    }

    function configuracionNumero(valor, defecto, maximo) {
        if (valor === null || valor === undefined || valor === "") return defecto;
        const numero = Number(valor);
        return Number.isInteger(numero) && numero >= 0 && numero <= maximo
            ? numero : defecto;
    }

    function reglas() {
        const metas = {};
        for (const marca of MARCAS) {
            metas[marca] = configuracionNumero(
                configuracion?.metas?.[marca], METAS_PREDETERMINADAS[marca], 100
            );
        }
        return {
            metas,
            puntosVideo: configuracionNumero(
                configuracion?.puntos?.video, PUNTOS_PREDETERMINADOS.video, 1000
            ),
            puntosTarea: configuracionNumero(
                configuracion?.puntos?.tarea, PUNTOS_PREDETERMINADOS.tarea, 1000
            )
        };
    }

    // Rutinas exactamente iguales a las de Mis tareas.
        const tareasSemanales = {

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

    const nombresDias = [
        "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
    ];

    const listaTareas = $("lista-tareas");
    const main = document.querySelector("main") || document.body;

    // Estado y actualización, sin necesidad de editar index.html.
    const panel = document.createElement("section");
    panel.className = "production-card";
    panel.style.cssText = "padding:14px;margin:16px 0 20px;border-left:3px solid #e32643";
    const estado = document.createElement("p");
    estado.setAttribute("role", "status");
    estado.setAttribute("aria-live", "polite");
    estado.textContent = "Conectando Resumen con Supabase...";
    const botonActualizar = document.createElement("button");
    botonActualizar.type = "button";
    botonActualizar.textContent = "Actualizar desde Supabase";
    botonActualizar.style.cssText = "padding:10px 14px;border-radius:8px;cursor:pointer";
    botonActualizar.disabled = true;
    panel.append(estado, botonActualizar);
    const cabecera = main.querySelector(":scope > header");
    if (cabecera) cabecera.after(panel);
    else main.prepend(panel);

    function mensaje(texto, error = false) {
        estado.textContent = texto;
        estado.style.color = error ? "#ff8092" : "";
        errorActual = error;
    }

    function fijarTexto(id, valor) {
        const elemento = $(id);
        if (elemento) elemento.textContent = String(valor);
    }

    function controles() {
        botonActualizar.disabled = ocupado || !db;
        if (listaTareas) {
            listaTareas.querySelectorAll("[role=checkbox]").forEach(elemento => {
                elemento.tabIndex = conectado && !ocupado ? 0 : -1;
                elemento.setAttribute("aria-disabled", String(!conectado || ocupado));
                elemento.style.cursor = conectado && !ocupado ? "pointer" : "not-allowed";
                elemento.style.opacity = conectado ? "1" : "0.65";
            });
        }
    }

    function sinDatos() {
        for (const id of [
            "tareas-pendientes", "videos-publicados", "puntos-obtenidos", "meta-semanal"
        ]) fijarTexto(id, "—");
        for (const marca of MARCAS) {
            fijarTexto(`${marca}-publicados`, "—");
            const progreso = $(`progreso-${marca}`);
            if (progreso) { progreso.max = 1; progreso.value = 0; }
        }
        if (listaTareas) {
            listaTareas.replaceChildren();
            const li = document.createElement("li");
            li.textContent = "No se pudieron cargar las tareas desde Supabase.";
            listaTareas.appendChild(li);
        }
    }

    function tareasParaFecha(fecha) {
        const rutina = tareasSemanales[new Date(`${fecha}T12:00:00`).getDay()] || [];
        const hechas = new Set(rutinasCompletadas[fecha] || []);
        const rutinaHecha = rutina.filter((_, indice) => hechas.has(indice)).length;
        const personalizadas = tareasPersonalizadas.filter(tarea => {
            if (!fechaValida(tarea.fecha) || fecha < tarea.fecha) return false;
            if (tarea.repeticion === "diaria") return true;
            if (tarea.repeticion === "semanal") {
                return new Date(`${fecha}T12:00:00`).getDay() ===
                    new Date(`${tarea.fecha}T12:00:00`).getDay();
            }
            return tarea.fecha === fecha;
        });
        const personalizadasHechas = new Set(completadasPersonalizadas[fecha] || []);
        const hechasPersonalizadas = personalizadas.filter(tarea =>
            personalizadasHechas.has(String(tarea.id))
        ).length;
        return {
            total: rutina.length + personalizadas.length,
            terminadas: rutinaHecha + hechasPersonalizadas
        };
    }

    function publicacionesDeSemana(lunes, fin) {
        const unicas = new Map();
        const esDelPeriodo = fecha => fechaValida(fecha) && fecha >= lunes && fecha <= fin;
        // Producción es la fuente principal de las publicaciones.
        for (const p of producciones) {
            if (p.estado !== "publicado" || !esDelPeriodo(p.fechaPublicacion) ||
                !MARCAS.includes(p.marca) || p.id == null) continue;
            unicas.set(String(p.id), {
                id: String(p.id), marca: p.marca, fecha: p.fechaPublicacion
            });
        }
        // Publicaciones de otros orígenes, si las hay: no duplicar por ID.
        for (const p of publicacionesExternas) {
            if (!esDelPeriodo(p.fecha) || !MARCAS.includes(p.marca) || p.id == null) continue;
            const id = String(p.id);
            if (!unicas.has(id)) unicas.set(id, {
                id, marca: p.marca, fecha: p.fecha
            });
        }
        return [...unicas.values()];
    }

    function mostrarTareas() {
        if (!listaTareas) return;
        listaTareas.replaceChildren();
        const ahora = new Date();
        const hoy = fechaLocal(ahora);
        const rutinas = tareasSemanales[ahora.getDay()] || [];
        const marcadas = new Set(rutinasCompletadas[hoy] || []);
        for (const [indice, texto] of rutinas.entries()) {
            const li = document.createElement("li");
            const completada = marcadas.has(indice);
            li.textContent = completada ? `✓ ${texto}` : texto;
            li.setAttribute("role", "checkbox");
            li.setAttribute("aria-checked", String(completada));
            li.setAttribute("aria-disabled", String(!conectado || ocupado));
            li.tabIndex = conectado && !ocupado ? 0 : -1;
            li.style.cursor = conectado && !ocupado ? "pointer" : "not-allowed";
            if (completada) {
                li.style.background = "rgba(229, 28, 56, 0.12)";
                li.style.borderColor = "#e51c38";
                li.style.color = "#f7f5f4";
            }
            li.addEventListener("click", () => alternarRutina(hoy, indice));
            li.addEventListener("keydown", evento => {
                if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    alternarRutina(hoy, indice);
                }
            });
            listaTareas.appendChild(li);
        }
    }

    function actualizarIndicadores() {
        const ahora = new Date();
        const hoy = fechaLocal(ahora);
        fijarTexto("fecha-actual", ahora.toLocaleDateString("es-PE", {
            weekday: "long", day: "numeric", month: "long", year: "numeric"
        }));
        fijarTexto("dia-actual", `Actividades del ${nombresDias[ahora.getDay()]}`);
        if (!conectado) { sinDatos(); return; }

        const { metas, puntosTarea, puntosVideo } = reglas();
        const inicio = inicioDeSemana(ahora);
        const lunes = fechaLocal(inicio);
        const domingo = new Date(inicio);
        domingo.setDate(domingo.getDate() + 6);
        const videos = publicacionesDeSemana(lunes, fechaLocal(domingo));

        const hoyTareas = tareasParaFecha(hoy);
        fijarTexto("tareas-pendientes", Math.max(0, hoyTareas.total - hoyTareas.terminadas));
        fijarTexto("videos-publicados", videos.length);

        let tareasHechasSemana = 0;
        // Solo fechas transcurridas; evita contar tareas "futuras".
        for (let i = 0; i < 7; i++) {
            const dia = new Date(inicio);
            dia.setDate(dia.getDate() + i);
            if (fechaLocal(dia) > hoy) break;
            tareasHechasSemana += tareasParaFecha(fechaLocal(dia)).terminadas;
        }
        fijarTexto("puntos-obtenidos",
            tareasHechasSemana * puntosTarea + videos.length * puntosVideo);
        fijarTexto("meta-semanal", Object.values(metas).reduce((a, b) => a + b, 0));

        for (const [marca, meta] of Object.entries(metas)) {
            const cantidad = videos.filter(p => p.marca === marca).length;
            fijarTexto(`${marca}-publicados`, cantidad);
            const progreso = $(`progreso-${marca}`);
            if (progreso) {
                progreso.max = Math.max(1, meta);
                progreso.value = Math.min(cantidad, meta);
            }
        }
    }

    function claveRutina(fecha, indice) { return `rutina:${fecha}:${indice}`; }

    // Lectura por páginas: compatible con el límite de filas de Supabase.
    async function leerFilas() {
        const filas = [];
        const tamano = 500;
        for (let desde = 0; ; desde += tamano) {
            const { data, error } = await db.from("registros_modulos")
                .select("id,modulo,registro_clave,contenido,actualizado_en")
                .eq("estudio_id", estudioId)
                .in("modulo", MODULOS)
                .order("id", { ascending: true })
                .range(desde, desde + tamano - 1);
            if (error) throw error;
            filas.push(...(data || []));
            if (!data || data.length < tamano) break;
        }
        return filas;
    }

    function aplicarFilas(filas) {
        const produccionesNuevas = [];
        const publicacionesNuevas = [];
        const tareasNuevas = [];
        const completasNuevas = {};
        const rutinasNuevas = {};
        const versionesNuevas = new Map();
        let configNueva = null;

        for (const fila of filas) {
            const dato = fila.contenido;
            if (!dato || typeof dato !== "object" || Array.isArray(dato)) continue;
            const clave = String(fila.registro_clave || "");
            switch (fila.modulo) {
                case "produccion":
                    if (dato.id != null && String(dato.id) === clave) {
                        produccionesNuevas.push(dato);
                    }
                    break;
                case "publicaciones":
                case "resumen":
                    if (dato.id != null && fechaValida(dato.fecha) && dato.marca) {
                        publicacionesNuevas.push(dato);
                    }
                    break;
                case "tareas":
                    if (dato.id != null && typeof dato.id === "string" &&
                        clave === `tarea:${encodeURIComponent(dato.id)}`) {
                        tareasNuevas.push(dato);
                    } else if (fechaValida(dato.fecha) && typeof dato.id === "string" &&
                        clave === `completada:${dato.fecha}:${encodeURIComponent(dato.id)}`) {
                        (completasNuevas[dato.fecha] ||= []).push(String(dato.id));
                    } else if (fechaValida(dato.fecha) && Number.isInteger(dato.indice) &&
                        clave === claveRutina(dato.fecha, dato.indice)) {
                        (rutinasNuevas[dato.fecha] ||= []).push(dato.indice);
                        versionesNuevas.set(clave, {
                            id: fila.id, actualizado_en: fila.actualizado_en
                        });
                    }
                    break;
                case "configuracion":
                    if (clave === "ajustes" &&
                        (dato.metas && typeof dato.metas === "object" ||
                         dato.puntos && typeof dato.puntos === "object")) {
                        configNueva = dato;
                    }
                    break;
            }
        }
        // El estado se actualiza solo cuando la lectura completa tuvo éxito.
        producciones = produccionesNuevas;
        publicacionesExternas = publicacionesNuevas;
        tareasPersonalizadas = tareasNuevas;
        completadasPersonalizadas = completasNuevas;
        rutinasCompletadas = rutinasNuevas;
        versionesRutinas = versionesNuevas;
        configuracion = configNueva;
        conectado = true;
        actualizarIndicadores();
        mostrarTareas();
        controles();
    }

    async function autorizar() {
        if (!db) throw new Error("No se encontró window.abreguDB. Revisa los scripts de index.html.");
        const { data: sesion, error: errorUsuario } = await db.auth.getUser();
        if (errorUsuario || !sesion?.user) throw new Error("Inicia sesión para ver el Resumen.");
        usuarioId = sesion.user.id;
        const { data: estudio, error: errorEstudio } = await db.from("estudios")
            .select("id").eq("propietario_id", usuarioId).maybeSingle();
        if (errorEstudio) throw errorEstudio;
        if (!estudio) throw new Error("No se encontró un estudio autorizado para esta cuenta.");
        estudioId = estudio.id;
    }

    function estadoConectado() {
        const textoConfig = configuracion
            ? " Metas y puntos recuperados de Configuración."
            : " No hay configuración en la nube; usando metas y puntos predeterminados.";
        mensaje(
            `Supabase conectado: ${producciones.length} producciones, ` +
            `${tareasPersonalizadas.length} tareas y ` +
            `${Object.values(rutinasCompletadas).reduce((s, a) => s + a.length, 0)} rutinas marcadas.` +
            textoConfig
        );
    }

    async function recargar() {
        if (ocupado) return;
        ocupado = true;
        conectado = false;
        mensaje("Actualizando el Resumen desde Supabase...");
        actualizarIndicadores();
        controles();
        try {
            if (!estudioId) await autorizar();
            const filas = await leerFilas();
            aplicarFilas(filas);
            estadoConectado();
        } catch (error) {
            conectado = false;
            console.error("Error cargando Resumen de Supabase", error);
            mensaje(`No se pudo cargar el Resumen: ${error.message || error}. No se muestran cifras locales antiguas.`, true);
            actualizarIndicadores();
        } finally {
            ocupado = false;
            controles();
        }
    }

    function fechaVersionPosterior(anterior) {
        const previa = Date.parse(anterior || "") || 0;
        return new Date(Math.max(Date.now(), previa + 1)).toISOString();
    }

    async function alternarRutina(fecha, indice) {
        if (!conectado || ocupado || !estudioId || !fechaValida(fecha)) return;
        // El mismo esquema que utiliza tareas.js; nada se escribe en localStorage.
        const clave = claveRutina(fecha, indice);
        const previa = versionesRutinas.get(clave);
        ocupado = true;
        controles();
        mensaje("Guardando la rutina en Supabase...");
        let escrituraConfirmada = false;
        try {
            let consulta;
            if (previa) {
                consulta = db.from("registros_modulos")
                    .delete()
                    .eq("id", previa.id)
                    .eq("estudio_id", estudioId)
                    .eq("modulo", "tareas")
                    .eq("registro_clave", clave)
                    .eq("actualizado_en", previa.actualizado_en)
                    .select("id").maybeSingle();
            } else {
                consulta = db.from("registros_modulos")
                    .insert({
                        estudio_id: estudioId,
                        modulo: "tareas",
                        registro_clave: clave,
                        contenido: { fecha, indice },
                        creado_por: usuarioId
                    })
                    .select("id").single();
            }
            const { data, error } = await consulta;
            if (error) throw error;
            if (!data) throw new Error("Esta rutina cambió en otra sesión. Actualiza el Resumen antes de repetir.");
            escrituraConfirmada = true;
            // Releer la vista completa después de guardar; sin actualizaciones ilusorias.
            const filas = await leerFilas();
            aplicarFilas(filas);
            estadoConectado();
        } catch (error) {
            console.error("No se pudo actualizar la rutina", error);
            conectado = false;
            mensaje(
                `${escrituraConfirmada ? "La rutina pudo guardarse, pero falló la actualización" : "No se guardó la rutina"}: ` +
                `${error.message || error}. Pulsa «Actualizar desde Supabase» para reconciliar los datos.`,
                true
            );
            actualizarIndicadores();
        } finally {
            ocupado = false;
            controles();
        }
    }

    botonActualizar.addEventListener("click", recargar);
    // Si vienes de Mis tareas, refrescar la nube al volver al Resumen.
    window.addEventListener("focus", () => {
        if (!ocupado && !errorActual && conectado) recargar();
    });
    // Solo se sincroniza por lectura; otras páginas siguen gestionando sus propios datos.
    recargar();
});