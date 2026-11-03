
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
    // 2. ALMACENAMIENTO LOCAL
    // ======================================

    function esObjeto(valor) {
        return valor !== null &&
            typeof valor === "object" &&
            !Array.isArray(valor);
    }

    function leerConfiguracion() {

        let datos = {};

        try {
            datos = JSON.parse(
                localStorage.getItem(CLAVE_CONFIG) || "{}"
            );

            if (!esObjeto(datos)) {
                datos = {};
            }

        } catch (error) {
            console.error(
                "Error leyendo configuración:",
                error
            );
        }

        const resultado = {};

        Object.keys(DEFAULTS).forEach(seccion => {
            resultado[seccion] = {
                ...DEFAULTS[seccion],
                ...(esObjeto(datos[seccion])
                    ? datos[seccion]
                    : {})
            };
        });

        return resultado;
    }

    let configuracion = leerConfiguracion();

    function guardarSeccion(seccion, valores) {

        const nueva = {
            ...configuracion,
            [seccion]: valores
        };

        try {
            localStorage.setItem(
                CLAVE_CONFIG,
                JSON.stringify(nueva)
            );

            configuracion = nueva;

            return true;

        } catch (error) {
            console.error(error);

            alert(
                "No se pudo guardar la configuración."
            );

            return false;
        }
    }

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
        evento => {

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

            if (guardarSeccion("general", valores)) {
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
        evento => {

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

            if (guardarSeccion("metas", valores)) {

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
        evento => {

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

            if (guardarSeccion("puntos", valores)) {
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
        evento => {

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

            if (guardarSeccion("horarios", valores)) {
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
    // 12. RESTAURAR INFORMACION
    // ======================================

    const archivoInput = $("archivo-respaldo");
    const botonRestaurar = $("restaurar-respaldo");

    archivoInput.disabled = false;

    archivoInput.addEventListener("change", () => {
        botonRestaurar.disabled =
            !archivoInput.files?.length;
    });

    botonRestaurar.addEventListener(
        "click",
        async () => {

            const archivo = archivoInput.files?.[0];

            if (!archivo) {
                alert(
                    "Selecciona un archivo JSON."
                );
                return;
            }

            if (archivo.size > 8 * 1024 * 1024) {
                alert(
                    "El archivo supera el límite de 8 MB."
                );
                return;
            }

            let respaldo;

            try {
                const contenido = await archivo.text();

                respaldo = JSON.parse(contenido);

                validarRespaldo(respaldo);

            } catch (error) {
                alert(
                    "No se puede restaurar el archivo:\n" +
                    error.message
                );
                return;
            }

            const cantidad = Object.keys(
                respaldo.datos
            ).length;

            const confirmado = confirm(
                "ATENCIÓN: RESTAURAR INFORMACIÓN\n\n" +
                "Este proceso reemplazará los registros " +
                "actuales de Abregu Studios por " +
                "los contenidos en el respaldo.\n\n" +
                `Colecciones del archivo: ${cantidad}\n` +
                `Fecha del respaldo: ${
                    respaldo.fechaExportacion ||
                    "Sin fecha"
                }\n\n` +
                "Antes de continuar, descarga y guarda " +
                "un respaldo de tus datos actuales.\n\n" +
                "¿Confirmas que ya tienes esa copia " +
                "y deseas reemplazar la información?"
            );

            if (!confirmado) return;

            // Guardar temporalmente el estado
            // actual para intentar recuperarlo
            // si ocurre un error.

            const anteriores = {};

            CLAVES.forEach(clave => {
                anteriores[clave] =
                    localStorage.getItem(clave);
            });

            try {

                // Quitar solamente las claves
                // conocidas de la aplicación.

                CLAVES.forEach(clave => {
                    localStorage.removeItem(clave);
                });

                // Restaurar los registros.

                Object.entries(
                    respaldo.datos
                ).forEach(([clave, valor]) => {

                    localStorage.setItem(
                        clave,
                        valor
                    );
                });

                alert(
                    "¡Respaldo restaurado!\n" +
                    "La página se actualizará."
                );

                window.location.reload();

            } catch (error) {

                console.error(
                    "Error restaurando:",
                    error
                );

                // Intentar recuperar los datos
                // anteriores a la restauración.

                try {
                    CLAVES.forEach(clave => {
                        localStorage.removeItem(clave);
                    });

                    Object.entries(
                        anteriores
                    ).forEach(([clave, valor]) => {

                        if (valor !== null) {
                            localStorage.setItem(
                                clave,
                                valor
                            );
                        }
                    });

                    alert(
                        "La restauración falló. " +
                        "Se recuperaron los registros anteriores."
                    );

                } catch (errorRecuperacion) {

                    console.error(
                        "Error de recuperación:",
                        errorRecuperacion
                    );

                    alert(
                        "Ocurrió un problema y no se pudo " +
                        "garantizar la recuperación. " +
                        "Conserva tus archivos de respaldo."
                    );
                }
            }
        }
    );

    // ======================================
    // 13. ACTIVAR FORMULARIOS
    // ======================================

    [
        "guardar-config-general",
        "guardar-config-metas",
        "guardar-config-puntos",
        "guardar-config-horarios",
        "descargar-respaldo"
    ].forEach(id => {
        $(id).disabled = false;
    });

    // ======================================
    // 14. AVISOS DE INTEGRACION
    // ======================================

    avisoFormulario(
        formularios.general,
        "Los datos generales se guardan localmente. " +
        "Los encabezados de los demás módulos " +
        "aún utilizan sus textos originales."
    );

    avisoFormulario(
        formularios.metas,
        "Las metas se guardan correctamente. " +
        "Todavía falta conectar Resumen e Informes " +
        "para que utilicen estos valores."
    );

    avisoFormulario(
        formularios.puntos,
        "Las puntuaciones se guardan aquí. " +
        "Los demás módulos aún utilizan las reglas " +
        "de 10 puntos por video y 3 por tarea."
    );

    avisoFormulario(
        formularios.horarios,
        "Estos horarios son referencias guardadas. " +
        "Todavía no modifican automáticamente " +
        "el cálculo de Asistencia ni los bloques de Tareas."
    );

    // ======================================
    // 15. INICIAR CONFIGURACION
    // ======================================

    cargarCampos();

    $("estado-almacenamiento").textContent =
        "Local";

    $("estado-base-datos").textContent =
        "No";

    $("estado-usuarios").textContent =
        "1";

    console.log(
        "Configuración de Abregu Studios activada."
    );

});

