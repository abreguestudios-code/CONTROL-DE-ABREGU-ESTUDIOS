
/* ==========================================

   ABREGU STUDIOS

   MODULO: INFORMES Y PUNTOS

   Responsable: SAMGIUK INGA

========================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    const $ = id => document.getElementById(id);

/* ==========================================

   CONFIGURACION COMPARTIDA

========================================== */

function obtenerConfiguracion() {

    try {

        const datos = JSON.parse(

            localStorage.getItem(

                "aa_configuracion"

            ) || "{}"

        );

        return (

            datos &&

            typeof datos === "object" &&

            !Array.isArray(datos)

        ) ? datos : {};

    } catch (error) {

        console.warn(

            "Usando configuración predeterminada.",

            error

        );

        return {};

    }

}

function numeroConfig(valor, defecto, maximo) {

    if (

        valor === null ||

        valor === undefined ||

        valor === ""

    ) {

        return defecto;

    }

    const numero = Number(valor);

    return (

        Number.isInteger(numero) &&

        numero >= 0 &&

        numero <= maximo

    ) ? numero : defecto;

}

const CONFIG = obtenerConfiguracion();

let PUNTOS_VIDEO = numeroConfig(

    CONFIG.puntos?.video,

    10,

    1000

);

let PUNTOS_TAREA = numeroConfig(

    CONFIG.puntos?.tarea,

    3,

    1000

);

let METAS = {

    abregu: numeroConfig(

        CONFIG.metas?.abregu,

        4,

        100

    ),

    fuze: numeroConfig(

        CONFIG.metas?.fuze,

        7,

        100

    ),

    kintex: numeroConfig(

        CONFIG.metas?.kintex,

        2,

        100

    ),

    caedla: numeroConfig(

        CONFIG.metas?.caedla,

        3,

        100

    )

};

    const MARCAS = {

        abregu: "ABREGU PRINT",

        fuze: "FUZE",

        kintex: "KINTEX",

        caedla: "CAEDLA"

    };

    const CLAVE_NOTAS = "aa_informes_observaciones";

    const CAMPOS_NOTAS = [

        "informe-logros",

        "informe-dificultades",

        "informe-pendientes",

        "informe-proximos",

        "informe-comentarios"

    ];

    const tipo = $("tipo-informe");

    const fechaInput = $("fecha-informe");

    const formulario = $("form-observaciones");

    if (!tipo || !fechaInput || !formulario) {

        console.error("Faltan elementos de informes.html");

        return;

    }

    // ======================================

    // 1. ALMACENAMIENTO

    // ======================================

    // Los informes se construyen con una fotografía de datos de Supabase.
    // NO se hidrata localStorage para evitar exponer datos de otras páginas
    // y NO se mezclan registros viejos del navegador con los de la nube.
    let DATOS_NUBE = Object.create(null);
    let listoNube = false;
    let ocupadoNube = false;
    let estudioId = null;
    let usuarioId = null;
    const db = window.abreguDB;
    const versionesNotas = new Map();

    const MODULOS_LEER = [
        "produccion", "publicaciones", "resumen", "tareas", "lives",
        "asistencia", "informes", "configuracion"
    ];
    const claveNota = periodo => `observaciones:${periodo}`;
    const esObjeto = d => d && typeof d === "object" && !Array.isArray(d);
    const esFecha = f => /^\d{4}-\d{2}-\d{2}$/.test(f || "");

    function leer(clave, valorInicial) {
        const valor = DATOS_NUBE[clave];
        return valor === undefined ? valorInicial : valor;
    }

    // La información previa solo se usa para descargar respaldo / importarla.
    function leerNotasLocales() {
        try {
            const valor = JSON.parse(localStorage.getItem(CLAVE_NOTAS) || "{}");
            return esObjeto(valor) ? valor : {};
        } catch (error) {
            console.warn("No se pudo leer el respaldo local de observaciones", error);
            return {};
        }
    }

    const panelNube = document.createElement("section");
    panelNube.className = "production-card";
    panelNube.style.cssText =
        "padding:15px;margin:16px 0 22px;border-left:3px solid #e53d54";
    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    estadoNube.textContent = "Conectando informes a Supabase...";
    const accionesNube = document.createElement("div");
    accionesNube.className = "form-actions";
    const botonActualizar = document.createElement("button");
    botonActualizar.type = "button";
    botonActualizar.textContent = "Actualizar desde Supabase";
    const botonImportar = document.createElement("button");
    botonImportar.type = "button";
    botonImportar.textContent = "Importar observaciones antiguas";
    const botonRespaldo = document.createElement("button");
    botonRespaldo.type = "button";
    botonRespaldo.textContent = "Descargar respaldo de observaciones";
    accionesNube.append(botonActualizar, botonImportar, botonRespaldo);
    panelNube.append(estadoNube, accionesNube);
    const principal = document.querySelector("main") || document.body;
    const encabezado = principal.querySelector(":scope > header");
    if (encabezado) encabezado.after(panelNube);
    else principal.prepend(panelNube);

    function mensajeNube(mensaje, error = false) {
        estadoNube.textContent = mensaje;
        estadoNube.style.color = error ? "#ff8492" : "";
    }

    function notasPendientes() {
        const nube = DATOS_NUBE[CLAVE_NOTAS] || {};
        return Object.entries(leerNotasLocales()).filter(([clave, valor]) =>
            /^(diario|semanal):\d{4}-\d{2}-\d{2}$/.test(clave) &&
            esObjeto(valor) && !Object.hasOwn(nube, clave)
        );
    }

    function controlarAcceso() {
        const bloqueo = !listoNube || ocupadoNube;
        $("guardar-observaciones").disabled = bloqueo;
        $("imprimir-informe").disabled = bloqueo;
        $("exportar-informe-csv").disabled = bloqueo;
        $("consultar-informe").disabled = ocupadoNube;
        botonActualizar.disabled = ocupadoNube;
        botonImportar.hidden = !listoNube || notasPendientes().length === 0;
        botonImportar.disabled = bloqueo || notasPendientes().length === 0;
    }

    async function leerFilas() {
        // PostgreSQL/PostgREST devuelve lotes; no truncar históricos >1000.
        const resultado = [];
        const tamano = 500;
        for (let desde = 0; ; desde += tamano) {
            const { data, error } = await db.from("registros_modulos")
                .select("id,modulo,registro_clave,contenido,actualizado_en")
                .eq("estudio_id", estudioId)
                .in("modulo", MODULOS_LEER)
                .order("id", { ascending: true })
                .range(desde, desde + tamano - 1);
            if (error) throw error;
            resultado.push(...(data || []));
            if (!data || data.length < tamano) break;
        }
        return resultado;
    }

    function construirDatosNube(filas) {
        const resultado = {
            aa_producciones: [], aa_videos_publicados: [],
            aa_tareas_personalizadas: [],
            aa_tareas_personales_completadas: {},
            aa_tareas_diarias: {}, aa_jornadas: {},
            aa_lives: [], aa_asistencias: [],
            aa_informes_observaciones: {}
        };
        const notasVersion = new Map();
        let configNube = null;
        for (const fila of filas) {
            const d = fila.contenido;
            if (!esObjeto(d)) continue;
            const clave = String(fila.registro_clave || "");
            switch (fila.modulo) {
                case "produccion":
                    if (d.id != null && String(d.id) === clave) {
                        resultado.aa_producciones.push(d);
                    }
                    break;
                case "lives":
                    if (d.id != null && String(d.id) === clave) {
                        resultado.aa_lives.push(d);
                    }
                    break;
                case "asistencia":
                    if (esFecha(d.fecha) && clave === `asistencia:${d.fecha}`) {
                        resultado.aa_asistencias.push(d);
                    }
                    break;
                case "tareas":
                    if (clave.startsWith("tarea:") &&
                        clave === `tarea:${encodeURIComponent(String(d.id))}`) {
                        resultado.aa_tareas_personalizadas.push(d);
                    } else if (esFecha(d.fecha) && typeof d.id === "string" &&
                        clave === `completada:${d.fecha}:${encodeURIComponent(d.id)}`) {
                        (resultado.aa_tareas_personales_completadas[d.fecha] ||= []).push(d.id);
                    } else if (esFecha(d.fecha) && Number.isInteger(d.indice) &&
                        clave === `rutina:${d.fecha}:${d.indice}`) {
                        (resultado.aa_tareas_diarias[d.fecha] ||= []).push(d.indice);
                    } else if (esFecha(d.fecha) && typeof d.tipo === "string" &&
                        clave === `jornada:${d.fecha}`) {
                        resultado.aa_jornadas[d.fecha] = d.tipo;
                    }
                    break;
                case "publicaciones":
                case "resumen":
                    // Publicaciones creadas fuera de Producción, si el módulo
                    // Resumen las registra luego como filas individuales.
                    if (esFecha(d.fecha) && d.id != null && d.marca) {
                        resultado.aa_videos_publicados.push(d);
                    }
                    break;
                case "informes":
                    if (clave.startsWith("observaciones:") &&
                        /^(diario|semanal):\d{4}-\d{2}-\d{2}$/.test(clave.slice(14))) {
                        const periodo = clave.slice(14);
                        resultado.aa_informes_observaciones[periodo] = d;
                        notasVersion.set(clave, {
                            id: fila.id, actualizado_en: fila.actualizado_en
                        });
                    }
                    break;
                case "configuracion":
                    if (esObjeto(d.puntos) || esObjeto(d.metas)) configNube = d;
                    break;
            }
        }
        // La producción publicada se cuenta aunque el Resumen no haya
        // abierto su módulo: se evita doble conteo por ID más adelante.
        for (const p of resultado.aa_producciones) {
            if (p.estado === "publicado" && esFecha(p.fechaPublicacion)) {
                resultado.aa_videos_publicados.push({
                    id: p.id, nombre: p.nombre, marca: p.marca,
                    fecha: p.fechaPublicacion, origen: "produccion"
                });
            }
        }
        return { resultado, notasVersion, configNube };
    }

    function establecerConfiguracion(config) {
        // Configuración aún no migrada: conservar opciones locales existentes.
        // Cuando se conecte Configuración, priorizar sus valores de Supabase.
        const datos = config || obtenerConfiguracion();
        PUNTOS_VIDEO = numeroConfig(datos.puntos?.video, 10, 1000);
        PUNTOS_TAREA = numeroConfig(datos.puntos?.tarea, 3, 1000);
        METAS = Object.fromEntries(
            [["abregu", 4], ["fuze", 7], ["kintex", 2], ["caedla", 3]]
                .map(([k, defecto]) => [k, numeroConfig(datos.metas?.[k], defecto, 100)])
        );
    }

    async function cargarNube() {
        if (ocupadoNube) return;
        ocupadoNube = true;
        listoNube = false;
        controlarAcceso();
        mensajeNube("Leyendo producción, tareas, LIVE y asistencias de Supabase...");
        try {
            if (!db) throw new Error("No se inicializó el cliente Supabase.");
            const { data: sesion, error: errorUsuario } = await db.auth.getUser();
            const user = sesion?.user;
            if (errorUsuario || !user) throw new Error("Inicia sesión para consultar informes.");
            usuarioId = user.id;
            const { data: estudio, error: errorEstudio } = await db.from("estudios")
                .select("id").eq("propietario_id", usuarioId).maybeSingle();
            if (errorEstudio || !estudio) throw new Error("No se encontró tu estudio autorizado.");
            estudioId = estudio.id;
            const filas = await leerFilas();
            const datos = construirDatosNube(filas);
            DATOS_NUBE = datos.resultado;
            versionesNotas.clear();
            datos.notasVersion.forEach((v, k) => versionesNotas.set(k, v));
            establecerConfiguracion(datos.configNube);
            listoNube = true;
            actualizarInforme();
            const pendientes = notasPendientes().length;
            mensajeNube(
                `Supabase conectado. ${DATOS_NUBE.aa_producciones.length} producciones, ` +
                `${DATOS_NUBE.aa_tareas_personalizadas.length} tareas, ` +
                `${DATOS_NUBE.aa_lives.length} LIVE y ` +
                `${DATOS_NUBE.aa_asistencias.length} asistencias.` +
                (pendientes ? ` ${pendientes} observaciones locales pendientes de importar.` : "")
            );
        } catch (error) {
            console.error("Informes: error al leer Supabase", error);
            DATOS_NUBE = Object.create(null);
            datosActuales = null;
            periodoActual = null;
            mensajeNube(`No se pudo cargar el informe: ${error.message || error}`, true);
        } finally {
            ocupadoNube = false;
            controlarAcceso();
        }
    }

    async function guardarNotaNube(periodo, contenido) {
        const clave = claveNota(periodo);
        const anterior = versionesNotas.get(clave);
        let consulta;
        if (anterior) {
            consulta = db.from("registros_modulos")
                .update({ contenido, actualizado_en: new Date().toISOString() })
                .eq("id", anterior.id)
                .eq("estudio_id", estudioId)
                .eq("modulo", "informes")
                .eq("actualizado_en", anterior.actualizado_en)
                .select("id,actualizado_en").maybeSingle();
        } else {
            consulta = db.from("registros_modulos")
                .insert({
                    estudio_id: estudioId, modulo: "informes",
                    registro_clave: clave, contenido, creado_por: usuarioId
                })
                .select("id,actualizado_en").single();
        }
        const { data, error } = await consulta;
        if (error) throw error;
        if (!data) throw new Error("Estas observaciones cambiaron en otro navegador. Pulsa Actualizar antes de guardar de nuevo.");
        versionesNotas.set(clave, data);
        DATOS_NUBE[CLAVE_NOTAS][periodo] = contenido;
    }

    botonActualizar.addEventListener("click", cargarNube);
    botonRespaldo.addEventListener("click", () => {
        const texto = JSON.stringify(leerNotasLocales(), null, 2);
        const blob = new Blob([texto], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `observaciones-informes-locales-${new Date().toISOString().slice(0,10)}.json`;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    botonImportar.addEventListener("click", async () => {
        if (!listoNube || ocupadoNube) return;
        const pendientes = notasPendientes();
        if (!pendientes.length) return;
        if (!confirm(`Importar ${pendientes.length} observaciones antiguas sin reemplazar las de Supabase? Descarga primero el respaldo local.`)) return;
        ocupadoNube = true;
        controlarAcceso();
        let importadas = 0;
        let omitidas = 0;
        try {
            for (const [periodo, valor] of pendientes) {
                const notas = Object.fromEntries(CAMPOS_NOTAS.map(k => [k, String(valor[k] ?? "")]));
                const { error } = await db.from("registros_modulos").insert({
                    estudio_id: estudioId, modulo: "informes",
                    registro_clave: claveNota(periodo), contenido: notas,
                    creado_por: usuarioId
                });
                if (error?.code === "23505") { omitidas++; continue; }
                if (error) throw error;
                importadas++;
            }
            mensajeNube(`Importadas ${importadas} observaciones. Omitidas ${omitidas} por conflicto.`);
        } catch (error) {
            console.error("Error importando observaciones", error);
            mensajeNube(`Importación interrumpida: ${error.message || error}`, true);
        } finally {
            ocupadoNube = false;
            controlarAcceso();
        }
        await cargarNube();
    });

    function leerArray(clave) {

        const datos = leer(clave, []);

        return Array.isArray(datos) ? datos : [];

    }

    function leerObjeto(clave) {

        const datos = leer(clave, {});

        return datos &&

            typeof datos === "object" &&

            !Array.isArray(datos)

                ? datos

                : {};

    }

    // ======================================

    // 2. FECHAS Y HORAS

    // ======================================

    function fechaTexto(fecha = new Date()) {

        return [

            fecha.getFullYear(),

            String(

                fecha.getMonth() + 1

            ).padStart(2, "0"),

            String(

                fecha.getDate()

            ).padStart(2, "0")

        ].join("-");

    }

    function convertirFecha(texto) {

        if (!/^\d{4}-\d{2}-\d{2}$/.test(texto || "")) {

            return null;

        }

        const [a, m, d] = texto.split("-").map(Number);

        const fecha = new Date(a, m - 1, d, 12);

        return fechaTexto(fecha) === texto

            ? fecha

            : null;

    }

    function fechaBonita(texto) {

        const fecha = convertirFecha(texto);

        return fecha

            ? fecha.toLocaleDateString("es-PE", {

                day: "2-digit",

                month: "long",

                year: "numeric"

            })

            : texto;

    }

    function horas(minutos) {

        return (

            `${Math.floor(minutos / 60)} h ` +

            `${String(minutos % 60).padStart(2, "0")} min`

        );

    }

    function aMinutos(hora) {

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(

            hora || ""

        )) {

            return null;

        }

        const [h, m] = hora.split(":").map(Number);

        return h * 60 + m;

    }

    // ======================================

    // 3. ELEMENTOS VISUALES

    // ======================================

    function crear(etiqueta, contenido, clase = "") {

        const nodo = document.createElement(etiqueta);

        if (contenido !== undefined) {

            nodo.textContent = contenido;

        }

        if (clase) nodo.className = clase;

        return nodo;

    }

    function mostrarLista(id, elementos, descripcion) {

        const contenedor = $(id);

        if (!contenedor) return;

        contenedor.replaceChildren();

        if (!elementos.length) {

            const vacio = crear(

                "div",

                undefined,

                "empty-state"

            );

            vacio.appendChild(

                crear("p", descripcion)

            );

            contenedor.appendChild(vacio);

            return;

        }

        elementos.forEach(item => {

            const tarjeta = crear(

                "article",

                undefined,

                "production-card"

            );

            tarjeta.append(

                crear("h3", item.titulo),

                crear("p", item.detalle)

            );

            contenedor.appendChild(tarjeta);

        });

    }

    // ======================================

    // 4. TAREAS HABITUALES

    // ======================================

    // Mismas rutinas de tareas.js.

    // Si cambias las rutinas allí,

    // actualiza también estos nombres.

    const RUTINAS = {

        0: [

            "Verificar publicación programada de FUZE."

        ],

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

        ]

    };

    // ======================================

    // 5. SELECCIONAR PERIODO

    // ======================================

    function obtenerPeriodo() {

        const referencia =

            convertirFecha(fechaInput.value) ||

            new Date();

        const semanal = tipo.value === "semanal";

        const inicio = new Date(referencia);

        if (semanal) {

            const diferencia =

                (inicio.getDay() + 6) % 7;

            inicio.setDate(

                inicio.getDate() - diferencia

            );

        }

        const fin = new Date(inicio);

        if (semanal) {

            fin.setDate(fin.getDate() + 6);

        }

        const fechas = [];

        for (

            let dia = new Date(inicio);

            dia <= fin;

            dia.setDate(dia.getDate() + 1)

        ) {

            fechas.push(fechaTexto(dia));

        }

        return {

            tipo: semanal ? "semanal" : "diario",

            inicio: fechaTexto(inicio),

            fin: fechaTexto(fin),

            fechas,

            etiqueta: semanal

                ? (

                    `${fechaBonita(fechaTexto(inicio))} al ` +

                    `${fechaBonita(fechaTexto(fin))}`

                )

                : fechaBonita(fechaTexto(inicio))

        };

    }

    function corresponde(tarea, fecha) {

        if (

            !tarea ||

            !convertirFecha(tarea.fecha) ||

            fecha < tarea.fecha

        ) {

            return false;

        }

        if (tarea.repeticion === "diaria") {

            return true;

        }

        if (tarea.repeticion === "semanal") {

            return (

                convertirFecha(fecha).getDay() ===

                convertirFecha(tarea.fecha).getDay()

            );

        }

        return fecha === tarea.fecha;

    }

    // ======================================

    // 6. REUNIR DATOS DE TODOS LOS MODULOS

    // ======================================

    function obtenerDatos(periodo) {

        const fechaSet = new Set(periodo.fechas);

        // ----------------------------------

        // VIDEOS PUBLICADOS

        // ----------------------------------

        const producciones = leerArray(

            "aa_producciones"

        );

        const porId = new Map(

            producciones.map(p => [

                String(p.id), p

            ])

        );

        const videos = [];

        const idsVideo = new Set();

        // Fuente principal: registro compartido.

        leerArray("aa_videos_publicados").forEach(

            (v, indice) => {

                if (

                    !v ||

                    !fechaSet.has(v.fecha)

                ) {

                    return;

                }

                const id = v.id == null

                    ? `publicacion-${indice}`

                    : String(v.id);

                if (idsVideo.has(id)) return;

                idsVideo.add(id);

                const proyecto = porId.get(id);

                videos.push({

                    id,

                    fecha: v.fecha,

                    marca: v.marca,

                    titulo:

                        proyecto?.nombre ||

                        v.nombre ||

                        "Video publicado",

                    detalle:

                        `${fechaBonita(v.fecha)} · ` +

                        `${MARCAS[v.marca] ||

                           v.marca ||

                           "Marca sin especificar"}`

                });

            }

        );

        // Respaldo desde Producción Audiovisual.

        producciones.forEach((p, indice) => {

            const fecha = p.fechaPublicacion;

            if (

                p.estado !== "publicado" ||

                !fechaSet.has(fecha)

            ) {

                return;

            }

            const id = String(

                p.id ?? `produccion-${indice}`

            );

            if (idsVideo.has(id)) return;

            idsVideo.add(id);

            videos.push({

                id,

                fecha,

                marca: p.marca,

                titulo:

                    p.nombre || "Video publicado",

                detalle:

                    `${fechaBonita(fecha)} · ` +

                    `${MARCAS[p.marca] ||

                       p.marca ||

                       "Marca sin especificar"}`

            });

        });

        // ----------------------------------

        // TAREAS COMPLETADAS

        // ----------------------------------

        const tareas = [];

        const tareasPropias = leerArray(

            "aa_tareas_personalizadas"

        );

        const completas = leerObjeto(

            "aa_tareas_personales_completadas"

        );

        const rutinasHechas = leerObjeto(

            "aa_tareas_diarias"

        );

        periodo.fechas.forEach(fecha => {

            const dia = convertirFecha(fecha).getDay();

            const rutinaDia = RUTINAS[dia] || [];

            const indices = new Set(

                Array.isArray(rutinasHechas[fecha])

                    ? rutinasHechas[fecha].map(Number)

                    : []

            );

            rutinaDia.forEach((titulo, indice) => {

                if (!indices.has(indice)) return;

                tareas.push({

                    fecha,

                    titulo,

                    marca: "general",

                    detalle:

                        `${fechaBonita(fecha)} · ` +

                        "Rutina habitual"

                });

            });

            const hechas = new Set(

                Array.isArray(completas[fecha])

                    ? completas[fecha].map(String)

                    : []

            );

            tareasPropias.forEach(tarea => {

                if (

                    !corresponde(tarea, fecha) ||

                    !hechas.has(String(tarea.id))

                ) {

                    return;

                }

                tareas.push({

                    fecha,

                    titulo:

                        tarea.titulo ||

                        "Tarea completada",

                    marca:

                        tarea.cliente ||

                        "general",

                    detalle:

                        `${fechaBonita(fecha)} · ` +

                        `${tarea.cliente || "General"}`

                });

            });

        });

        // ----------------------------------

        // LIVE FINALIZADOS

        // ----------------------------------

        const lives = leerArray("aa_lives")

            .filter(l =>

                l &&

                fechaSet.has(l.fecha) &&

                l.estado === "finalizado"

            )

            .map(l => ({

                fecha: l.fecha,

                titulo:

                    l.nombre || "Transmisión",

                detalle:

                    `${fechaBonita(l.fecha)} · ` +

                    `${l.hora || "Sin hora"} · ` +

                    `${l.cliente || "Sin cliente"}`

            }));

        // ----------------------------------

        // ASISTENCIA

        // ----------------------------------

        const asistencias = leerArray(

            "aa_asistencias"

        )

            .filter(a =>

                a &&

                fechaSet.has(a.fecha)

            )

            .map(a => {

                const entrada = aMinutos(a.entrada);

                const salida = aMinutos(a.salida);

                const descansoInicio = aMinutos(

                    a.descansoInicio

                );

                const descansoFin = aMinutos(

                    a.descansoFin

                );

                const descansoRegistrado =

                    (

                        descansoInicio === null &&

                        descansoFin === null

                    ) ||

                    (

                        descansoInicio !== null &&

                        descansoFin !== null &&

                        entrada !== null &&

                        salida !== null &&

                        entrada <= descansoInicio &&

                        descansoInicio < descansoFin &&

                        descansoFin <= salida

                    );

                const completa =

                    entrada !== null &&

                    salida !== null &&

                    salida > entrada &&

                    descansoRegistrado;

                const descanso =

                    descansoInicio !== null &&

                    descansoFin !== null

                        ? descansoFin - descansoInicio

                        : 0;

                const minutos = completa

                    ? salida - entrada - descanso

                    : 0;

                return {

                    fecha: a.fecha,

                    minutos,

                    titulo:

                        fechaBonita(a.fecha),

                    detalle:

                        `Entrada ${a.entrada || "--:--"} · ` +

                        `Salida ${a.salida || "pendiente"} · ` +

                        (

                            completa

                                ? horas(minutos)

                                : "Registro incompleto"

                        )

                };

            });

        return {

            videos,

            tareas,

            lives,

            asistencias,

            minutosTrabajados: asistencias.reduce(

                (s, a) => s + a.minutos,

                0

            ),

            puntosVideos:

                videos.length * PUNTOS_VIDEO,

            puntosTareas:

                tareas.length * PUNTOS_TAREA

        };

    }

    // ======================================

    // 7. OBSERVACIONES

    // ======================================

    let periodoActual = null;

    let datosActuales = null;

    function clavePeriodo(periodo) {

        return `${periodo.tipo}:${periodo.inicio}`;

    }

    function cargarObservaciones() {

        const notas = leerObjeto(CLAVE_NOTAS)[

            clavePeriodo(periodoActual)

        ] || {};

        CAMPOS_NOTAS.forEach(id => {

            $(id).value = notas[id] || "";

        });

    }

    function obtenerObservaciones() {

        const notas = {};

        CAMPOS_NOTAS.forEach(id => {

            notas[id] = $(id).value.trim();

        });

        return notas;

    }

    // ======================================

    // 8. CONSTRUIR INFORME FORMAL

    // ======================================

    function seccionDocumento(

        contenedor,

        titulo,

        textos

    ) {

        contenedor.appendChild(

            crear("h4", titulo)

        );

        if (!textos.length) {

            contenedor.appendChild(

                crear(

                    "p",

                    "Sin registros en este periodo."

                )

            );

            return;

        }

        const lista = crear("ul");

        textos.forEach(texto => {

            lista.appendChild(

                crear("li", texto)

            );

        });

        contenedor.appendChild(lista);

    }

    function actualizarDocumento() {

        const d = datosActuales;

        if (!d || !periodoActual) return;

        $("documento-periodo").textContent =

            periodoActual.etiqueta;

        const resumen = $("documento-resumen");

        resumen.replaceChildren();

        const lineas = [

            `Videos publicados: ${d.videos.length}`,

            `Tareas completadas: ${d.tareas.length}`,

            `LIVE finalizados: ${d.lives.length}`,

            `Horas efectivas registradas: ${

                horas(d.minutosTrabajados)

            }`,

            `Puntaje del periodo: ${

                d.puntosVideos + d.puntosTareas

            }`

        ];

        lineas.forEach(linea => {

            resumen.appendChild(

                crear("p", linea)

            );

        });

        seccionDocumento(

            resumen,

            "Videos publicados",

            d.videos.map(

                v => `${v.titulo} — ${v.detalle}`

            )

        );

        seccionDocumento(

            resumen,

            "Tareas completadas",

            d.tareas.map(

                t => `${t.titulo} — ${t.detalle}`

            )

        );

        seccionDocumento(

            resumen,

            "Transmisiones realizadas",

            d.lives.map(

                l => `${l.titulo} — ${l.detalle}`

            )

        );

        seccionDocumento(

            resumen,

            "Asistencias",

            d.asistencias.map(

                a => `${a.titulo} — ${a.detalle}`

            )

        );

        // OBSERVACIONES

        const observaciones = $(

            "documento-observaciones"

        );

        observaciones.replaceChildren();

        const etiquetas = {

            "informe-logros": "Logros",

            "informe-dificultades": "Dificultades",

            "informe-pendientes": "Pendientes",

            "informe-proximos": "Próximas actividades",

            "informe-comentarios":

                "Comentarios para administración"

        };

        let alguna = false;

        CAMPOS_NOTAS.forEach(id => {

            const contenido = $(id).value.trim();

            if (!contenido) return;

            alguna = true;

            observaciones.appendChild(

                crear("h4", etiquetas[id])

            );

            const p = crear("p", contenido);

            p.style.whiteSpace = "pre-wrap";

            observaciones.appendChild(p);

        });

        if (!alguna) {

            observaciones.appendChild(

                crear(

                    "p",

                    "Sin observaciones registradas."

                )

            );

        }

    }

    // ======================================

    // 9. MOSTRAR RESULTADOS

    // ======================================

    function actualizarInforme() {

        periodoActual = obtenerPeriodo();

        datosActuales = obtenerDatos(

            periodoActual

        );

        const d = datosActuales;

        $("periodo-resultados").textContent =

            periodoActual.etiqueta;

        $("informe-videos").textContent =

            d.videos.length;

        $("informe-tareas").textContent =

            d.tareas.length;

        $("informe-lives").textContent =

            d.lives.length;

        $("informe-horas").textContent =

            horas(d.minutosTrabajados);

        $("puntos-videos-informe").textContent =

            d.puntosVideos;

        $("puntos-tareas-informe").textContent =

            d.puntosTareas;

        const total =

            d.puntosVideos + d.puntosTareas;

        $("puntos-totales-informe").textContent =

            total;

        $("promedio-puntos").textContent =

            (

                total / periodoActual.fechas.length

            ).toLocaleString("es-PE", {

                maximumFractionDigits: 1

            });

        // METAS POR MARCA

Object.entries(METAS).forEach(

    ([marca, meta]) => {

        const cantidad = d.videos.filter(

            v => v.marca === marca

        ).length;

        $(`reporte-${marca}`).textContent =

            cantidad;

        const barra = $(

            `barra-reporte-${marca}`

        );

        barra.max = meta;

        barra.value = Math.min(

            cantidad,

            meta

        );

        // ACTUALIZAR LA META EN PANTALLA

        const contador = $(`reporte-${marca}`);

        const textoMeta =

            contador.parentElement.nextElementSibling;

        if (textoMeta) {

            textoMeta.textContent =

                `Meta semanal: ${meta} videos`;

        }

    }

);

        // LISTAS DETALLADAS

        mostrarLista(

            "informe-lista-videos",

            d.videos,

            "Sin videos publicados en este periodo."

        );

        mostrarLista(

            "informe-lista-tareas",

            d.tareas,

            "Sin tareas completadas en este periodo."

        );

        mostrarLista(

            "informe-lista-lives",

            d.lives,

            "Sin LIVE marcados como finalizados."

        );

        mostrarLista(

            "informe-lista-asistencias",

            d.asistencias,

            "Sin asistencias registradas en este periodo."

        );

// Actualizar textos del sistema de puntos.

const textoVideo = $("puntos-videos-informe")

    ?.closest(".stat-card")

    ?.querySelector("span");

const textoTarea = $("puntos-tareas-informe")

    ?.closest(".stat-card")

    ?.querySelector("span");

if (textoVideo) {

    textoVideo.textContent =

        `${PUNTOS_VIDEO} puntos por publicación`;

}

if (textoTarea) {

    textoTarea.textContent =

        `${PUNTOS_TAREA} puntos por tarea`;

}

        cargarObservaciones();

        actualizarDocumento();

    }

    // ======================================

    // 10. ACTIVAR CONTROLES

    // ======================================

    tipo.disabled = false;

    fechaInput.disabled = false;

    $("consultar-informe").disabled = false;

    $("guardar-observaciones").disabled = false;

    $("imprimir-informe").disabled = false;

    $("exportar-informe-csv").disabled = false;

    fechaInput.value = fechaTexto();

    $("consultar-informe").addEventListener("click", cargarNube);

    // ======================================

    // 11. GUARDAR OBSERVACIONES

    // ======================================

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (!listoNube || ocupadoNube || !periodoActual) return;
        ocupadoNube = true;
        controlarAcceso();
        try {
            await guardarNotaNube(clavePeriodo(periodoActual), obtenerObservaciones());
            actualizarDocumento();
            mensajeNube("Observaciones guardadas en Supabase.");
            alert("Observaciones guardadas correctamente en Supabase.");
        } catch (error) {
            console.error("No se guardaron las observaciones", error);
            mensajeNube(`No se guardaron las observaciones: ${error.message || error}`, true);
            alert("No se guardaron las observaciones. Conserva el texto y actualiza desde Supabase si hubo un conflicto.");
        } finally {
            ocupadoNube = false;
            controlarAcceso();
        }
    });

    CAMPOS_NOTAS.forEach(id => {

        $(id).addEventListener(

            "input",

            actualizarDocumento

        );

    });

    // ======================================

    // 12. ESTILOS PARA IMPRIMIR EL INFORME

    // ======================================

    const estilos = crear("style");

    estilos.textContent = `

        @media print {

            @page {

                size: A4;

                margin: 15mm;

            }

            body, html {

                background: #fff !important;

            }

            body * {

                visibility: hidden !important;

            }

            #documento-informe,

            #documento-informe * {

                visibility: visible !important;

                color: #111 !important;

                background: transparent !important;

                box-shadow: none !important;

            }

            #documento-informe {

                position: absolute !important;

                left: 0 !important;

                top: 0 !important;

                width: 100% !important;

                margin: 0 !important;

                padding: 0 !important;

                border: 0 !important;

                font-family: Arial, sans-serif !important;

                font-size: 10pt !important;

            }

            #documento-informe h3 {

                margin: 14px 0 8px !important;

            }

            #documento-informe h4 {

                margin: 12px 0 4px !important;

            }

            #documento-informe li {

                margin-bottom: 4px !important;

            }

            #documento-informe .dashboard-columns {

                display: grid !important;

                grid-template-columns: 1fr 1fr !important;

                gap: 20px !important;

                break-inside: avoid !important;

            }

            #documento-informe .production-card {

                border: none !important;

                padding: 8px 0 !important;

            }

        }

    `;

    document.head.appendChild(estilos);

    // ======================================

    // 13. IMPRIMIR / GUARDAR PDF

    // ======================================

    $("imprimir-informe").addEventListener(

        "click",

        () => {

            if (!periodoActual) {

                actualizarInforme();

            }

            actualizarDocumento();

            window.print();

        }

    );

    // ======================================

    // 14. EXPORTAR CSV

    // ======================================

    function csvSeguro(valor) {

        let cadena = String(valor ?? "");

        // Evitar fórmulas al abrir en Excel.

        if (/^\s*[=+@\-]/.test(cadena)) {

            cadena = "'" + cadena;

        }

        return '"' +

            cadena.replace(/"/g, '""') +

            '"';

    }

    $("exportar-informe-csv").addEventListener(

        "click",

        () => {

            if (!datosActuales) return;

            const d = datosActuales;

            const filas = [[

                "Tipo",

                "Fecha",

                "Marca/Cliente",

                "Actividad",

                "Detalle",

                "Puntos",

                "Horas efectivas (min)"

            ]];

            d.videos.forEach(v => {

                filas.push([

                    "Video",

                    v.fecha,

                    v.marca,

                    v.titulo,

                    v.detalle,

                    PUNTOS_VIDEO,

                    ""

                ]);

            });

            d.tareas.forEach(t => {

                filas.push([

                    "Tarea",

                    t.fecha,

                    t.marca,

                    t.titulo,

                    t.detalle,

                    PUNTOS_TAREA,

                    ""

                ]);

            });

            d.lives.forEach(l => {

                filas.push([

                    "LIVE",

                    l.fecha,

                    "",

                    l.titulo,

                    l.detalle,

                    0,

                    ""

                ]);

            });

            d.asistencias.forEach(a => {

                filas.push([

                    "Asistencia",

                    a.fecha,

                    "",

                    a.titulo,

                    a.detalle,

                    0,

                    a.minutos

                ]);

            });

            const csv = "\ufeff" +

                filas.map(fila =>

                    fila.map(csvSeguro).join(";")

                ).join("\r\n");

            const blob = new Blob(

                [csv],

                {

                    type: "text/csv;charset=utf-8"

                }

            );

            const url = URL.createObjectURL(blob);

            const enlace = crear("a");

            enlace.href = url;

            enlace.download =

                `informe-${periodoActual.tipo}-` +

                `${periodoActual.inicio}.csv`;

            document.body.appendChild(enlace);

            enlace.click();

            enlace.remove();

            setTimeout(

                () => URL.revokeObjectURL(url),

                1000

            );

        }

    );

    // ======================================

    // 15. INICIAR MODULO

    // ======================================

    // Los informes no leen localStorage como fuente principal.
    // El botón Actualizar consulta nuevamente el servidor.
    controlarAcceso();
    cargarNube();

    console.log(

        "Informes y Puntos iniciado correctamente."

    );

});