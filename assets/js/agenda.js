
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

    let actividades = leerArray(CLAVE);
    let idEditando = null;

    function guardarDatos() {

        try {
            localStorage.setItem(
                CLAVE,
                JSON.stringify(actividades)
            );

            return true;

        } catch (error) {

            alert(
                "No se pudieron guardar las actividades."
            );

            return false;
        }
    }

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

        const lives = leerArray("aa_lives");

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

        const tareas = leerArray(
            "aa_tareas_personalizadas"
        );

        const completadas = leer(
            "aa_tareas_personales_completadas",
            {}
        );

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

        const producciones = leerArray(
            "aa_producciones"
        );

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

            const jornadas = leer(
                "aa_jornadas",
                {}
            );

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
        eventoFormulario => {

            eventoFormulario.preventDefault();

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

            const anteriores = [...actividades];

            if (idEditando) {

                actividades = actividades.map(
                    item =>
                        item.id === idEditando
                            ? actividad
                            : item
                );

            } else {

                actividades.push(actividad);

            }

            if (!guardarDatos()) {

                actividades = anteriores;
                return;
            }

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

    function eliminarActividad(id) {

        if (!confirm(
            "¿Seguro que deseas eliminar esta actividad?"
        )) {
            return;
        }

        const anteriores = [...actividades];

        actividades = actividades.filter(
            item => item.id !== id
        );

        if (!guardarDatos()) {

            actividades = anteriores;
            return;
        }

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

    botonGuardar.disabled = false;

    $("actividad-fecha").value = fechaActiva;

    const ayuda = formulario.querySelector(
        ".helper-text"
    );

    if (ayuda) {

        ayuda.textContent =
            "Los eventos se guardan en este navegador. " +
            "Las tareas, grabaciones y LIVE aparecen " +
            "desde sus módulos originales.";
    }

    // Sincronizar si cambian datos en otra pestaña.

    window.addEventListener("storage", () => {

        actividades = leerArray(CLAVE);

        actualizarAgenda();
    });

    window.addEventListener(
        "focus",
        actualizarAgenda
    );

    actualizarAgenda();

    console.log(
        "Agenda Semanal de Abregu Studios activada."
    );

});
