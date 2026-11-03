
/* ==========================================
   ABREGU STUDIOS
   JavaScript - Panel principal
   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // 1. CONFIGURACIÓN GENERAL
    // ======================================

    
/* ==========================================
   CONFIGURACION COMPARTIDA DEL DASHBOARD
========================================== */

function leerConfigResumen() {

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
            "No se pudo leer la configuración.",
            error
        );

        return {};
    }
}

function valorConfigResumen(
    valor,
    defecto,
    maximo
) {

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

const CONFIG_RESUMEN = leerConfigResumen();

const METAS = {

    abregu: valorConfigResumen(
        CONFIG_RESUMEN.metas?.abregu,
        4,
        100
    ),

    fuze: valorConfigResumen(
        CONFIG_RESUMEN.metas?.fuze,
        7,
        100
    ),

    kintex: valorConfigResumen(
        CONFIG_RESUMEN.metas?.kintex,
        2,
        100
    ),

    caedla: valorConfigResumen(
        CONFIG_RESUMEN.metas?.caedla,
        3,
        100
    )
};

const PUNTOS_TAREA = valorConfigResumen(
    CONFIG_RESUMEN.puntos?.tarea,
    3,
    1000
);

const PUNTOS_VIDEO = valorConfigResumen(
    CONFIG_RESUMEN.puntos?.video,
    10,
    1000
);


    const fechaActual = new Date();

    function claveFecha(fecha) {
        const año = fecha.getFullYear();
        const mes = String(
            fecha.getMonth() + 1
        ).padStart(2, "0");
        const dia = String(
            fecha.getDate()
        ).padStart(2, "0");

        return `${año}-${mes}-${dia}`;
    }

    // ======================================
    // 2. MOSTRAR FECHA ACTUAL
    // ======================================

    const elementoFecha =
        document.getElementById("fecha-actual");

    if (elementoFecha) {
        elementoFecha.textContent =
            fechaActual.toLocaleDateString("es-PE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
    }

    // ======================================
    // 3. PLANIFICACIÓN DE TAREAS POR DÍA
    // ======================================

    // 0 = Domingo
    // 1 = Lunes
    // 2 = Martes
    // 3 = Miércoles
    // 4 = Jueves
    // 5 = Viernes
    // 6 = Sábado

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
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado"
    ];

    const numeroDia = fechaActual.getDay();

    const elementoDia =
        document.getElementById("dia-actual");

    if (elementoDia) {
        elementoDia.textContent =
            `Actividades del ${nombresDias[numeroDia]}`;
    }

    // ======================================
    // 4. ALMACENAMIENTO LOCAL DE TAREAS
    // ======================================

    const CLAVE_TAREAS = "aa_tareas_diarias";

    function leerAlmacenamiento(clave, respaldo) {
        try {
            const datos = localStorage.getItem(clave);
            return datos ? JSON.parse(datos) : respaldo;
        } catch (error) {
            console.error("Error al leer datos:", error);
            return respaldo;
        }
    }

    const historialTareas =
        leerAlmacenamiento(CLAVE_TAREAS, {});

    const fechaHoy = claveFecha(fechaActual);

    if (!Array.isArray(historialTareas[fechaHoy])) {
        historialTareas[fechaHoy] = [];
    }

    function guardarTareas() {
        try {
            localStorage.setItem(
                CLAVE_TAREAS,
                JSON.stringify(historialTareas)
            );
        } catch (error) {
            console.error(
                "No se pudieron guardar las tareas:",
                error
            );
        }
    }

    // ======================================
    // 5. GENERAR TAREAS DEL DÍA
    // ======================================

    const listaTareas =
        document.getElementById("lista-tareas");

    const tareasHoy = tareasSemanales[numeroDia] || [];

    function tareaCompletada(indice) {
        return historialTareas[fechaHoy].includes(indice);
    }

    function alternarTarea(indice) {
        const completadas = historialTareas[fechaHoy];

        if (completadas.includes(indice)) {
            historialTareas[fechaHoy] =
                completadas.filter(numero => numero !== indice);
        } else {
            completadas.push(indice);
        }

        guardarTareas();
        mostrarTareas();
        actualizarIndicadores();
    }

    function mostrarTareas() {

        if (!listaTareas) return;

        listaTareas.innerHTML = "";

        tareasHoy.forEach((texto, indice) => {

            const li = document.createElement("li");
            const completada = tareaCompletada(indice);

            li.textContent = completada
                ? `✓ ${texto}`
                : texto;

            li.setAttribute("role", "checkbox");
            li.setAttribute(
                "aria-checked",
                String(completada)
            );

            li.tabIndex = 0;

            li.style.cursor = "pointer";

            if (completada) {
                li.style.background = "rgba(229, 28, 56, 0.12)";
                li.style.borderColor = "#e51c38";
                li.style.color = "#f7f5f4";
            }

            li.addEventListener("click", () => {
                alternarTarea(indice);
            });

            li.addEventListener("keydown", (evento) => {
                if (
                    evento.key === "Enter" ||
                    evento.key === " "
                ) {
                    evento.preventDefault();
                    alternarTarea(indice);
                }
            });

            listaTareas.appendChild(li);

        });

    }

    // ======================================
    // 6. CALCULAR LA SEMANA ACTUAL
    // ======================================

    function inicioDeSemana(fecha) {

        const lunes = new Date(fecha);

        const desplazamiento =
            (lunes.getDay() + 6) % 7;

        lunes.setDate(
            lunes.getDate() - desplazamiento
        );

        lunes.setHours(0, 0, 0, 0);

        return lunes;
    }

    const lunesActual = inicioDeSemana(fechaActual);

    function estaEnSemana(fechaTexto) {

        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTexto)) {
            return false;
        }

        const fecha = new Date(
            `${fechaTexto}T12:00:00`
        );

        const fin = new Date(lunesActual);
        fin.setDate(fin.getDate() + 7);

        return fecha >= lunesActual && fecha < fin;
    }

    // ======================================
    // 7. VIDEOS PUBLICADOS
    // ======================================

    // Este registro será alimentado posteriormente
    // desde la página Producción Audiovisual.

    const CLAVE_VIDEOS = "aa_videos_publicados";

    function videosDeEstaSemana() {

        const videos = leerAlmacenamiento(
            CLAVE_VIDEOS,
            []
        );

        if (!Array.isArray(videos)) return [];

        return videos.filter(video =>
            video &&
            estaEnSemana(video.fecha) &&
            Object.hasOwn(METAS, video.marca)
        );

    }

    // ======================================
    // 8. ACTUALIZAR INDICADORES
    // ======================================


function actualizarIndicadores() {

    // =====================================
    // 1. LEER TAREAS PERSONALIZADAS
    // =====================================

    const datosTareas = leerAlmacenamiento(
        "aa_tareas_personalizadas",
        []
    );

    const tareasPersonalizadas =
        Array.isArray(datosTareas) ? datosTareas : [];

    const datosCompletados = leerAlmacenamiento(
        "aa_tareas_personales_completadas",
        {}
    );

    const completadasPersonalizadas =
        datosCompletados &&
        typeof datosCompletados === "object"
            ? datosCompletados
            : {};


    // =====================================
    // 2. VERIFICAR FECHAS DE LAS TAREAS
    // =====================================

    function corresponde(tarea, fecha) {

        if (!tarea.fecha || fecha < tarea.fecha) {
            return false;
        }

        if (tarea.repeticion === "diaria") {
            return true;
        }

        if (tarea.repeticion === "semanal") {

            const diaTarea = new Date(
                `${tarea.fecha}T12:00:00`
            ).getDay();

            const diaFecha = new Date(
                `${fecha}T12:00:00`
            ).getDay();

            return diaTarea === diaFecha;
        }

        return tarea.fecha === fecha;
    }


    // =====================================
    // 3. CALCULAR TAREAS DE UNA FECHA
    // =====================================

    function calcularTareas(fecha) {

        const dia = new Date(
            `${fecha}T12:00:00`
        ).getDay();

        const rutinas = tareasSemanales[dia] || [];

        const marcadasRutinas = new Set(
            Array.isArray(historialTareas[fecha])
                ? historialTareas[fecha]
                : []
        );

        const rutinasTerminadas = rutinas.filter(
            (_, indice) => marcadasRutinas.has(indice)
        ).length;

        const tareasDelDia = tareasPersonalizadas.filter(
            tarea => corresponde(tarea, fecha)
        );

        const marcadas = new Set(
            Array.isArray(completadasPersonalizadas[fecha])
                ? completadasPersonalizadas[fecha]
                : []
        );

        const personalizadasTerminadas =
            tareasDelDia.filter(
                tarea => marcadas.has(tarea.id)
            ).length;

        return {
            total: rutinas.length + tareasDelDia.length,

            terminadas:
                rutinasTerminadas +
                personalizadasTerminadas
        };
    }


    // =====================================
    // 4. PENDIENTES DEL DÍA ACTUAL
    // =====================================

    const resultadoHoy = calcularTareas(fechaHoy);

    const pendientesHoy =
        resultadoHoy.total - resultadoHoy.terminadas;

    const indicadorPendientes =
        document.getElementById("tareas-pendientes");

    if (indicadorPendientes) {
        indicadorPendientes.textContent = pendientesHoy;
    }


    // =====================================
    // 5. PUNTOS POR TAREAS DE LA SEMANA
    // =====================================

    let tareasTerminadasSemana = 0;

    for (let i = 0; i < 7; i++) {

        const fecha = new Date(lunesActual);

        fecha.setDate(fecha.getDate() + i);

        if (fecha > fechaActual) {
            break;
        }

        const fechaTexto = claveFecha(fecha);

        const resultado = calcularTareas(fechaTexto);

        tareasTerminadasSemana += resultado.terminadas;
    }


    // =====================================
    // 6. VIDEOS PUBLICADOS
    // =====================================

    const videos = videosDeEstaSemana();

    const indicadorVideos =
        document.getElementById("videos-publicados");

    if (indicadorVideos) {
        indicadorVideos.textContent = videos.length;
    }


    // =====================================
    // 7. SUMAR PUNTOS GENERALES
    // =====================================

    const puntosTareas =
        tareasTerminadasSemana * PUNTOS_TAREA;

    const puntosVideos =
        videos.length * PUNTOS_VIDEO;

    const totalPuntos =
        puntosTareas + puntosVideos;

    const indicadorPuntos =
        document.getElementById("puntos-obtenidos");

    if (indicadorPuntos) {
        indicadorPuntos.textContent = totalPuntos;
    }


    // =====================================
    // 8. ACTUALIZAR METAS POR MARCA
    // =====================================

    Object.entries(METAS).forEach(([marca, meta]) => {

        const cantidad = videos.filter(
            video => video.marca === marca
        ).length;

        const contador = document.getElementById(
            `${marca}-publicados`
        );

        const progreso = document.getElementById(
            `progreso-${marca}`
        );

        if (contador) {
            contador.textContent = cantidad;
        }

        if (progreso) {
            progreso.max = meta;
            progreso.value = Math.min(cantidad, meta);
        }

    });

}


    // ======================================
    // 9. INICIAR PANEL
    // ======================================

    mostrarTareas();
    actualizarIndicadores();
    
// ACTUALIZAR META SEMANAL EN EL RESUMEN

const totalMetasDesdeConfig = Object.values(METAS)
    .reduce((total, meta) => total + meta, 0);

const indicadorMetaSemanal =
    document.getElementById("meta-semanal");

if (indicadorMetaSemanal) {
    indicadorMetaSemanal.textContent =
        totalMetasDesdeConfig;
} else {
    console.warn(
        "No se encontró el indicador meta-semanal."
    );
}


    console.log(
        "Abregu Studios iniciado correctamente."
    );

});
