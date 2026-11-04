/* ==========================================
   ABREGU STUDIOS
   MODULO: CONFIGURACION
   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    const $ = id => document.getElementById(id);

    const CLAVE_CONFIG = "aa_configuracion";

    // ======================================
    // 1. CONFIGURACION PREDETERMINADA
    // ======================================

    const DEFAULTS = {
        general: {
            nombre: "ABREGU STUDIOS",
            empresa: "ABREGU PRINT",
            responsable: "SAMGIUK INGA",
            cargo: "Productor audiovisual principal",
            zona: "America/Lima"
        },

        metas: {
            abregu: 4,
            fuze: 7,
            kintex: 2,
            caedla: 3
        },

        puntos: {
            video: 10,
            tarea: 3,
            inicioSemana: "lunes"
        },

        horarios: {
            completoInicio: "10:30",
            completoFin: "20:00",
            institutoInicio: "14:00",
            institutoFin: "20:00",
            almuerzo: 60
        }
    };

    const formularios = {
        general: $("form-config-general"),
        metas: $("form-config-metas"),
        puntos: $("form-config-puntos"),
        horarios: $("form-config-horarios")
    };

    if (
        !Object.values(formularios).every(Boolean)
    ) {
        console.error(
            "Configuración: faltan formularios."
        );
        return;
    }

    // ======================================
    // 2. SUPABASE: CONFIGURACION CENTRAL
    // ======================================

    const MODULO_NUBE = "configuracion";
    const REGISTRO_NUBE = "ajustes";
    const CLAVE_RESPALDO_PREVIO = "aa_configuracion_respaldo_pre_supabase_v1";
    const CLAVE_ARCHIVO_PENDIENTE = "aa_respaldo_antiguo_pendiente_v1";
    const db = window.abreguDB;
    let estudioId = null;
    let usuarioId = null;
    let versionNube = null;
    let conexionLista = false;
    let ocupado = false;
    let configuracionEnNube = false;

    function esObjeto(valor) {
        return valor !== null && typeof valor === "object" && !Array.isArray(valor);
    }

    // Copia inmutable del archivo original del navegador ANTES de cargar la nube.
    // Si no se puede respaldar, no sustituimos ninguna informacion local.
    try {
        const datoOriginal = localStorage.getItem(CLAVE_CONFIG);
        if (datoOriginal !== null &&
            localStorage.getItem(CLAVE_RESPALDO_PREVIO) === null) {
            localStorage.setItem(CLAVE_RESPALDO_PREVIO, datoOriginal);
        }
    } catch (error) {
        console.error("Configuracion: respaldo previo fallido", error);
        alert("No se pudo guardar el respaldo anterior. Conexion detenida para proteger los datos.");
        return;
    }

    function combinarDefaults(datos) {
        const config = {};
        for (const seccion of Object.keys(DEFAULTS)) {
            config[seccion] = {
                ...DEFAULTS[seccion],
                ...(esObjeto(datos?.[seccion]) ? datos[seccion] : {})
            };
        }
        return config;
    }

    function leerJSON(clave, defecto = {}) {
        try {
            const valor = localStorage.getItem(clave);
            const datos = valor === null ? defecto : JSON.parse(valor);
            return esObjeto(datos) ? datos : defecto;
        } catch (error) {
            console.warn("No se pudo leer:", clave, error);
            return defecto;
        }
    }

    // La fuente de verdad es Supabase; no mezclar automaticamente datos viejos.
    let configuracion = combinarDefaults({});

    const panelNube = document.createElement("section");
    panelNube.className = "production-card";
    panelNube.style.cssText = "padding:16px;margin:16px 0 22px;border-left:3px solid #e53d54";
    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    estadoNube.textContent = "Conectando configuracion con Supabase...";
    const accionesNube = document.createElement("div");
    accionesNube.className = "form-actions";
    function crearAccion(texto) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = texto;
        return boton;
    }
    const botonActualizarNube = crearAccion("Actualizar desde Supabase");
    const botonImportarNube = crearAccion("Importar configuracion anterior");
    const botonRespaldoAnterior = crearAccion("Descargar configuracion antigua");
    const botonRespaldoNube = crearAccion("Respaldo completo de Supabase");
    accionesNube.append(
        botonActualizarNube, botonImportarNube, botonRespaldoAnterior,
        botonRespaldoNube
    );
    panelNube.append(estadoNube, accionesNube);
    formularios.general.before(panelNube);

    function avisoNube(mensaje, error = false) {
        estadoNube.textContent = mensaje;
        estadoNube.style.color = error ? "#ff8190" : "";
    }

    function pendientesLocales() {
        const datos = leerJSON(CLAVE_RESPALDO_PREVIO);
        return !configuracionEnNube && Object.keys(datos).length > 0;
    }

    function controlarAcceso() {
        const bloqueado = !conexionLista || ocupado;
        for (const form of Object.values(formularios)) {
            form.querySelectorAll("button[type=submit], input, select, textarea").forEach(
                elemento => { elemento.disabled = bloqueado; }
            );
        }
        botonActualizarNube.disabled = !db || ocupado;
        botonImportarNube.disabled = bloqueado || !pendientesLocales();
        botonImportarNube.hidden = conexionLista && !pendientesLocales();
        botonRespaldoNube.disabled = !conexionLista || ocupado;
        botonRespaldoAnterior.disabled = !localStorage.getItem(CLAVE_RESPALDO_PREVIO);
    }

    function cacheConfiguracion() {
        // Compatibilidad con Resumen, Informes y otros archivos JS existentes.
        // Una falla local no revierte un guardado confirmado por Supabase.
        try {
            localStorage.setItem(CLAVE_CONFIG, JSON.stringify(configuracion));
        } catch (error) {
            console.warn("No se pudo actualizar la cache de configuracion", error);
        }
    }

    function fechaVersionPosterior(anterior) {
        const previa = Date.parse(anterior || "") || 0;
        return new Date(Math.max(Date.now(), previa + 1)).toISOString();
    }

    async function consultarConfiguracionNube() {
        const { data, error } = await db.from("registros_modulos")
            .select("id,registro_clave,contenido,actualizado_en")
            .eq("estudio_id", estudioId)
            .eq("modulo", MODULO_NUBE)
            .eq("registro_clave", REGISTRO_NUBE)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    async function cargarConfiguracionNube() {
        if (!db || ocupado || !estudioId) return;
        ocupado = true;
        conexionLista = false;
        controlarAcceso();
        avisoNube("Consultando la configuracion en Supabase...");
        try {
            const fila = await consultarConfiguracionNube();
            if (fila && !esObjeto(fila.contenido)) {
                throw new Error("La configuracion remota tiene un formato incorrecto.");
            }
            versionNube = fila ? { id: fila.id, actualizado_en: fila.actualizado_en } : null;
            configuracionEnNube = Boolean(fila);
            configuracion = combinarDefaults(fila?.contenido || {});
            conexionLista = true;
            cacheConfiguracion();
            cargarCampos();
            $("estado-almacenamiento").textContent = "Supabase";
            $("estado-base-datos").textContent = "Conectado";
            avisoNube(
                fila
                    ? "Configuracion sincronizada con Supabase. Los cambios se guardan en la nube."
                    : "Supabase conectado. Aun no existe configuracion guardada en la nube." +
                      (pendientesLocales() ? " Puedes importar la configuracion antigua sin sobrescribir datos." :
                          " Se muestran valores predeterminados.")
            );
        } catch (error) {
            console.error("Configuracion: no se pudo leer Supabase", error);
            $("estado-almacenamiento").textContent = "Sin conexion";
            $("estado-base-datos").textContent = "Error";
            avisoNube(`No se pudo leer Supabase: ${error.message || error}. Edicion bloqueada.`, true);
        } finally {
            ocupado = false;
            controlarAcceso();
        }
    }

    async function iniciarSupabase() {
        controlarAcceso();
        if (!db) {
            avisoNube("No se encontro window.abreguDB. Revisa el orden de los scripts.", true);
            $("estado-base-datos").textContent = "No";
            return;
        }
        try {
            const { data: sesion, error: errorSesion } = await db.auth.getUser();
            const usuario = sesion?.user;
            if (errorSesion || !usuario) throw errorSesion || new Error("Inicia sesion.");
            usuarioId = usuario.id;
            const { data: estudio, error: errorEstudio } = await db.from("estudios")
                .select("id")
                .eq("propietario_id", usuarioId)
                .maybeSingle();
            if (errorEstudio || !estudio) {
                throw errorEstudio || new Error("No se encontro el estudio de esta cuenta.");
            }
            estudioId = estudio.id;
            // Se usa esta consulta solo para mostrar una cantidad real, no para autorizar cambios.
            const { count, error: errorCuenta } = await db.from("miembros_estudio")
                .select("usuario_id", { count: "exact", head: true })
                .eq("estudio_id", estudioId)
                .eq("activo", true);
            if (!errorCuenta && Number.isInteger(count)) {
                $("estado-usuarios").textContent = String(count);
            } else {
                $("estado-usuarios").textContent = "—";
            }
            await cargarConfiguracionNube();
        } catch (error) {
            console.error("Configuracion: conexion rechazada", error);
            avisoNube(`No se pudo conectar con Supabase: ${error.message || error}`, true);
            $("estado-almacenamiento").textContent = "Sin conexion";
            $("estado-base-datos").textContent = "No";
            controlarAcceso();
        }
    }

    async function guardarSeccion(seccion, valores) {
        if (!conexionLista || ocupado) {
            avisoNube("No se guardo: espera a que la nube este disponible.", true);
            return false;
        }
        const nueva = combinarDefaults({
            ...configuracion,
            [seccion]: { ...configuracion[seccion], ...valores }
        });
        ocupado = true;
        controlarAcceso();
        try {
            let fila;
            if (versionNube) {
                const { data, error } = await db.from("registros_modulos")
                    .update({
                        contenido: nueva,
                        actualizado_en: fechaVersionPosterior(versionNube.actualizado_en)
                    })
                    .eq("id", versionNube.id)
                    .eq("estudio_id", estudioId)
                    .eq("modulo", MODULO_NUBE)
                    .eq("registro_clave", REGISTRO_NUBE)
                    .eq("actualizado_en", versionNube.actualizado_en)
                    .select("id,actualizado_en")
                    .maybeSingle();
                if (error) throw error;
                if (!data) throw new Error("Otra sesion modifico la configuracion. Pulsa Actualizar antes de editar.");
                fila = data;
            } else {
                const { data, error } = await db.from("registros_modulos")
                    .insert({
                        estudio_id: estudioId,
                        modulo: MODULO_NUBE,
                        registro_clave: REGISTRO_NUBE,
                        contenido: nueva,
                        creado_por: usuarioId
                    })
                    .select("id,actualizado_en")
                    .single();
                if (error) throw error;
                fila = data;
            }
            versionNube = fila;
            configuracionEnNube = true;
            configuracion = nueva;
            cacheConfiguracion();
            cargarCampos();
            avisoNube("Cambios guardados correctamente en Supabase.");
            return true;
        } catch (error) {
            console.error("Configuracion: guardado rechazado", error);
            avisoNube(`No se guardaron los cambios: ${error.message || error}`, true);
            alert("No se pudo guardar en Supabase. Los datos en la nube siguen sin cambios.");
            return false;
        } finally {
            ocupado = false;
            controlarAcceso();
        }
    }

    async function importarConfiguracionAnterior() {
        if (!conexionLista || ocupado || !pendientesLocales()) return;
        const datos = leerJSON(CLAVE_RESPALDO_PREVIO);
        if (!confirm("¿Importar tu configuracion antigua a Supabase? Solo se permite si aun no existe una configuracion en la nube; no se reemplazara nada existente.")) return;
        ocupado = true;
        controlarAcceso();
        try {
            const { error } = await db.from("registros_modulos").insert({
                estudio_id: estudioId,
                modulo: MODULO_NUBE,
                registro_clave: REGISTRO_NUBE,
                contenido: combinarDefaults(datos),
                creado_por: usuarioId
            });
            if (error) throw error;
            avisoNube("Configuracion antigua importada sin reemplazar otras filas.");
        } catch (error) {
            console.error("Configuracion: importacion rechazada", error);
            avisoNube(`No se pudo importar: ${error.message || error}`, true);
            alert("No se completo la importacion; se conserva el respaldo local.");
        } finally {
            ocupado = false;
        }
        await cargarConfiguracionNube();
    }

    botonActualizarNube.addEventListener("click", cargarConfiguracionNube);
    botonImportarNube.addEventListener("click", importarConfiguracionAnterior);
    botonRespaldoAnterior.addEventListener("click", () => {
        const copia = localStorage.getItem(CLAVE_RESPALDO_PREVIO);
        if (!copia) return alert("No existe configuracion antigua guardada.");
        descargarJSON({
            sistema: "ABREGU STUDIOS", fecha: new Date().toISOString(),
            configuracionAnterior: copia
        }, `configuracion-anterior-${fechaLocal()}.json`);
    });

    // Respaldo de TODOS los modulos remotos; NO modifica ninguna fila.
    botonRespaldoNube.addEventListener("click", async () => {
        if (!conexionLista || ocupado) return;
        ocupado = true;
        controlarAcceso();
        avisoNube("Preparando respaldo de todos los registros de Supabase...");
        try {
            const filas = [];
            const lote = 500;
            for (let desde = 0; ; desde += lote) {
                const { data, error } = await db.from("registros_modulos")
                    .select("modulo,registro_clave,contenido,actualizado_en")
                    .eq("estudio_id", estudioId)
                    .order("modulo", { ascending: true })
                    .order("registro_clave", { ascending: true })
                    .range(desde, desde + lote - 1);
                if (error) throw error;
                filas.push(...(data || []));
                if (!data || data.length < lote) break;
            }
            descargarJSON({
                formato: "abregu-studios-respaldo-nube",
                version: 1,
                sistema: "ABREGU STUDIOS",
                estudioId,
                fechaExportacion: new Date().toISOString(),
                registros: filas
            }, `abregu-studios-supabase-${fechaLocal()}.json`);
            avisoNube(`Respaldo completo generado: ${filas.length} registros de la nube.`);
        } catch (error) {
            console.error("No se pudo exportar la nube", error);
            avisoNube(`Error al respaldar Supabase: ${error.message || error}`, true);
        } finally {
            ocupado = false;
            controlarAcceso();
        }
    });

    // ======================================
    // 3. FUNCIONES GENERALES
    // ======================================

    function numero(id) {
        return Number($(id).value);
    }

    function enteroValido(valor, minimo, maximo) {
        return Number.isInteger(valor) &&
            valor >= minimo &&
            valor <= maximo;
    }

    function horaValida(valor) {
        return /^([01]\d|2[0-3]):[0-5]\d$/.test(
            valor || ""
        );
    }

    function fechaLocal() {
        const fecha = new Date();

        const anio = fecha.getFullYear();

        const mes = String(
            fecha.getMonth() + 1
        ).padStart(2, "0");

        const dia = String(
            fecha.getDate()
        ).padStart(2, "0");

        return `${anio}-${mes}-${dia}`;
    }

    function avisoFormulario(formulario, mensaje) {

        let ayuda = formulario.querySelector(
            ".helper-text"
        );

        if (!ayuda) {
            ayuda = document.createElement("p");
            ayuda.className = "helper-text";
            formulario.appendChild(ayuda);
        }

        ayuda.textContent = mensaje;
    }

    // ======================================
    // 4. CARGAR LOS VALORES GUARDADOS
    // ======================================

    function cargarCampos() {

        const g = configuracion.general;

        $("config-nombre").value = g.nombre;
        $("config-empresa").value = g.empresa;
        $("config-responsable").value = g.responsable;
        $("config-cargo").value = g.cargo;
        $("config-zona").value = g.zona;

        const m = configuracion.metas;

        $("meta-abregu").value = m.abregu;
        $("meta-fuze").value = m.fuze;
        $("meta-kintex").value = m.kintex;
        $("meta-caedla").value = m.caedla;

        const p = configuracion.puntos;

        $("puntos-video-config").value = p.video;
        $("puntos-tarea-config").value = p.tarea;

        $("config-inicio-semana").value =
            p.inicioSemana;

        const h = configuracion.horarios;

        $("horario-completo-inicio").value =
            h.completoInicio;

        $("horario-completo-fin").value =
            h.completoFin;

        $("horario-instituto-inicio").value =
            h.institutoInicio;

        $("horario-instituto-fin").value =
            h.institutoFin;

        $("config-almuerzo").value =
            h.almuerzo;

        calcularMetaTotal();
    }

    // ======================================
    // 5. CONFIGURACION GENERAL
    // ======================================

    formularios.general.addEventListener(
        "submit",
        async evento => {

            evento.preventDefault();

            if (
                !formularios.general.reportValidity()
            ) {
                return;
            }

            const valores = {
                nombre: $("config-nombre").value.trim(),
                empresa: $("config-empresa").value.trim(),
                responsable:
                    $("config-responsable").value.trim(),
                cargo: $("config-cargo").value.trim(),
                zona: $("config-zona").value
            };

            if (
                !valores.nombre ||
                !valores.responsable
            ) {
                alert(
                    "Completa el nombre y el responsable."
                );
                return;
            }

            if (await guardarSeccion("general", valores)) {
                alert(
                    "¡Configuración general guardada!"
                );
            }
        }
    );

    // ======================================
    // 6. METAS DE PRODUCCION
    // ======================================

    function calcularMetaTotal() {

        const ids = [
            "meta-abregu",
            "meta-fuze",
            "meta-kintex",
            "meta-caedla"
        ];

        const total = ids.reduce(
            (suma, id) => {
                const valor = numero(id);

                return suma +
                    (
                        Number.isFinite(valor)
                            ? valor
                            : 0
                    );
            },
            0
        );

        $("meta-total-config").textContent = total;
    }

    [
        "meta-abregu",
        "meta-fuze",
        "meta-kintex",
        "meta-caedla"
    ].forEach(id => {
        $(id).addEventListener(
            "input",
            calcularMetaTotal
        );
    });

    formularios.metas.addEventListener(
        "submit",
        async evento => {

            evento.preventDefault();

            if (
                !formularios.metas.reportValidity()
            ) {
                return;
            }

            const valores = {
                abregu: numero("meta-abregu"),
                fuze: numero("meta-fuze"),
                kintex: numero("meta-kintex"),
                caedla: numero("meta-caedla")
            };

            const validos = Object.values(
                valores
            ).every(valor =>
                enteroValido(valor, 0, 100)
            );

            if (!validos) {
                alert(
                    "Las metas deben ser números enteros entre 0 y 100."
                );
                return;
            }

            if (await guardarSeccion("metas", valores)) {

                calcularMetaTotal();

                alert(
                    "¡Metas de producción guardadas!"
                );
            }
        }
    );

    // ======================================
    // 7. SISTEMA DE PUNTOS
    // ======================================

    formularios.puntos.addEventListener(
        "submit",
        async evento => {

            evento.preventDefault();

            if (
                !formularios.puntos.reportValidity()
            ) {
                return;
            }

            const valores = {
                video: numero("puntos-video-config"),
                tarea: numero("puntos-tarea-config"),
                inicioSemana:
                    $("config-inicio-semana").value
            };

            if (
                !enteroValido(valores.video, 0, 1000) ||
                !enteroValido(valores.tarea, 0, 1000)
            ) {
                alert(
                    "Los puntos deben ser números enteros entre 0 y 1000."
                );
                return;
            }

            if (await guardarSeccion("puntos", valores)) {
                alert(
                    "¡Reglas de puntuación guardadas!"
                );
            }
        }
    );

    // ======================================
    // 8. HORARIOS LABORALES
    // ======================================

    formularios.horarios.addEventListener(
        "submit",
        async evento => {

            evento.preventDefault();

            if (
                !formularios.horarios.reportValidity()
            ) {
                return;
            }

            const valores = {
                completoInicio:
                    $("horario-completo-inicio").value,

                completoFin:
                    $("horario-completo-fin").value,

                institutoInicio:
                    $("horario-instituto-inicio").value,

                institutoFin:
                    $("horario-instituto-fin").value,

                almuerzo: numero("config-almuerzo")
            };

            const horasValidas = [
                valores.completoInicio,
                valores.completoFin,
                valores.institutoInicio,
                valores.institutoFin
            ].every(horaValida);

            if (
                !horasValidas ||
                valores.completoFin <=
                    valores.completoInicio ||
                valores.institutoFin <=
                    valores.institutoInicio
            ) {
                alert(
                    "Las horas de salida deben ser posteriores a las entradas."
                );
                return;
            }

            if (
                !enteroValido(valores.almuerzo, 0, 240)
            ) {
                alert(
                    "El descanso debe estar entre 0 y 240 minutos."
                );
                return;
            }

            if (await guardarSeccion("horarios", valores)) {
                alert(
                    "¡Horarios de referencia guardados!"
                );
            }
        }
    );

    // ======================================
    // 9. CLAVES DE RESPALDO
    // ======================================

    // Estas son las claves utilizadas
    // actualmente por Abregu Studios.
    // No se exportan datos de otras páginas.

    const TIPOS_DATOS = {
        aa_configuracion: "objeto",
        aa_tareas_diarias: "objeto",
        aa_videos_publicados: "array",
        aa_producciones: "array",
        aa_lives: "array",
        aa_tareas_personalizadas: "array",
        aa_tareas_personales_completadas: "objeto",
        aa_jornadas: "objeto",
        aa_agenda_eventos: "array",
        aa_clientes: "array",
        aa_ventas: "array",
        aa_inventario: "array",
        aa_asistencias: "array",
        aa_informes_observaciones: "objeto",
        aa_equipo_colaboradores: "array",
        aa_finanzas_v1: "objeto"
    };

    const CLAVES = Object.keys(TIPOS_DATOS);


      // ======================================
    // 10. CREAR RESPALDO JSON
    // ======================================

    function generarRespaldo() {

        const datos = {};

        CLAVES.forEach(clave => {

            const valor = localStorage.getItem(
                clave
            );

            if (valor !== null) {
                datos[clave] = valor;
            }
        });

        return {
            formato: "audiovisual-abregu-backup",
            version: 1,
            fechaExportacion:
                new Date().toISOString(),
            sistema: "ABREGU STUDIOS",
            datos
        };
    }

    function descargarJSON(contenido, nombre) {

        const blob = new Blob(
            [
                JSON.stringify(
                    contenido,
                    null,
                    2
                )
            ],
            {
                type: "application/json;charset=utf-8"
            }
        );

        const url = URL.createObjectURL(blob);

        const enlace = document.createElement("a");

        enlace.href = url;
        enlace.download = nombre;

        document.body.appendChild(enlace);

        enlace.click();
        enlace.remove();

        setTimeout(
            () => URL.revokeObjectURL(url),
            1000
        );
    }

    $("descargar-respaldo").addEventListener(
        "click",
        () => {

            const respaldo = generarRespaldo();

            const cantidad = Object.keys(
                respaldo.datos
            ).length;

            if (cantidad === 0) {
                alert(
                    "Todavía no hay datos para respaldar."
                );
                return;
            }

            descargarJSON(
                respaldo,
                `respaldo-audiovisual-abregu-${fechaLocal()}.json`
            );
        }
    );

    // ======================================
    // 11. VALIDAR ARCHIVO DE RESPALDO
    // ======================================

    function validarRespaldo(respaldo) {

        if (
            !esObjeto(respaldo) ||
            respaldo.formato !==
                "audiovisual-abregu-backup" ||
            respaldo.version !== 1 ||
            !esObjeto(respaldo.datos)
        ) {
            throw new Error(
                "Este archivo no tiene el formato de respaldo de Abregu Studios."
            );
        }

        const entradas = Object.entries(
            respaldo.datos
        );

        if (!entradas.length) {
            throw new Error(
                "El archivo no contiene datos para restaurar."
            );
        }

        for (const [clave, texto] of entradas) {

            if (!CLAVES.includes(clave)) {
                throw new Error(
                    `Clave no reconocida: ${clave}`
                );
            }

            if (typeof texto !== "string") {
                throw new Error(
                    `Dato inválido en: ${clave}`
                );
            }

            let valor;

            try {
                valor = JSON.parse(texto);

            } catch (error) {
                throw new Error(
                    `El registro ${clave} contiene JSON inválido.`
                );
            }

            const tipo = TIPOS_DATOS[clave];

            const valido = tipo === "array"
                ? Array.isArray(valor)
                : esObjeto(valor);

            if (!valido) {
                throw new Error(
                    `El registro ${clave} tiene un formato incorrecto.`
                );
            }
        }

        return true;
    }

    // ======================================
    // 12. PREPARAR RESTAURACION ANTIGUA (SIN BORRAR LA NUBE)
    // ======================================

    const archivoInput = $("archivo-respaldo");
    const botonRestaurar = $("restaurar-respaldo");
    archivoInput.disabled = false;
    botonRestaurar.textContent = "Preparar respaldo antiguo (seguro)";
    botonRestaurar.disabled = true;

    archivoInput.addEventListener("change", () => {
        botonRestaurar.disabled = !archivoInput.files?.length;
    });

    botonRestaurar.addEventListener("click", async () => {
        const archivo = archivoInput.files?.[0];
        if (!archivo) return alert("Selecciona un archivo JSON.");
        if (archivo.size > 8 * 1024 * 1024) {
            return alert("El archivo supera el limite de 8 MB.");
        }
        try {
            const contenido = await archivo.text();
            const respaldo = JSON.parse(contenido);
            validarRespaldo(respaldo);
            const cantidad = Object.keys(respaldo.datos).length;
            if (!confirm(
                `El respaldo antiguo contiene ${cantidad} colecciones. ` +
                "Se guardara como copia PENDIENTE para migracion. " +
                "NO se reemplazara ninguna informacion actual ni se importara " +
                "automaticamente a Supabase. ¿Guardar esta copia pendiente?"
            )) return;
            if (localStorage.getItem(CLAVE_ARCHIVO_PENDIENTE) !== null) {
                // Nunca reemplazar silenciosamente un archivo pendiente anterior.
                const anterior = localStorage.getItem(CLAVE_ARCHIVO_PENDIENTE);
                descargarJSON(JSON.parse(anterior),
                    `respaldo-anterior-pendiente-${fechaLocal()}.json`);
                if (!confirm("Ya existe un respaldo pendiente. Acabamos de descargarlo. ¿Sustituir SOLO esa copia pendiente?")) return;
            }
            localStorage.setItem(CLAVE_ARCHIVO_PENDIENTE, JSON.stringify(respaldo));
            alert(
                "Respaldo validado y guardado como copia pendiente. " +
                "NO se modifico Supabase ni se reemplazaron datos actuales. " +
                "Conserva tambien el archivo original; la importacion se hara por modulo."
            );
        } catch (error) {
            console.error("Error preparando respaldo", error);
            alert("No se pudo preparar el respaldo: " + (error.message || error));
        }
    });

    // ======================================
    // 13. INICIAR CONFIGURACION SEGURA
    // ======================================

    $("descargar-respaldo").disabled = false;
    avisoFormulario(
        formularios.general,
        "Estos cambios se guardan en Supabase. Algunos encabezados de otros modulos " +
        "todavia utilizan textos fijos del codigo."
    );
    avisoFormulario(
        formularios.metas,
        "Las metas se sincronizan con Supabase; Informes las consultara al cargar. " +
        "Resumen se integrara en el siguiente paso."
    );
    avisoFormulario(
        formularios.puntos,
        "La regla se guarda en la nube. Los calculos de algunos modulos " +
        "todavia usan valores fijos hasta la integracion final."
    );
    avisoFormulario(
        formularios.horarios,
        "Horarios de referencia guardados en la nube. No modifican " +
        "automaticamente las marcaciones de Asistencia ni los bloques de Tareas."
    );

    cargarCampos();
    $("estado-almacenamiento").textContent = "Conectando...";
    $("estado-base-datos").textContent = "Conectando...";
    $("estado-usuarios").textContent = "—";
    controlarAcceso();
    iniciarSupabase();

    console.log("ABREGU STUDIOS: Configuracion sincronizada con Supabase.");

});
