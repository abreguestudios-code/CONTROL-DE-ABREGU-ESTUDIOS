/* ==========================================

   ABREGU STUDIOS

   CONTROL DE ASISTENCIA

   Responsable: SAMGIUK INGA

========================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    const $ = id => document.getElementById(id);

    const CLAVE = "aa_asistencias";

    const CLAVE_JORNADAS = "aa_jornadas";

    const JORNADAS = {

        instituto: "Día con instituto",

        completa: "Jornada completa",

        especial: "Jornada especial / LIVE"

    };

    const MOTIVOS = {

        ninguno: "Sin extensión",

        live: "Transmisión en vivo",

        grabacion: "Grabación",

        edicion: "Edición o entrega urgente",

        otro: "Otro motivo"

    };

    const formulario = $("form-asistencia");

    const lista = $("lista-asistencias");

    const guardarBoton = $("guardar-asistencia");

    if (!formulario || !lista || !guardarBoton) {

        console.error(

            "Control de asistencia: faltan elementos."

        );

        return;

    }

    // ======================================

    // 1. ALMACENAMIENTO

    // ======================================

    function leer(clave, defecto) {

        try {

            const valor = localStorage.getItem(clave);

            return valor === null

                ? defecto

                : JSON.parse(valor);

        } catch (error) {

            console.error(

                "No se pudo leer",

                clave,

                error

            );

            return defecto;

        }

    }

    // ======================================================
    // SUPABASE: UNA FILA POR FECHA DE ASISTENCIA
    // ======================================================
    // Se conserva una copia de los datos existentes ANTES de cargar la nube.
    // No se mezclan automáticamente los registros locales con los remotos.
    const MODULO_NUBE = "asistencia";
    const RESPALDO = "aa_asistencias_respaldo_pre_supabase_v1";
    const localAnterior = leer(CLAVE, []);
    try {
        if (localStorage.getItem(RESPALDO) === null) {
            localStorage.setItem(RESPALDO,
                JSON.stringify(Array.isArray(localAnterior) ? localAnterior : []));
        }
    } catch (error) {
        console.error("No se pudo respaldar asistencia:", error);
        alert("No se pudo crear el respaldo local de asistencia. No se iniciará la conexión.");
        return;
    }

    let registros = [];
    let fechaEditando = null;
    let jornadasNube = {};
    let estudioId = null;
    let usuarioId = null;
    let conectado = false;
    let listo = false;
    let ocupado = false;
    const db = window.abreguDB;
    const versiones = new Map();
    const claveFecha = fecha => `asistencia:${fecha}`;

    const panelNube = document.createElement("div");
    panelNube.className = "production-card";
    panelNube.style.cssText =
        "padding:16px;margin:16px 0 22px;border-left:3px solid #e53d54";

    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    estadoNube.textContent = "Conectando Asistencia con Supabase...";
    const accionesNube = document.createElement("div");
    accionesNube.className = "form-actions";

    function botonNube(textoBoton) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = textoBoton;
        return b;
    }

    const botonActualizar = botonNube("Actualizar desde Supabase");
    const botonImportar = botonNube("Importar asistencias locales");
    const botonRespaldo = botonNube("Descargar respaldo local");
    accionesNube.append(botonActualizar, botonImportar, botonRespaldo);
    panelNube.append(estadoNube, accionesNube);
    formulario.before(panelNube);

    function mostrarEstado(mensaje, error = false) {
        estadoNube.textContent = mensaje;
        estadoNube.style.color = error ? "#ff8794" : "";
    }

    function leerRespaldo() {
        const datos = leer(RESPALDO, []);
        return Array.isArray(datos) ? datos.filter(
            r => r && typeof r === "object" &&
                typeof r.fecha === "string" && fechaValida(r.fecha)
        ) : [];
    }

    function pendientesImportar() {
        const existentes = new Set(registros.map(r => r.fecha));
        return leerRespaldo().filter(r => !existentes.has(r.fecha));
    }

    function controlarAcceso() {
        const bloqueado = !listo || ocupado;
        guardarBoton.disabled = bloqueado;
        ["marcar-entrada", "iniciar-descanso", "finalizar-descanso", "marcar-salida"]
            .forEach(id => {
                const b = $(id);
                if (b && bloqueado) b.disabled = true;
            });
        lista.querySelectorAll("button").forEach(b => { b.disabled = bloqueado; });
        botonActualizar.disabled = !conectado || ocupado;
        botonImportar.hidden = listo && !pendientesImportar().length;
        botonImportar.disabled = bloqueado || !pendientesImportar().length;
        botonRespaldo.disabled = false;
    }

    function guardarCacheLocal() {
        // Compatibilidad con otros módulos; jamás cambiar el respaldo original.
        try {
            localStorage.setItem(CLAVE, JSON.stringify(registros));
            // aa_jornadas pertenece a Mis tareas: NO sustituir su caché
            // aquí, porque podría contener jornadas locales aún sin importar.
        } catch (error) {
            console.warn("La nube guardó la asistencia, pero falló la caché:", error);
            mostrarEstado("Datos guardados en Supabase; falló la caché local.", true);
        }
    }

    function pintarEstado() {
        const pendientes = pendientesImportar();
        mostrarEstado(
            `Supabase conectado: ${registros.length} días de asistencia en la nube.` +
            (pendientes.length
                ? ` ${pendientes.length} registros locales pendientes de importar.` : "")
        );
        controlarAcceso();
    }

    // Paginación: evita perder registros si el histórico supera las 1000 filas.
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
        controlarAcceso();
        mostrarEstado("Cargando asistencias y jornadas desde Supabase...");
        try {
            const [filas, filasTareas] = await Promise.all([
                leerModulo(MODULO_NUBE), leerModulo("tareas")
            ]);
            const siguientes = [];
            const siguientesVersiones = new Map();
            const fechasVistas = new Set();
            for (const fila of filas) {
                const r = fila.contenido;
                if (!r || Array.isArray(r) || typeof r !== "object" ||
                    !fechaValida(r.fecha) ||
                    fila.registro_clave !== claveFecha(r.fecha) ||
                    fechasVistas.has(r.fecha)) continue;
                siguientes.push(r);
                fechasVistas.add(r.fecha);
                siguientesVersiones.set(r.fecha, {
                    id: fila.id, actualizado_en: fila.actualizado_en
                });
            }
            const jornadas = {};
            for (const fila of filasTareas) {
                const dato = fila.contenido;
                if (fila.registro_clave?.startsWith("jornada:") &&
                    dato && typeof dato === "object" &&
                    fechaValida(dato.fecha) &&
                    fila.registro_clave === `jornada:${dato.fecha}` &&
                    typeof dato.tipo === "string") {
                    jornadas[dato.fecha] = dato.tipo;
                }
            }
            registros = siguientes;
            jornadasNube = jornadas;
            versiones.clear();
            siguientesVersiones.forEach((valor, fecha) => versiones.set(fecha, valor));
            listo = true;
            guardarCacheLocal();
            limpiarFormulario();
            actualizarTodo();
            pintarEstado();
        } catch (error) {
            console.error("Error cargando asistencia desde Supabase:", error);
            mostrarEstado(`No se pudo cargar Supabase: ${error.message || error}. Cambios bloqueados.`, true);
        } finally {
            ocupado = false;
            actualizarTodo();
            controlarAcceso();
        }
    }

    async function iniciarSupabase() {
        try {
            if (!db) throw new Error("Falta cargar supabase.js.");
            const { data, error } = await db.auth.getUser();
            if (error || !data?.user) throw new Error("Inicia sesión para acceder.");
            usuarioId = data.user.id;
            const { data: estudio, error: errorEstudio } = await db.from("estudios")
                .select("id").eq("propietario_id", usuarioId).maybeSingle();
            if (errorEstudio || !estudio) throw new Error("No se encontró tu estudio.");
            const { data: miembro, error: errorMiembro } = await db.from("miembros_estudio")
                .select("rol,activo")
                .eq("estudio_id", estudio.id)
                .eq("usuario_id", usuarioId).maybeSingle();
            if (errorMiembro || !miembro || miembro.rol !== "administrador" ||
                miembro.activo !== true) {
                throw new Error("Esta cuenta no tiene permiso de administrador.");
            }
            estudioId = estudio.id;
            conectado = true;
            await cargarNube();
        } catch (error) {
            console.error("Asistencia: acceso a Supabase:", error);
            mostrarEstado(`Sin conexión autorizada: ${error.message || error}.`, true);
            conectado = false;
            listo = false;
            controlarAcceso();
        }
    }

    async function escribirRemoto(registro) {
        const fecha = registro.fecha;
        const previa = versiones.get(fecha);
        let consulta;
        if (previa) {
            // Actualización condicional para no pisar otra edición.
            const siguienteFecha = new Date(Math.max(
                Date.now(), (Date.parse(previa.actualizado_en || "") || 0) + 1
            )).toISOString();
            consulta = db.from("registros_modulos")
                .update({ contenido: registro, actualizado_en: siguienteFecha })
                .eq("id", previa.id)
                .eq("estudio_id", estudioId)
                .eq("modulo", MODULO_NUBE)
                .eq("registro_clave", claveFecha(fecha))
                .eq("actualizado_en", previa.actualizado_en)
                .select("id,actualizado_en").maybeSingle();
        } else {
            consulta = db.from("registros_modulos")
                .insert({
                    estudio_id: estudioId,
                    modulo: MODULO_NUBE,
                    registro_clave: claveFecha(fecha),
                    contenido: registro,
                    creado_por: usuarioId
                })
                .select("id,actualizado_en").single();
        }
        const { data, error } = await consulta;
        if (error) throw error;
        if (!data) {
            throw new Error("Esta asistencia cambió en otra computadora. Actualiza desde Supabase.");
        }
        versiones.set(fecha, data);
    }

    async function borrarRemoto(fecha) {
        const previa = versiones.get(fecha);
        if (!previa) throw new Error("No se encontró la versión del registro. Actualiza primero.");
        const { data, error } = await db.from("registros_modulos")
            .delete()
            .eq("id", previa.id)
            .eq("estudio_id", estudioId)
            .eq("modulo", MODULO_NUBE)
            .eq("registro_clave", claveFecha(fecha))
            .eq("actualizado_en", previa.actualizado_en)
            .select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Esta asistencia cambió en otra computadora. Actualiza Supabase.");
        versiones.delete(fecha);
    }

    // La pantalla se modifica SOLO cuando Supabase confirma el guardado.
    // Se escriben filas por día (no todo el histórico de una sola vez).
    async function persistir(nuevos) {
        if (!listo || ocupado) return false;
        ocupado = true;
        controlarAcceso();
        mostrarEstado("Guardando cambios de asistencia en Supabase...");
        try {
            const anteriores = new Map(registros.map(r => [r.fecha, r]));
            const siguientes = new Map(nuevos.map(r => [r.fecha, r]));
            for (const [fecha, registro] of siguientes) {
                if (!anteriores.has(fecha) ||
                    JSON.stringify(anteriores.get(fecha)) !== JSON.stringify(registro)) {
                    await escribirRemoto(registro);
                }
            }
            for (const fecha of anteriores.keys()) {
                if (!siguientes.has(fecha)) await borrarRemoto(fecha);
            }
            registros = nuevos;
            guardarCacheLocal();
            actualizarTodo();
            pintarEstado();
            return true;
        } catch (error) {
            console.error("No se pudo guardar asistencia en Supabase:", error);
            // Alguna acción de varios días pudo ejecutarse parcialmente.
            // Bloquear hasta recargar, nunca afirmar que todo se guardó.
            listo = false;
            mostrarEstado(`Error al guardar: ${error.message || error}. Pulsa Actualizar desde Supabase.`, true);
            alert("No se confirmó el cambio en Supabase. Revisa el panel y actualiza antes de continuar.");
            return false;
        } finally {
            ocupado = false;
            actualizarTodo();
            controlarAcceso();
        }
    }

    function descargarRespaldo() {
        const contenido = {
            modulo: MODULO_NUBE,
            generadoEn: new Date().toISOString(),
            asistencias: leerRespaldo(),
            jornadasLocales: leer(CLAVE_JORNADAS, {})
        };
        const blob = new Blob([JSON.stringify(contenido, null, 2)],
            { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = "abregu-studios-respaldo-asistencias.json";
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importarLocales() {
        if (!listo || ocupado) return;
        const pendientes = pendientesImportar();
        if (!pendientes.length) return;
        if (!confirm(`¿Importar ${pendientes.length} asistencias locales? ` +
            "Los días existentes en la nube no se reemplazarán.")) return;
        ocupado = true;
        controlarAcceso();
        let importados = 0, omitidos = 0, fallo = null;
        try {
            for (const registro of pendientes) {
                try {
                    await escribirRemoto(registro);
                    importados++;
                } catch (error) {
                    if (error?.code === "23505") omitidos++;
                    else { fallo = error; break; }
                }
            }
        } finally {
            ocupado = false;
        }
        // La nube manda: recuperar todos los días tras la importación.
        await cargarNube();
        alert(`Importados: ${importados}. Omitidos o con conflicto: ${omitidos}. ` +
            (fallo ? `Error: ${fallo.message}. ` : "") +
            "El respaldo local se conserva.");
    }

    botonActualizar.addEventListener("click", cargarNube);
    botonImportar.addEventListener("click", importarLocales);
    botonRespaldo.addEventListener("click", descargarRespaldo);
    controlarAcceso();

    // ======================================

    // 2. FECHAS Y HORAS

    // ======================================

    function fechaLocal(fecha = new Date()) {

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

    function horaLocal(fecha = new Date()) {

        return String(

            fecha.getHours()

        ).padStart(2, "0") + ":" +

        String(

            fecha.getMinutes()

        ).padStart(2, "0");

    }

    function minutos(hora) {

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(

            hora || ""

        )) {

            return null;

        }

        const [h, m] = hora.split(":").map(Number);

        return h * 60 + m;

    }

    function duracionTexto(min) {

        return (

            `${Math.floor(min / 60)} h ` +

            `${String(min % 60).padStart(2, "0")} min`

        );

    }

    function formatoFecha(valor) {

        return new Date(

            valor + "T12:00:00"

        ).toLocaleDateString("es-PE", {

            weekday: "long",

            day: "2-digit",

            month: "short",

            year: "numeric"

        });

    }

    function fechaValida(valor) {

        if (!/^\d{4}-\d{2}-\d{2}$/.test(

            valor || ""

        )) {

            return false;

        }

        const fecha = new Date(

            valor + "T12:00:00"

        );

        return (

            !Number.isNaN(fecha.getTime()) &&

            fechaLocal(fecha) === valor

        );

    }

    function registroHoy() {

        return registros.find(

            registro =>

                registro.fecha === fechaLocal()

        );

    }

    function jornadasGuardadas() {

        const datos = jornadasNube;

        return (

            datos &&

            typeof datos === "object" &&

            !Array.isArray(datos)

        ) ? datos : {};

    }

    // ======================================

    // 3. VALIDAR ASISTENCIA

    // ======================================

    function validar(registro) {

        if (

            !fechaValida(registro.fecha) ||

            registro.fecha > fechaLocal()

        ) {

            return "Selecciona una fecha válida que no sea futura.";

        }

        if (!JORNADAS[registro.jornada]) {

            return "Selecciona un tipo de jornada.";

        }

        const entrada = minutos(registro.entrada);

        const salida = minutos(registro.salida);

        const inicio = minutos(

            registro.descansoInicio

        );

        const fin = minutos(

            registro.descansoFin

        );

        if (entrada === null) {

            return "Ingresa una hora de entrada válida.";

        }

        if (

            registro.descansoFin &&

            !registro.descansoInicio

        ) {

            return "Registra primero el inicio del descanso.";

        }

        if (

            inicio !== null &&

            inicio < entrada

        ) {

            return "El descanso no puede empezar antes de la entrada.";

        }

        if (

            fin !== null &&

            (inicio === null || fin <= inicio)

        ) {

            return "El fin del descanso debe ser posterior al inicio.";

        }

        if (

            salida !== null &&

            salida <= entrada

        ) {

            return "La salida debe ser posterior a la entrada del mismo día.";

        }

        if (

            salida !== null &&

            inicio !== null &&

            !registro.descansoFin

        ) {

            return "Finaliza el descanso antes de registrar la salida.";

        }

        if (

            salida !== null &&

            fin !== null &&

            fin > salida

        ) {

            return "El descanso debe terminar antes de la salida.";

        }

        if (

            salida !== null &&

            inicio !== null &&

            inicio > salida

        ) {

            return "El descanso debe empezar antes de la salida.";

        }

        return "";

    }

    // ======================================

    // 4. CALCULAR TIEMPO TRABAJADO

    // ======================================

    function calculos(registro) {

        const entrada = minutos(registro.entrada);

        const salida = minutos(registro.salida);

        if (

            entrada === null ||

            salida === null ||

            salida <= entrada

        ) {

            return {

                efectivo: 0,

                adicional: 0,

                completo: false

            };

        }

        const inicio = minutos(

            registro.descansoInicio

        );

        const fin = minutos(

            registro.descansoFin

        );

        // Separar períodos de trabajo

        // para descontar el descanso.

        const intervalos = (

            inicio !== null &&

            fin !== null

        )

            ? [

                [entrada, inicio],

                [fin, salida]

            ]

            : [

                [entrada, salida]

            ];

        const efectivo = intervalos.reduce(

            (total, [a, b]) =>

                total + Math.max(0, b - a),

            0

        );

        // Horarios habituales.

        const inicioNormal =

            registro.jornada === "instituto"

                ? 14 * 60

                : registro.jornada === "completa"

                    ? 10 * 60 + 30

                    : null;

        let adicional = 0;

        // Tiempo efectivo trabajado antes

        // o después de la jornada prevista.

        if (inicioNormal !== null) {

            for (const [a, b] of intervalos) {

                adicional += Math.max(

                    0,

                    Math.min(b, inicioNormal) - a

                );

                adicional += Math.max(

                    0,

                    b - Math.max(a, 20 * 60)

                );

            }

        }

        return {

            efectivo,

            adicional,

            completo: true

        };

    }

    // ======================================

    // 5. ELEMENTOS VISUALES

    // ======================================

    function texto(tag, contenido, clase = "") {

        const nodo = document.createElement(tag);

        nodo.textContent = contenido;

        if (clase) {

            nodo.className = clase;

        }

        return nodo;

    }

    function boton(nombre, accion) {

        const nuevo = texto("button", nombre);

        nuevo.type = "button";

        nuevo.addEventListener(

            "click",

            accion

        );

        return nuevo;

    }

    function campo(id, valor) {

        if ($(id)) {

            $(id).value = valor ?? "";

        }

    }

    function limpiarFormulario() {

        fechaEditando = null;

        formulario.reset();

        campo(

            "asistencia-fecha",

            fechaLocal()

        );

        campo(

            "asistencia-jornada",

            jornadasGuardadas()[fechaLocal()] || ""

        );

        guardarBoton.textContent =

            "Guardar asistencia";

    }

    // ======================================

    // 6. ACTUALIZAR ASISTENCIA DE HOY

    // ======================================

    function actualizarHoy() {

        const hoy = fechaLocal();

        const registro = registroHoy();

        $("fecha-asistencia-actual").textContent =

            formatoFecha(hoy);

        $("entrada-hoy").textContent =

            registro?.entrada || "--:--";

        $("descanso-inicio-hoy").textContent =

            registro?.descansoInicio || "--:--";

        $("descanso-fin-hoy").textContent =

            registro?.descansoFin || "--:--";

        $("salida-hoy").textContent =

            registro?.salida || "--:--";

        let estado = "Sin registro de entrada";

        if (registro) {

            if (registro.salida) {

                estado = "Jornada finalizada";

            } else if (

                registro.descansoInicio &&

                !registro.descansoFin

            ) {

                estado = "Descanso en curso";

            } else {

                estado = "Jornada en curso";

            }

        }

        $("estado-asistencia").textContent = estado;

        $("resumen-asistencia-hoy").textContent =

            !registro

                ? "Selecciona tu jornada en el formulario y registra tu entrada."

                : registro.salida

                    ? (

                        "Tiempo efectivo: " +

                        duracionTexto(

                            calculos(registro).efectivo

                        ) +

                        ". Tipo: " +

                        JORNADAS[registro.jornada]

                    )

                    : (

                        "Entrada registrada a las " +

                        registro.entrada +

                        ". Jornada pendiente de cierre."

                    );

        // Activar solamente acciones válidas.

        $("marcar-entrada").disabled =

            Boolean(registro);

        $("iniciar-descanso").disabled =

            !registro ||

            !!registro.salida ||

            !!registro.descansoInicio;

        $("finalizar-descanso").disabled =

            !registro ||

            !!registro.salida ||

            !registro.descansoInicio ||

            !!registro.descansoFin;

        $("marcar-salida").disabled =

            !registro ||

            !!registro.salida ||

            Boolean(

                registro.descansoInicio &&

                !registro.descansoFin

            );

    }

    // ======================================

    // 7. MARCACIONES AUTOMATICAS

    // ======================================

    async function marcar(accion) {
        if (!listo || ocupado) return;

        const ahora = horaLocal();

        const fecha = fechaLocal();

        const actual = registroHoy();

        let nuevo;

        if (accion === "entrada") {

            if (actual) return;

            const tipoFormulario =

                $("asistencia-fecha").value === fecha

                    ? $("asistencia-jornada").value

                    : "";

            const jornada =

                tipoFormulario ||

                jornadasGuardadas()[fecha] ||

                "";

            if (!JORNADAS[jornada]) {

                alert(

                    "Primero selecciona tu tipo de jornada en el formulario de asistencia."

                );

                $("asistencia-jornada").scrollIntoView({

                    behavior: "smooth",

                    block: "center"

                });

                return;

            }

            nuevo = {

                fecha: fecha,

                jornada: jornada,

                entrada: ahora,

                descansoInicio: "",

                descansoFin: "",

                salida: "",

                motivo: "ninguno",

                observaciones: ""

            };

        } else {

            if (!actual || actual.salida) return;

            nuevo = { ...actual };

            if (accion === "inicio") {

                if (actual.descansoInicio) return;

                nuevo.descansoInicio = ahora;

            } else if (accion === "fin") {

                if (

                    !actual.descansoInicio ||

                    actual.descansoFin

                ) {

                    return;

                }

                nuevo.descansoFin = ahora;

            } else if (accion === "salida") {

                if (

                    actual.descansoInicio &&

                    !actual.descansoFin

                ) {

                    alert(

                        "Finaliza el descanso antes de registrar la salida."

                    );

                    return;

                }

                nuevo.salida = ahora;

            }

        }

        const error = validar(nuevo);

        if (error) {

            alert(error);

            return;

        }

        const otros = registros.filter(

            r => r.fecha !== fecha

        );

        if (await persistir([...otros, nuevo])) {

            actualizarTodo();

        }

    }

    $("marcar-entrada").addEventListener(

        "click",

        () => marcar("entrada")

    );

    $("iniciar-descanso").addEventListener(

        "click",

        () => marcar("inicio")

    );

    $("finalizar-descanso").addEventListener(

        "click",

        () => marcar("fin")

    );

    $("marcar-salida").addEventListener(

        "click",

        () => marcar("salida")

    );

    // ======================================

    // 8. REGISTRO MANUAL

    // ======================================

    formulario.addEventListener(

        "submit",

        async evento => {

            evento.preventDefault();
            if (!listo || ocupado) return;

            if (!formulario.reportValidity()) {

                return;

            }

            const registro = {

                fecha:

                    $("asistencia-fecha").value,

                jornada:

                    $("asistencia-jornada").value,

                entrada:

                    $("asistencia-entrada").value,

                descansoInicio:

                    $("asistencia-descanso-inicio").value,

                descansoFin:

                    $("asistencia-descanso-fin").value,

                salida:

                    $("asistencia-salida").value,

                motivo:

                    $("asistencia-motivo").value,

                observaciones:

                    $("asistencia-observaciones")

                        .value.trim()

            };

            const error = validar(registro);

            if (error) {

                alert(error);

                return;

            }

            const existente = registros.find(

                r => r.fecha === registro.fecha

            );

            if (

                existente &&

                fechaEditando !== registro.fecha

            ) {

                const confirmar = confirm(

                    "Ya existe una asistencia para esa fecha. ¿Deseas reemplazarla?"

                );

                if (!confirmar) return;

            }

            const siguientes = registros.filter(

                r =>

                    r.fecha !== registro.fecha &&

                    r.fecha !== fechaEditando

            );

            siguientes.push(registro);

            if (!await persistir(siguientes)) {

                return;

            }

            limpiarFormulario();

            actualizarTodo();

            alert(

                "¡Asistencia guardada correctamente!"

            );

        }

    );

    // ======================================

    // 9. LIMPIAR FORMULARIO

    // ======================================

    formulario.addEventListener("reset", () => {

        fechaEditando = null;

        guardarBoton.textContent =

            "Guardar asistencia";

        queueMicrotask(() => {

            if (!$("asistencia-fecha").value) {

                campo(

                    "asistencia-fecha",

                    fechaLocal()

                );

            }

        });

    });

    // ======================================

    // 10. EDITAR REGISTRO

    // ======================================

    function editar(registro) {

        fechaEditando = registro.fecha;

        const campos = {

            "asistencia-fecha":

                registro.fecha,

            "asistencia-jornada":

                registro.jornada,

            "asistencia-entrada":

                registro.entrada,

            "asistencia-descanso-inicio":

                registro.descansoInicio,

            "asistencia-descanso-fin":

                registro.descansoFin,

            "asistencia-salida":

                registro.salida,

            "asistencia-motivo":

                registro.motivo,

            "asistencia-observaciones":

                registro.observaciones

        };

        Object.entries(campos).forEach(

            ([id, valor]) => campo(id, valor)

        );

        guardarBoton.textContent =

            "Guardar cambios";

        $("registrar-asistencia").scrollIntoView({

            behavior: "smooth"

        });

    }

    // ======================================

    // 11. ELIMINAR REGISTRO

    // ======================================

    async function eliminar(fecha) {
        if (!listo || ocupado) return;

        const confirmar = confirm(

            `¿Eliminar la asistencia del ${fecha}?`

        );

        if (!confirmar) return;

        const restantes = registros.filter(

            r => r.fecha !== fecha

        );

        if (await persistir(restantes)) {

            if (fechaEditando === fecha) {

                limpiarFormulario();

            }

            actualizarTodo();

        }

    }

    // ======================================

    // 12. ESTADISTICAS SEMANALES

    // ======================================

    function actualizarEstadisticas() {

        const ahora = new Date();

        const lunes = new Date(

            ahora.getFullYear(),

            ahora.getMonth(),

            ahora.getDate(),

            12

        );

        const diferencia =

            (lunes.getDay() + 6) % 7;

        lunes.setDate(

            lunes.getDate() - diferencia

        );

        const domingo = new Date(lunes);

        domingo.setDate(

            domingo.getDate() + 6

        );

        const principio = fechaLocal(lunes);

        const fin = fechaLocal(domingo);

        const semana = registros.filter(

            r =>

                r.fecha >= principio &&

                r.fecha <= fin

        );

        const totalEfectivo = semana.reduce(

            (total, r) =>

                total + calculos(r).efectivo,

            0

        );

        const totalAdicional = semana.reduce(

            (total, r) =>

                total + calculos(r).adicional,

            0

        );

        $("dias-asistidos").textContent =

            semana.filter(r => r.entrada).length;

        $("horas-trabajadas").textContent =

            duracionTexto(totalEfectivo);

        $("horas-adicionales").textContent =

            duracionTexto(totalAdicional);

        $("asistencias-incompletas").textContent =

            semana.filter(

                r => !calculos(r).completo

            ).length;

    }

    // ======================================

    // 13. FILTROS DEL HISTORIAL

    // ======================================

    const desde = $("filtro-asistencia-desde");

    const hasta = $("filtro-asistencia-hasta");

    const exportarBoton =

        $("exportar-asistencia");

    function registrosFiltrados() {

        return [...registros]

            .filter(r =>

                (!desde.value ||

                    r.fecha >= desde.value) &&

                (!hasta.value ||

                    r.fecha <= hasta.value)

            )

            .sort(

                (a, b) =>

                    b.fecha.localeCompare(a.fecha)

            );

    }

    // ======================================

    // 14. MOSTRAR HISTORIAL

    // ======================================

    function mostrarHistorial() {

        lista.replaceChildren();

        const filtrados = registrosFiltrados();

        exportarBoton.disabled =

            filtrados.length === 0;

        if (!filtrados.length) {

            const caja = texto(

                "div",

                "",

                "empty-state"

            );

            caja.appendChild(

                texto(

                    "p",

                    "No hay asistencias en este período."

                )

            );

            lista.appendChild(caja);

            return;

        }

        filtrados.forEach(registro => {

            const caja = texto(

                "article",

                "",

                "production-card"

            );

            const horas = calculos(registro);

            caja.appendChild(

                texto(

                    "h3",

                    formatoFecha(registro.fecha)

                )

            );

            const detalles = [

                `Jornada: ${

                    JORNADAS[registro.jornada] ||

                    registro.jornada

                }`,

                `Entrada: ${

                    registro.entrada || "--:--"

                } · Salida: ${

                    registro.salida || "Pendiente"

                }`,

                `Descanso: ${

                    registro.descansoInicio || "--:--"

                } a ${

                    registro.descansoFin || "--:--"

                }`,

                horas.completo

                    ? `Tiempo efectivo: ${

                        duracionTexto(horas.efectivo)

                    }`

                    : "Registro incompleto",

                `Tiempo adicional registrado: ${

                    duracionTexto(horas.adicional)

                }`,

                `Motivo: ${

                    MOTIVOS[registro.motivo] ||

                    "Sin extensión"

                }`

            ];

            if (registro.observaciones) {

                detalles.push(

                    `Observaciones: ${

                        registro.observaciones

                    }`

                );

            }

            detalles.forEach(detalle => {

                caja.appendChild(

                    texto("p", detalle)

                );

            });

            const acciones = texto(

                "div",

                "",

                "form-actions"

            );

            acciones.append(

                boton(

                    "Editar",

                    () => editar(registro)

                ),

                boton(

                    "Eliminar",

                    () => eliminar(registro.fecha)

                )

            );

            caja.appendChild(acciones);

            lista.appendChild(caja);

        });

    }

    // ======================================

    // 15. ACTIVAR FILTROS

    // ======================================

    desde.disabled = false;

    hasta.disabled = false;

    $("limpiar-filtros-asistencia").disabled = false;

    desde.addEventListener(

        "change",

        mostrarHistorial

    );

    hasta.addEventListener(

        "change",

        mostrarHistorial

    );

    $("limpiar-filtros-asistencia").addEventListener(

        "click",

        () => {

            desde.value = "";

            hasta.value = "";

            mostrarHistorial();

        }

    );

    // ======================================

    // 16. EXPORTAR A CSV

    // ======================================

    function valorCSV(valor) {

        let contenido = String(valor ?? "");

        // Evitar fórmulas al abrir en Excel.

        if (/^\s*[=+@-]/.test(contenido)) {

            contenido = "'" + contenido;

        }

        return '"' +

            contenido.replace(/"/g, '""') +

            '"';

    }

    exportarBoton.addEventListener(

        "click",

        () => {

            const filas = registrosFiltrados();

            if (!filas.length) return;

            const encabezados = [

                "Fecha",

                "Jornada",

                "Entrada",

                "Inicio descanso",

                "Fin descanso",

                "Salida",

                "Horas efectivas",

                "Tiempo adicional",

                "Estado",

                "Motivo",

                "Observaciones"

            ];

            const datos = filas.map(registro => {

                const resultado = calculos(registro);

                return [

                    registro.fecha,

                    JORNADAS[registro.jornada] ||

                        registro.jornada,

                    registro.entrada,

                    registro.descansoInicio,

                    registro.descansoFin,

                    registro.salida,

                    resultado.completo

                        ? duracionTexto(resultado.efectivo)

                        : "",

                    resultado.completo

                        ? duracionTexto(resultado.adicional)

                        : "",

                    resultado.completo

                        ? "Completo"

                        : "Incompleto",

                    MOTIVOS[registro.motivo] ||

                        registro.motivo,

                    registro.observaciones

                ];

            });

            const csv = "\ufeff" +

                [encabezados, ...datos]

                .map(fila =>

                    fila.map(valorCSV).join(";")

                )

                .join("\r\n");

            const blob = new Blob(

                [csv],

                {

                    type: "text/csv;charset=utf-8"

                }

            );

            const url = URL.createObjectURL(blob);

            const enlace = document.createElement("a");

            enlace.href = url;

            enlace.download =

                `asistencia-audiovisual-${fechaLocal()}.csv`;

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

    // 17. ACTUALIZAR SISTEMA

    // ======================================

    function actualizarTodo() {

        actualizarHoy();

        actualizarEstadisticas();

        mostrarHistorial();

        controlarAcceso();

    }

    // ======================================

    // 18. INICIAR CONTROL DE ASISTENCIA

    // ======================================

    guardarBoton.disabled = true;

    campo(

        "asistencia-fecha",

        fechaLocal()

    );

    campo(

        "asistencia-jornada",

        jornadasGuardadas()[fechaLocal()] || ""

    );

    const ayuda = formulario.querySelector(

        ".helper-text"

    );

    if (ayuda) {

        ayuda.textContent =

            "Asistencias sincronizadas con Supabase por fecha. " +

            "El cálculo definitivo requiere registrar la salida.";

    }

    actualizarTodo();
    iniciarSupabase();

    console.log(

        "ABREGU STUDIOS: Asistencia con Supabase iniciada."

    );

});