
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
    // 2. ALMACENAMIENTO LOCAL
    // ======================================

    function leer(clave, defecto) {
        try {
            const valor = localStorage.getItem(clave);
            return valor ? JSON.parse(valor) : defecto;
        } catch (error) {
            console.error("Error de lectura:", error);
            return defecto;
        }
    }

    let tareas = leer(CLAVE_TAREAS, []);
    let completadas = leer(CLAVE_COMPLETADAS, {});
    let rutinasCompletadas = leer(CLAVE_RUTINAS, {});
    let jornadas = leer(CLAVE_JORNADAS, {});

    if (!Array.isArray(tareas)) tareas = [];
    if (!completadas || typeof completadas !== "object")
        completadas = {};
    if (!rutinasCompletadas ||
        typeof rutinasCompletadas !== "object")
        rutinasCompletadas = {};

    function guardar(clave, datos) {
        try {
            localStorage.setItem(clave, JSON.stringify(datos));
            return true;
        } catch (error) {
            alert("No se pudieron guardar los datos.");
            return false;
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

    function alternarTarea(id, fecha) {
        const anterior = [...(completadas[fecha] || [])];

        completadas[fecha] = estaCompletada(id, fecha)
            ? anterior.filter(valor => valor !== id)
            : [...anterior, id];

        if (!guardar(CLAVE_COMPLETADAS, completadas)) {
            completadas[fecha] = anterior;
        }

        actualizarPantalla();
    }

    function alternarRutina(indice, fecha) {
        const anterior = [
            ...(rutinasCompletadas[fecha] || [])
        ];

        rutinasCompletadas[fecha] = anterior.includes(indice)
            ? anterior.filter(valor => valor !== indice)
            : [...anterior, indice];

        if (!guardar(CLAVE_RUTINAS, rutinasCompletadas)) {
            rutinasCompletadas[fecha] = anterior;
        }

        actualizarPantalla();
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

    selectorJornada.addEventListener("change", () => {
        const fecha = fechaSeleccionada();

        if (selectorJornada.value) {
            jornadas[fecha] = selectorJornada.value;
        } else {
            delete jornadas[fecha];
        }

        guardar(CLAVE_JORNADAS, jornadas);
        mostrarBloques();
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

    formulario.addEventListener("submit", evento => {
        evento.preventDefault();

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

        const anteriores = [...tareas];

        if (idEditando) {
            tareas = tareas.map(item =>
                item.id === idEditando ? tarea : item
            );
        } else {
            tareas.push(tarea);
        }

        if (!guardar(CLAVE_TAREAS, tareas)) {
            tareas = anteriores;
            return;
        }

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

    function eliminarTarea(id) {
        if (!confirm("¿Eliminar esta tarea?")) return;

        tareas = tareas.filter(tarea => tarea.id !== id);

        Object.keys(completadas).forEach(fecha => {
            completadas[fecha] = (
                completadas[fecha] || []
            ).filter(valor => valor !== id);
        });

        guardar(CLAVE_TAREAS, tareas);
        guardar(CLAVE_COMPLETADAS, completadas);

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

    botonGuardar.disabled = false;

    const ayuda = formulario.querySelector(".helper-text");

    if (ayuda) {
        ayuda.textContent =
            "Tus tareas se guardan en este navegador. " +
            "Puedes editarlas o eliminarlas después.";
    }

    actualizarSelectorJornada();
    actualizarPantalla();

    console.log(
        "Abregu Studios: Mis tareas activado."
    );

});
