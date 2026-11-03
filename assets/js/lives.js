
/* =========================================================
   ABREGU STUDIOS - LIVE CONTROL
   Programación semanal y checklist por transmisión.
   Compatible con aa_lives e Informes y puntos.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    const $ = id => document.getElementById(id);

    const CLAVE = "aa_lives";

    const CLIENTES = {
        abregu: "ABREGU PRINT",
        fuze: "FUZE",
        "juan-infante": "JUAN INFANTE",
        intepa: "INTEPA"
    };

    const ESTADOS = {
        pendiente: "Por confirmar",
        programado: "Programado",
        preparacion: "En preparación",
        listo: "Listo para transmitir",
        finalizado: "Finalizado",
        cancelado: "Cancelado"
    };

    const CHECKLIST = [
        "Limpiar el estudio",
        "Ordenar mobiliario y escenario",
        "Preparar decoración del cliente",
        "Modificar iluminación",
        "Verificar encuadres",
        "Verificar cámaras y baterías",
        "Revisar conexiones HDMI",
        "Configurar micrófonos",
        "Comprobar Rodecaster Pro II",
        "Revisar audio sin eco",
        "Preparar escenas de OBS",
        "Verificar formato vertical",
        "Verificar formato horizontal",
        "Cargar overlays del cliente",
        "Realizar pruebas de transmisión",
        "Confirmar tema y escaleta",
        "Confirmar participantes",
        "Revisar contenido publicitario",
        "Guardar respaldo del LIVE",
        "Registrar incidencias y clips"
    ];

    const PREPARACION = 18;

    const formulario = $("form-live");
    const lista = $("lista-lives");
    const botonGuardar = $("guardar-live");

    if (!formulario || !lista || !botonGuardar) {
        console.error(
            "LIVE Control: faltan elementos HTML."
        );
        return;
    }

    // =====================================
    // 1. ALMACENAMIENTO
    // =====================================

    function leerLives() {
        try {
            const datos = JSON.parse(
                localStorage.getItem(CLAVE) || "[]"
            );

            return Array.isArray(datos) ? datos : [];

        } catch (error) {
            console.error(
                "Error leyendo LIVE:",
                error
            );
            return [];
        }
    }

    let lives = leerLives();
    let editando = null;
    let centralSeleccionado = "";

    function guardar(copiaAnterior) {
        try {
            localStorage.setItem(
                CLAVE,
                JSON.stringify(lives)
            );

            return true;

        } catch (error) {
            console.error(
                "Error guardando LIVE:",
                error
            );

            if (copiaAnterior) {
                lives = copiaAnterior;
            }

            alert(
                "No se pudieron guardar los cambios."
            );

            return false;
        }
    }

    // =====================================
    // 2. FECHAS
    // =====================================

    function iso(fecha) {
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

    function fechaLocal() {
        return iso(new Date());
    }

    function convertirFecha(valor) {
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(valor || "")
        ) {
            return null;
        }

        const [a, m, d] = valor
            .split("-")
            .map(Number);

        const fecha = new Date(
            a,
            m - 1,
            d,
            12
        );

        return iso(fecha) === valor
            ? fecha
            : null;
    }

    function lunesDe(fecha) {
        const lunes = new Date(
            fecha.getFullYear(),
            fecha.getMonth(),
            fecha.getDate(),
            12
        );

        lunes.setDate(
            lunes.getDate() -
            (lunes.getDay() + 6) % 7
        );

        return lunes;
    }

    function estaSemana(fecha) {
        const dia = convertirFecha(fecha);

        const lunes = lunesDe(new Date());

        const fin = new Date(lunes);

        fin.setDate(
            fin.getDate() + 7
        );

        return Boolean(
            dia &&
            dia >= lunes &&
            dia < fin
        );
    }

    function proximos14(fecha) {
        const dia = convertirFecha(fecha);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        const fin = new Date(hoy);
        fin.setDate(fin.getDate() + 14);

        return Boolean(
            dia &&
            dia >= hoy &&
            dia < fin
        );
    }

    // =====================================
    // 3. CHECKLIST
    // =====================================

    function marcados(live) {
        const datos = Array.isArray(
            live?.checklist
        )
            ? live.checklist
            : [];

        return [
            ...new Set(
                datos.filter(numero =>
                    Number.isInteger(numero) &&
                    numero >= 0 &&
                    numero < CHECKLIST.length
                )
            )
        ];
    }

    // =====================================
    // 4. INDICADORES
    // =====================================

    function actualizarIndicadores() {

        const programados = lives.filter(live =>
            estaSemana(live.fecha) &&
            [
                "programado",
                "preparacion",
                "listo"
            ].includes(live.estado) &&
            Boolean(live.hora)
        ).length;

        const realizados = lives.filter(live =>
            estaSemana(live.fecha) &&
            live.estado === "finalizado"
        ).length;

        const pendientes = lives.filter(live =>
            estaSemana(live.fecha) &&
            [
                "programado",
                "preparacion",
                "listo"
            ].includes(live.estado) &&
            marcados(live).filter(
                numero => numero < PREPARACION
            ).length < PREPARACION
        ).length;

        const sinTema = lives.filter(live =>
            proximos14(live.fecha) &&
            ![
                "finalizado",
                "cancelado"
            ].includes(live.estado) &&
            !String(live.tema || "").trim()
        ).length;

        const valores = {
            "lives-programados": programados,
            "lives-realizados": realizados,
            "lives-pendientes": pendientes,
            "temas-pendientes": sinTema
        };

        Object.entries(valores).forEach(
            ([id, valor]) => {
                if ($(id)) {
                    $(id).textContent = String(valor);
                }
            }
        );
    }

    // =====================================
    // 5. UTILIDADES
    // =====================================

    function generarId() {
        return (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        )
            ? crypto.randomUUID()
            : (
                `${Date.now()}-` +
                Math.random().toString(36).slice(2)
            );
    }

    function minutos(hora) {
        if (
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(
                hora || ""
            )
        ) {
            return null;
        }

        const [h, m] = hora
            .split(":")
            .map(Number);

        return h * 60 + m;
    }

    function hayCruce(nuevo) {
        const inicio = minutos(nuevo.hora);

        if (
            inicio === null ||
            !nuevo.duracion
        ) {
            return false;
        }

        return lives.some(live => {
            const otro = minutos(live.hora);

            if (
                live.id === nuevo.id ||
                live.fecha !== nuevo.fecha ||
                live.estado === "cancelado" ||
                otro === null ||
                !live.duracion
            ) {
                return false;
            }

            return (
                inicio <
                    otro + Number(live.duracion) &&
                otro <
                    inicio + Number(nuevo.duracion)
            );
        });
    }

    function crearTexto(etiqueta, valor) {
        const p = document.createElement("p");

        p.textContent =
            `${etiqueta}: ${valor || "Por definir"}`;

        return p;
    }

    function boton(texto, accion) {
        const b = document.createElement("button");

        b.type = "button";
        b.textContent = texto;

        b.addEventListener(
            "click",
            accion
        );

        return b;
    }

    // =====================================
    // 6. GUARDAR CUALQUIER VERIFICACIÓN
    // =====================================

    function cambiarCheck(id, indice, activo) {

        const posicion = lives.findIndex(
            live => live.id === id
        );

        if (
            posicion < 0 ||
            indice < 0 ||
            indice >= CHECKLIST.length
        ) {
            return false;
        }

        const anterior = [...lives];

        const live = {
            ...lives[posicion]
        };

        const seleccion = new Set(
            marcados(live)
        );

        if (activo) {
            seleccion.add(indice);
        } else {
            seleccion.delete(indice);
        }

        live.checklist = [
            ...seleccion
        ].sort((a, b) => a - b);

        // CHECKLIST COMPLETO:
        // EL LIVE SE CONSIDERA REALIZADO

        if (
            live.checklist.length ===
                CHECKLIST.length &&
            live.estado !== "cancelado"
        ) {
            live.estado = "finalizado";
            live.finalizadoPorChecklist = true;

        } else if (
            live.finalizadoPorChecklist &&
            live.estado === "finalizado"
        ) {
            // Si se desmarca una verificación
            // de un LIVE finalizado automáticamente,
            // vuelve a preparación.

            live.estado = "preparacion";
            live.finalizadoPorChecklist = false;
        }

        lives[posicion] = live;

        if (!guardar(anterior)) {
            return false;
        }

        sincronizarVistas();

        return true;
    }

    // =====================================
    // 7. REGISTRAR / EDITAR
    // =====================================

    formulario.addEventListener(
        "submit",
        evento => {

            evento.preventDefault();

            if (!formulario.reportValidity()) {
                return;
            }

            const anterior = lives.find(
                live => live.id === editando
            );

            const estado = $("estado-live").value;

            const live = {

                ...(anterior || {}),

                id: anterior?.id || generarId(),

                nombre:
                    $("nombre-live").value.trim(),

                cliente:
                    $("cliente-live").value,

                fecha:
                    $("fecha-live").value,

                hora:
                    $("hora-live").value,

                duracion:
                    Number(
                        $("duracion-live").value
                    ) || 0,

                estado,

                tema:
                    $("tema-live").value.trim(),

                escaleta:
                    $("escaleta-live").value.trim(),

                participantes:
                    $("participantes-live")
                        .value.trim(),

                recursos:
                    $("recursos-live").value.trim(),

                checklist:
                    anterior
                        ? marcados(anterior)
                        : [],

                fechaCreacion:
                    anterior?.fechaCreacion ||
                    fechaLocal(),

                finalizadoPorChecklist:
                    estado === "finalizado" &&
                    Boolean(
                        anterior?.finalizadoPorChecklist
                    ) &&
                    marcados(anterior).length ===
                        CHECKLIST.length
            };

            if (
                [
                    "programado",
                    "listo"
                ].includes(estado) &&
                !live.hora
            ) {
                alert(
                    "Indica una hora para confirmar esta transmisión."
                );

                return;
            }

            if (
                hayCruce(live) &&
                !confirm(
                    "Hay otra transmisión en ese horario. ¿Guardar igualmente?"
                )
            ) {
                return;
            }

            const copia = [...lives];

            lives = anterior

                ? lives.map(item =>
                    item.id === live.id
                        ? live
                        : item
                )

                : [...lives, live];

            if (!guardar(copia)) {
                return;
            }

            editando = null;
            formulario.reset();

            botonGuardar.textContent =
                "Guardar transmisión";

            centralSeleccionado = live.id;

            mostrarLives();
            sincronizarVistas();

            alert(
                "Transmisión guardada correctamente."
            );
        }
    );

    formulario.addEventListener(
        "reset",
        () => {
            editando = null;

            botonGuardar.textContent =
                "Guardar transmisión";
        }
    );

    function editarLive(id) {
        const live = lives.find(
            item => item.id === id
        );

        if (!live) return;

        editando = id;

        const campos = {
            "nombre-live": live.nombre,
            "cliente-live": live.cliente,
            "fecha-live": live.fecha,
            "hora-live": live.hora,
            "duracion-live": live.duracion,
            "estado-live": live.estado,
            "tema-live": live.tema,
            "escaleta-live": live.escaleta,
            "participantes-live": live.participantes,
            "recursos-live": live.recursos
        };

        Object.entries(campos).forEach(
            ([idCampo, valor]) => {

                if ($(idCampo)) {
                    $(idCampo).value = valor ?? "";
                }
            }
        );

        botonGuardar.textContent =
            "Guardar cambios";

        $("nueva-transmision")?.scrollIntoView({
            behavior: "smooth"
        });
    }

    function eliminarLive(id) {

        if (
            !confirm(
                "¿Seguro que deseas eliminar esta transmisión?"
            )
        ) {
            return;
        }

        const copia = [...lives];

        lives = lives.filter(
            live => live.id !== id
        );

        if (!guardar(copia)) return;

        if (editando === id) {
            formulario.reset();
        }

        if (centralSeleccionado === id) {
            centralSeleccionado = "";
        }

        mostrarLives();
        sincronizarVistas();
    }

    // =====================================
    // 8. CHECKLIST DE CADA TARJETA
    // =====================================

    function crearChecklist(live) {

        const detalle =
            document.createElement("details");

        const resumen =
            document.createElement("summary");

        resumen.style.cssText =
            "cursor:pointer;padding:12px 0;font-weight:700";

        detalle.appendChild(resumen);

        CHECKLIST.forEach((texto, indice) => {

            const etiqueta =
                document.createElement("label");

            etiqueta.style.cssText =
                "display:flex;gap:9px;margin:10px 0;cursor:pointer";

            const input =
                document.createElement("input");

            input.type = "checkbox";

            input.dataset.checkIndex =
                String(indice);

            input.addEventListener(
                "change",
                () => {

                    if (
                        !cambiarCheck(
                            live.id,
                            indice,
                            input.checked
                        )
                    ) {
                        input.checked = !input.checked;
                    }
                }
            );

            etiqueta.append(
                input,
                document.createTextNode(texto)
            );

            detalle.appendChild(etiqueta);
        });

        return detalle;
    }

    // =====================================
    // 9. LISTA DE TRANSMISIONES
    // =====================================

    function mostrarLives() {

        lista.replaceChildren();

        if (!lives.length) {

            const bloque =
                document.createElement("div");

            bloque.className = "empty-state";

            bloque.appendChild(
                crearTexto(
                    "",
                    "No hay transmisiones registradas"
                )
            );

            lista.appendChild(bloque);
            return;
        }

        const ordenados = [...lives].sort(
            (a, b) =>
                `${a.fecha} ${a.hora || ""}`
                    .localeCompare(
                        `${b.fecha} ${b.hora || ""}`
                    )
        );

        ordenados.forEach(live => {

            const tarjeta =
                document.createElement("article");

            tarjeta.className = "production-card";

            tarjeta.dataset.liveId = live.id;

            const titulo =
                document.createElement("h3");

            titulo.textContent = live.nombre;

            const estado = crearTexto(
                "Estado",
                ESTADOS[live.estado] || live.estado
            );

            estado.className = "as-estado-lista";

            tarjeta.append(

                titulo,

                crearTexto(
                    "Cliente",
                    CLIENTES[live.cliente] ||
                    live.cliente
                ),

                crearTexto(
                    "Fecha",
                    live.fecha
                ),

                crearTexto(
                    "Hora",
                    live.hora
                ),

                crearTexto(
                    "Duración",
                    live.duracion
                        ? `${live.duracion} minutos`
                        : "Por definir"
                ),

                estado,

                crearTexto(
                    "Tema",
                    live.tema
                ),

                crearTexto(
                    "Participantes",
                    live.participantes
                ),

                crearChecklist(live)
            );

            const acciones =
                document.createElement("div");

            acciones.className = "form-actions";

            acciones.append(

                boton(
                    "Editar",
                    () => editarLive(live.id)
                ),

                boton(
                    "Descargar informe",
                    () => descargarInforme(live.id)
                ),

                boton(
                    "Eliminar",
                    () => eliminarLive(live.id)
                )
            );

            tarjeta.appendChild(acciones);
            lista.appendChild(tarjeta);
        });
    }

    // =====================================
    // 10. DESCARGAR INFORME
    // =====================================

    function descargarInforme(id) {

        const live = lives.find(
            item => item.id === id
        );

        if (!live) return;

        const completadas = marcados(live);

        const contenido = [

            "ABREGU STUDIOS - INFORME DE TRANSMISION",
            "Responsable: SAMGIUK INGA",

            `Programa: ${live.nombre}`,

            `Cliente: ${
                CLIENTES[live.cliente] ||
                live.cliente
            }`,

            `Fecha: ${live.fecha}`,

            `Hora: ${live.hora || "Por definir"}`,

            `Duracion: ${
                live.duracion || "Por definir"
            } minutos`,

            `Estado: ${
                ESTADOS[live.estado] ||
                live.estado
            }`,

            "",
            "TEMA:",
            live.tema || "No especificado",

            "",
            "ESCALETA:",
            live.escaleta || "No especificada",

            "",
            "PARTICIPANTES:",
            live.participantes || "No especificados",

            "",
            "RECURSOS:",
            live.recursos || "No especificados",

            "",
            "CHECKLIST:",

            ...CHECKLIST.map(
                (tarea, indice) =>
                    `${
                        completadas.includes(indice)
                            ? "[X]"
                            : "[ ]"
                    } ${tarea}`
            )

        ].join("\n");

        const archivo = new Blob(
            [contenido],
            {
                type: "text/plain;charset=utf-8"
            }
        );

        const url = URL.createObjectURL(archivo);

        const enlace =
            document.createElement("a");

        enlace.href = url;

        enlace.download =
            `informe-live-${live.fecha}-` +
            `${String(live.id).slice(0, 8)}.txt`;

        document.body.appendChild(enlace);

        enlace.click();
        enlace.remove();

        setTimeout(
            () => URL.revokeObjectURL(url),
            1000
        );
    }

    // =====================================
    // 11. CHECKLIST CENTRAL
    // =====================================

    const seccionCentral = [
        ...document.querySelectorAll(
            "section.dashboard-section"
        )
    ].find(seccion =>
        seccion.querySelector(
            ":scope > .section-header h2"
        )?.textContent.trim() ===
        "Checklist técnico"
    );

    let selectorCentral = null;

    let casillasCentrales = [];

    let progresoCentral = null;

    if (seccionCentral) {

        let listas = [
            ...seccionCentral.querySelectorAll(
                ".task-list"
            )
        ];

        if (!listas.length) {

            const ul =
                document.createElement("ul");

            ul.className = "task-list";

            seccionCentral.appendChild(ul);

            listas = [ul];
        }

        const filas = listas.flatMap(
            ul => [
                ...ul.querySelectorAll("li")
            ]
        );

        while (filas.length < CHECKLIST.length) {

            const li =
                document.createElement("li");

            listas[listas.length - 1]
                .appendChild(li);

            filas.push(li);
        }

        filas.slice(
            CHECKLIST.length
        ).forEach(li => li.remove());

        const panel =
            document.createElement("div");

        panel.className = "production-filters";

        const label =
            document.createElement("label");

        label.textContent =
            "Checklist de la transmisión:";

        label.htmlFor =
            "seleccionar-live-checklist";

        selectorCentral =
            document.createElement("select");

        selectorCentral.id =
            "seleccionar-live-checklist";

        progresoCentral =
            document.createElement("strong");

        panel.append(
            label,
            selectorCentral,
            progresoCentral
        );

        seccionCentral.insertBefore(
            panel,
            seccionCentral.querySelector(
                ".dashboard-columns"
            ) || listas[0]
        );

        CHECKLIST.forEach((tarea, indice) => {

            const li = filas[indice];

            li.replaceChildren();

            const etiqueta =
                document.createElement("label");

            etiqueta.style.cssText =
                "display:flex;align-items:center;gap:10px;cursor:pointer";

            const input =
                document.createElement("input");

            input.type = "checkbox";

            input.style.accentColor = "#e51c38";

            input.addEventListener(
                "change",
                () => {

                    if (
                        !centralSeleccionado ||
                        !cambiarCheck(
                            centralSeleccionado,
                            indice,
                            input.checked
                        )
                    ) {
                        input.checked = !input.checked;
                    }
                }
            );

            etiqueta.append(
                input,
                document.createTextNode(tarea)
            );

            li.appendChild(etiqueta);

            casillasCentrales.push(input);
        });

        selectorCentral.addEventListener(
            "change",
            () => {

                centralSeleccionado =
                    selectorCentral.value;

                sincronizarChecklistCentral();
            }
        );
    }

    function refrescarSelectorCentral() {

        if (!selectorCentral) return;

        if (
            !lives.some(
                live => live.id === centralSeleccionado
            )
        ) {
            centralSeleccionado =
                lives[0]?.id || "";
        }

        selectorCentral.replaceChildren();

        if (!lives.length) {

            selectorCentral.add(
                new Option(
                    "Primero registra un LIVE",
                    ""
                )
            );

        } else {

            lives.forEach(live => {

                selectorCentral.add(
                    new Option(
                        `${live.nombre} - ${live.fecha}`,
                        live.id
                    )
                );
            });
        }

        selectorCentral.value =
            centralSeleccionado;

        selectorCentral.disabled =
            !lives.length;
    }

    function sincronizarChecklistCentral() {

        const live = lives.find(
            item => item.id === centralSeleccionado
        );

        const seleccion = marcados(live);

        casillasCentrales.forEach(
            (input, indice) => {

                input.disabled = !live;

                input.checked =
                    seleccion.includes(indice);
            }
        );

        if (progresoCentral) {

            progresoCentral.textContent = live

                ? (
                    `${seleccion.length}/` +
                    `${CHECKLIST.length} completadas`
                )

                : "Sin LIVE seleccionado";
        }
    }

    // =====================================
    // 12. PROGRAMACIÓN SEMANAL
    // =====================================

    const PROGRAMAS = [

        {
            id: "jovenes",
            dia: 0,
            nombre: "Programa Jóvenes",
            cliente: "juan-infante",
            hora: "18:00",
            horario: "6:00 P. M."
        },

        {
            id: "juju",
            dia: 0,
            nombre: "JUJU",
            cliente: "abregu",
            hora: "19:00",
            horario: "7:00 P. M."
        },

        {
            id: "mujeres",
            dia: 1,
            nombre: "Mujeres Emprendedoras",
            cliente: "juan-infante",
            hora: "",
            horario: "Hora por confirmar"
        },

        {
            id: "fuze-mar",
            dia: 1,
            nombre: "LIVE FUZE",
            cliente: "fuze",
            hora: "",
            horario: "Hora por programar"
        },

        {
            id: "fuze-mie",
            dia: 2,
            nombre: "LIVE FUZE",
            cliente: "fuze",
            hora: "",
            horario: "Hora por programar"
        },

        {
            id: "fuze-jue",
            dia: 3,
            nombre: "LIVE FUZE",
            cliente: "fuze",
            hora: "",
            horario: "Opcional"
        },

        {
            id: "fuze-vie",
            dia: 4,
            nombre: "LIVE FUZE",
            cliente: "fuze",
            hora: "",
            horario: "Antes de INTEPA"
        },

        {
            id: "intepa",
            dia: 4,
            nombre: "LIVE INTEPA",
            cliente: "intepa",
            hora: "",
            horario: "Hora por confirmar"
        },

        {
            id: "fuze-sab",
            dia: 5,
            nombre: "LIVE FUZE",
            cliente: "fuze",
            hora: "",
            horario: "Hora por programar"
        }
    ];

    const DIAS = [
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado"
    ];

    const seccionSemana = [
        ...document.querySelectorAll(
            "section.dashboard-section"
        )
    ].find(seccion =>
        seccion.querySelector(
            ":scope > .section-header h2"
        )?.textContent.trim() ===
        "Programación semanal"
    );

    let semanaVisible = lunesDe(new Date());

    let panelSemana = null;
    let contadorSemana = null;
    let etiquetaPeriodo = null;

    function fechaEnSemana(dia) {

        const fecha = new Date(semanaVisible);

        fecha.setDate(
            fecha.getDate() + dia
        );

        return iso(fecha);
    }

    function normalizar(nombre) {

        return String(nombre || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    // =====================================
    // 13. BUSCAR PROGRAMA EXISTENTE
    // =====================================

    function buscarPrograma(programa, fecha) {

        const id =
            `semanal-${fecha}-${programa.id}`;

        const automatico = lives.find(live =>

            live.id === id ||

            (
                live.origen ===
                    "programacion-semanal" &&

                live.programaSemanal ===
                    programa.id &&

                live.fecha === fecha
            )
        );

        if (automatico) {
            return automatico;
        }

        return lives.find(live =>

            live.fecha === fecha &&

            live.cliente === programa.cliente &&

            normalizar(live.nombre) ===
                normalizar(programa.nombre)
        );
    }

    function crearPrograma(programa, fecha) {

        return {

            id:
                `semanal-${fecha}-${programa.id}`,

            nombre: programa.nombre,

            cliente: programa.cliente,

            fecha,

            hora: programa.hora,

            duracion:
                programa.id === "intepa"
                    ? 120
                    : 0,

            estado: "preparacion",

            tema: "",
            escaleta: "",
            participantes: "",
            recursos: "",

            checklist: [],

            origen: "programacion-semanal",

            programaSemanal: programa.id,

            finalizadoPorChecklist: false,

            fechaCreacion: fechaLocal()
        };
    }

    // =====================================
    // 14. ACTUALIZAR PROGRAMACIÓN
    // =====================================

    function sincronizarSemana() {

        if (!panelSemana) return;

        let realizados = 0;

        PROGRAMAS.forEach(programa => {

            const fecha = fechaEnSemana(
                programa.dia
            );

            const live = buscarPrograma(
                programa,
                fecha
            );

            if (
                live?.estado === "finalizado"
            ) {
                realizados++;
            }
        });

        contadorSemana.textContent =
            `LIVE realizados en esta semana: ${realizados}`;

        const tarjetas = [
            ...panelSemana.querySelectorAll(
                ".as-programa"
            )
        ];

        tarjetas.forEach(tarjeta => {

            const programa = PROGRAMAS.find(
                item =>
                    item.id ===
                    tarjeta.dataset.programaId
            );

            if (!programa) return;

            const live = buscarPrograma(
                programa,
                tarjeta.dataset.fecha
            );

            const verificadas =
                marcados(live);

            const terminado =
                live?.estado === "finalizado";

            tarjeta.classList.toggle(
                "as-realizado",
                terminado
            );

            const estado =
                tarjeta.querySelector(".as-estado");

            estado.textContent = terminado

                ? "✓ LIVE REALIZADO Y GUARDADO"

                : live?.estado === "cancelado"

                    ? "LIVE CANCELADO"

                    : "Pendiente";

            const progreso =
                tarjeta.querySelector(
                    ".as-progreso"
                );

            progreso.textContent =
                `Checklist técnico: ` +
                `${verificadas.length}/` +
                `${CHECKLIST.length}`;

            tarjeta.querySelector(
                "progress"
            ).value = verificadas.length;

            tarjeta.querySelectorAll(
                "input[data-check-index]"
            ).forEach(input => {

                input.checked =
                    verificadas.includes(
                        Number(input.dataset.checkIndex)
                    );

                input.disabled =
                    live?.estado === "cancelado";
            });
        });
    }

    // =====================================
    // 15. CREAR TARJETA SEMANAL
    // =====================================

    function crearTarjetaPrograma(programa) {

        const fecha = fechaEnSemana(
            programa.dia
        );

        const tarjeta =
            document.createElement("article");

        tarjeta.className = "as-programa";

        tarjeta.dataset.programaId =
            programa.id;

        tarjeta.dataset.fecha = fecha;

        const horario =
            document.createElement("small");

        horario.textContent =
            programa.horario;

        const titulo =
            document.createElement("h4");

        titulo.textContent =
            programa.nombre;

        const estado =
            document.createElement("p");

        estado.className = "as-estado";

        const progreso =
            document.createElement("progress");

        progreso.max = CHECKLIST.length;

        const detalle =
            document.createElement("details");

        const resumen =
            document.createElement("summary");

        resumen.className = "as-progreso";

        detalle.appendChild(resumen);

        CHECKLIST.forEach((tarea, indice) => {

            const etiqueta =
                document.createElement("label");

            etiqueta.className = "as-check";

            const input =
                document.createElement("input");

            input.type = "checkbox";

            input.dataset.checkIndex =
                String(indice);

            input.addEventListener(
                "change",
                () => {

                    let live = buscarPrograma(
                        programa,
                        fecha
                    );

                    // Crear registro solamente
                    // cuando se marca una tarea.

                    if (!live) {

                        const nuevo = crearPrograma(
                            programa,
                            fecha
                        );

                        const copia = [...lives];

                        lives = [
                            ...lives,
                            nuevo
                        ];

                        if (!guardar(copia)) {
                            input.checked = false;
                            return;
                        }

                        live = nuevo;

                        centralSeleccionado =
                            live.id;

                        mostrarLives();
                    }

                    const correcto = cambiarCheck(
                        live.id,
                        indice,
                        input.checked
                    );

                    if (!correcto) {
                        input.checked = !input.checked;
                    }
                }
            );

            const texto =
                document.createElement("span");

            texto.textContent = tarea;

            etiqueta.append(
                input,
                texto
            );

            detalle.appendChild(etiqueta);
        });

        const fechaTexto =
            document.createElement("p");

        fechaTexto.textContent =
            `Fecha: ${fecha}`;

        tarjeta.append(
            horario,
            titulo,
            fechaTexto,
            estado,
            progreso,
            detalle
        );

        return tarjeta;
    }

    // =====================================
    // 16. DIBUJAR SEMANA
    // =====================================

    function dibujarSemana() {

        if (!panelSemana) return;

        panelSemana.replaceChildren();

        const hasta = new Date(
            semanaVisible
        );

        hasta.setDate(
            hasta.getDate() + 6
        );

        etiquetaPeriodo.textContent =
            `${iso(semanaVisible)} al ${iso(hasta)}`;

        DIAS.forEach((dia, indice) => {

            const caja =
                document.createElement("div");

            caja.className = "as-dia";

            const titulo =
                document.createElement("h3");

            titulo.textContent =
                `${dia} — ${fechaEnSemana(indice)}`;

            caja.appendChild(titulo);

            PROGRAMAS.filter(
                programa =>
                    programa.dia === indice
            ).forEach(programa => {

                caja.appendChild(
                    crearTarjetaPrograma(programa)
                );
            });

            panelSemana.appendChild(caja);
        });

        sincronizarSemana();
    }

    // =====================================
    // 17. ACTIVAR PROGRAMACIÓN SEMANAL
    // =====================================

    if (seccionSemana) {

        const encabezado =
            seccionSemana.querySelector(
                ":scope > .section-header"
            );

        // Retiramos las tarjetas estáticas.
        // No borramos ninguna transmisión guardada.

        [
            ...seccionSemana.children
        ].forEach(elemento => {

            if (elemento !== encabezado) {
                elemento.remove();
            }
        });

        const controles =
            document.createElement("div");

        controles.className = "as-controles";

        const antes = boton(
            "← Semana anterior",
            () => {

                semanaVisible.setDate(
                    semanaVisible.getDate() - 7
                );

                dibujarSemana();
            }
        );

        const despues = boton(
            "Semana siguiente →",
            () => {

                semanaVisible.setDate(
                    semanaVisible.getDate() + 7
                );

                dibujarSemana();
            }
        );

        etiquetaPeriodo =
            document.createElement("strong");

        contadorSemana =
            document.createElement("p");

        panelSemana =
            document.createElement("div");

        panelSemana.className = "as-semana";

        controles.append(
            antes,
            etiquetaPeriodo,
            despues
        );

        seccionSemana.append(
            controles,
            contadorSemana,
            panelSemana
        );

        // ESTILOS

        const estilos =
            document.createElement("style");

        estilos.textContent = `

            .as-controles {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
                margin: 16px 0;
            }

            .as-controles button {
                background: #292327;
                border: 1px solid #60434a;
                border-radius: 8px;
                color: #fff;
                padding: 9px 13px;
                cursor: pointer;
            }

            .as-semana {
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap: 16px;
            }

            .as-dia {
                padding: 18px;
                border-radius: 12px;
                border: 1px solid #40383d;
                background: #1a171a;
                min-width: 0;
            }

            .as-dia h3 {
                margin: 0 0 10px;
            }

            .as-programa {
                background: #1e1b20;
                padding: 14px;
                border-radius: 9px;
                border: 1px solid #4a3a41;
                border-left: 3px solid #e53d54;
                margin-top: 10px;
            }

            .as-programa.as-realizado {
                border-left-color: #41bd83;
            }

            .as-programa h4 {
                margin: 8px 0;
            }

            .as-programa small {
                color: #ff697b;
                font-weight: 700;
            }

            .as-estado {
                font-size: 13px;
                color: #f3ddd8;
            }

            .as-programa.as-realizado .as-estado {
                color: #72d7a5;
            }

            .as-programa progress {
                width: 100%;
                accent-color: #e53d54;
                margin: 8px 0;
            }

            .as-programa summary {
                cursor: pointer;
                font-weight: bold;
                padding: 8px 0;
            }

            .as-check {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                margin: 9px 0;
                font-size: 13px;
                cursor: pointer;
            }

            .as-check input {
                accent-color: #e53d54;
                margin-top: 3px;
            }

            @media (max-width: 800px) {
                .as-semana {
                    grid-template-columns: 1fr;
                }
            }
        `;

        document.head.appendChild(estilos);

        dibujarSemana();
    }

    // =====================================
    // 18. SINCRONIZAR TARJETAS
    // =====================================

    function sincronizarListado() {

        lista.querySelectorAll(
            "[data-live-id]"
        ).forEach(tarjeta => {

            const live = lives.find(
                item =>
                    item.id === tarjeta.dataset.liveId
            );

            if (!live) return;

            const estado = tarjeta.querySelector(
                ".as-estado-lista"
            );

            if (estado) {
                estado.textContent =
                    `Estado: ` +
                    `${
                        ESTADOS[live.estado] ||
                        live.estado
                    }`;
            }

            const resumen = tarjeta.querySelector(
                "details summary"
            );

            if (resumen) {
                resumen.textContent =
                    `Checklist técnico: ` +
                    `${marcados(live).length}/` +
                    `${CHECKLIST.length}`;
            }

            tarjeta.querySelectorAll(
                "input[data-check-index]"
            ).forEach(input => {

                input.checked =
                    marcados(live).includes(
                        Number(
                            input.dataset.checkIndex
                        )
                    );
            });
        });
    }

    // =====================================
    // 19. SINCRONIZAR TODO
    // =====================================

    function sincronizarVistas() {

        actualizarIndicadores();

        refrescarSelectorCentral();

        sincronizarChecklistCentral();

        sincronizarListado();

        sincronizarSemana();
    }

    // =====================================
    // 20. INICIAR
    // =====================================

    botonGuardar.disabled = false;

    const ayuda = formulario.querySelector(
        ".helper-text"
    );

    if (ayuda) {
        ayuda.textContent =
            "Las verificaciones se guardan por LIVE " +
            "y por fecha en este navegador.";
    }

    mostrarLives();

    sincronizarVistas();

    console.log(
        "ABREGU STUDIOS - LIVE Control activo."
    );

});
