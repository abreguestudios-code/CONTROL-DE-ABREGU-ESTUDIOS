
/* ==========================================
   ABREGU STUDIOS
   MÓDULO: PRODUCCIÓN AUDIOVISUAL
   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // 1. CONFIGURACIÓN
    // ======================================

    const CLAVE_PRODUCCIONES = "aa_producciones";
    const CLAVE_PUBLICACIONES = "aa_videos_publicados";

    const MARCAS = {
        abregu: "ABREGU PRINT",
        fuze: "FUZE",
        kintex: "KINTEX",
        caedla: "CAEDLA"
    };

    const ESTADOS = {
        idea: "Idea",
        guion: "Guion",
        grabacion: "Grabación",
        edicion: "Edición",
        revision: "Revisión",
        publicado: "Publicado"
    };

    const formulario =
        document.getElementById("form-produccion");

    const lista =
        document.getElementById("lista-producciones");

    const botonGuardar =
        document.getElementById("guardar-produccion");

    const filtroMarca =
        document.getElementById("filtro-marca");

    let idEditando = null;


    // ======================================
    // 2. LEER INFORMACIÓN GUARDADA
    // ======================================

    function leerDatos(clave, respaldo = []) {
        try {
            const datos = JSON.parse(
                localStorage.getItem(clave)
            );

            return Array.isArray(datos)
                ? datos
                : respaldo;

        } catch (error) {
            console.error("Error al leer datos:", error);
            return respaldo;
        }
    }

    let producciones = leerDatos(
        CLAVE_PRODUCCIONES
    );


    // ======================================
    // 3. FECHA LOCAL
    // ======================================

    function fechaLocal(fecha = new Date()) {

        const año = fecha.getFullYear();

        const mes = String(
            fecha.getMonth() + 1
        ).padStart(2, "0");

        const dia = String(
            fecha.getDate()
        ).padStart(2, "0");

        return `${año}-${mes}-${dia}`;
    }

    function inicioSemana() {

        const fecha = new Date();

        const diferencia =
            (fecha.getDay() + 6) % 7;

        fecha.setDate(
            fecha.getDate() - diferencia
        );

        return fechaLocal(fecha);
    }

    function finSemana() {

        const fecha = new Date();

        const diferencia =
            (fecha.getDay() + 6) % 7;

        fecha.setDate(
            fecha.getDate() - diferencia + 7
        );

        return fechaLocal(fecha);
    }

    function esDeEstaSemana(fecha) {

        return Boolean(
            fecha &&
            fecha >= inicioSemana() &&
            fecha < finSemana()
        );
    }


    // ======================================
    // 4. GUARDAR Y SINCRONIZAR
    // ======================================

    function guardarDatos() {

        try {

            localStorage.setItem(
                CLAVE_PRODUCCIONES,
                JSON.stringify(producciones)
            );

            // Conectar publicaciones al Resumen

            const publicacionesAnteriores =
                leerDatos(CLAVE_PUBLICACIONES);

            const publicacionesExternas =
                publicacionesAnteriores.filter(
                    video => video.origen !== "produccion"
                );

            const publicacionesProduccion =
                producciones
                    .filter(video =>
                        video.estado === "publicado" &&
                        video.fechaPublicacion
                    )
                    .map(video => ({
                        id: video.id,
                        marca: video.marca,
                        fecha: video.fechaPublicacion,
                        origen: "produccion"
                    }));

            localStorage.setItem(
                CLAVE_PUBLICACIONES,
                JSON.stringify([
                    ...publicacionesExternas,
                    ...publicacionesProduccion
                ])
            );

            return true;

        } catch (error) {

            console.error(
                "Error al guardar producción:",
                error
            );

            alert(
                "No se pudieron guardar los datos."
            );

            return false;
        }
    }


    // ======================================
    // 5. ACTUALIZAR INDICADORES
    // ======================================

    function actualizarIndicadores() {

        const total = producciones.length;

        const enProduccion = producciones.filter(
            video => [
                "idea",
                "guion",
                "grabacion",
                "edicion"
            ].includes(video.estado)
        ).length;

        const enRevision = producciones.filter(
            video => video.estado === "revision"
        ).length;

        const publicados = producciones.filter(
            video =>
                video.estado === "publicado" &&
                esDeEstaSemana(video.fechaPublicacion)
        ).length;

        const indicadores = {
            "total-proyectos": total,
            "en-produccion": enProduccion,
            "en-revision": enRevision,
            "total-publicados": publicados
        };

        Object.entries(indicadores).forEach(
            ([id, cantidad]) => {

                const elemento =
                    document.getElementById(id);

                if (elemento) {
                    elemento.textContent = cantidad;
                }
            }
        );
    }


    // ======================================
    // 6. GENERAR IDENTIFICADOR
    // ======================================

    function generarId() {

        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString() +
            Math.random().toString(36).slice(2)
        );
    }


    // ======================================
    // 7. REGISTRAR NUEVA PRODUCCIÓN
    // ======================================

    formulario.addEventListener("submit", evento => {

        evento.preventDefault();

        if (!formulario.reportValidity()) {
            return;
        }

        const nombre =
            document.getElementById("nombre-video")
                .value.trim();

        const marca =
            document.getElementById("marca-video")
                .value;

        const tipo =
            document.getElementById("tipo-video")
                .value;

        const locacion =
            document.getElementById("locacion-video")
                .value;

        const objetivo =
            document.getElementById("objetivo-video")
                .value.trim();

        const guion =
            document.getElementById("guion-video")
                .value.trim();

        const fechaGrabacion =
            document.getElementById("fecha-grabacion")
                .value;

        const fechaEntrega =
            document.getElementById("fecha-entrega")
                .value;

        const estado =
            document.getElementById("estado-video")
                .value;

        const anterior = producciones.find(
            video => video.id === idEditando
        );

        const video = {

            id: anterior?.id || generarId(),

            nombre,
            marca,
            tipo,
            locacion,
            objetivo,
            guion,
            fechaGrabacion,
            fechaEntrega,
            estado,

            fechaCreacion:
                anterior?.fechaCreacion || fechaLocal(),

            fechaPublicacion:
                estado === "publicado"
                    ? (
                        anterior?.fechaPublicacion ||
                        fechaLocal()
                    )
                    : null

        };

        const copiaAnterior = [...producciones];

        if (anterior) {

            producciones = producciones.map(
                item => item.id === idEditando
                    ? video
                    : item
            );

        } else {

            producciones.push(video);

        }

        if (!guardarDatos()) {
            producciones = copiaAnterior;
            return;
        }

        idEditando = null;

        formulario.reset();

        botonGuardar.textContent =
            "Guardar producción";

        mostrarProducciones();
        actualizarIndicadores();

        alert(
            "¡Producción guardada correctamente!"
        );

    });


    // ======================================
    // 8. MOSTRAR PRODUCCIONES
    // ======================================

    function crearTexto(etiqueta, contenido) {

        const parrafo = document.createElement("p");

        parrafo.textContent =
            `${etiqueta}: ${contenido || "No especificado"}`;

        return parrafo;
    }

    function mostrarProducciones() {

        lista.replaceChildren();

        const marcaSeleccionada =
            filtroMarca.value;

        const filtrados = producciones.filter(
            video =>
                marcaSeleccionada === "todas" ||
                video.marca === marcaSeleccionada
        );

        if (filtrados.length === 0) {

            const vacio =
                document.createElement("div");

            vacio.className = "empty-state";

            const titulo =
                document.createElement("h3");

            titulo.textContent =
                "No hay producciones registradas";

            const descripcion =
                document.createElement("p");

            descripcion.textContent =
                "Crea una producción para comenzar.";

            vacio.append(titulo, descripcion);

            lista.appendChild(vacio);

            return;
        }

        filtrados.forEach(video => {

            const tarjeta =
                document.createElement("article");

            tarjeta.className = "production-card";

            const titulo =
                document.createElement("h3");

            titulo.textContent = video.nombre;

            tarjeta.appendChild(titulo);

            tarjeta.appendChild(
                crearTexto(
                    "Marca",
                    MARCAS[video.marca]
                )
            );

            tarjeta.appendChild(
                crearTexto(
                    "Etapa",
                    ESTADOS[video.estado]
                )
            );

            tarjeta.appendChild(
                crearTexto(
                    "Grabación",
                    video.fechaGrabacion
                )
            );

            tarjeta.appendChild(
                crearTexto(
                    "Entrega",
                    video.fechaEntrega
                )
            );

            if (video.objetivo) {

                tarjeta.appendChild(
                    crearTexto(
                        "Objetivo",
                        video.objetivo
                    )
                );

            }

            // Botones de acciones

            const acciones =
                document.createElement("div");

            acciones.className = "form-actions";

            const editar =
                document.createElement("button");

            editar.type = "button";
            editar.textContent = "Editar";

            editar.addEventListener(
                "click",
                () => editarProduccion(video.id)
            );

            const eliminar =
                document.createElement("button");

            eliminar.type = "button";
            eliminar.textContent = "Eliminar";

            eliminar.addEventListener(
                "click",
                () => eliminarProduccion(video.id)
            );

            acciones.append(editar, eliminar);

            tarjeta.appendChild(acciones);

            lista.appendChild(tarjeta);

        });
    }


    // ======================================
    // 9. EDITAR PRODUCCIÓN
    // ======================================

    function editarProduccion(id) {

        const video = producciones.find(
            item => item.id === id
        );

        if (!video) return;

        idEditando = id;

        const campos = {

            "nombre-video": video.nombre,
            "marca-video": video.marca,
            "tipo-video": video.tipo,
            "locacion-video": video.locacion,
            "objetivo-video": video.objetivo,
            "guion-video": video.guion,
            "fecha-grabacion": video.fechaGrabacion,
            "fecha-entrega": video.fechaEntrega,
            "estado-video": video.estado

        };

        Object.entries(campos).forEach(
            ([idCampo, valor]) => {

                const campo =
                    document.getElementById(idCampo);

                if (campo) {
                    campo.value = valor || "";
                }

            }
        );

        botonGuardar.textContent =
            "Guardar cambios";

        document.getElementById(
            "nueva-produccion"
        ).scrollIntoView({
            behavior: "smooth"
        });
    }


    // ======================================
    // 10. ELIMINAR PRODUCCIÓN
    // ======================================

    function eliminarProduccion(id) {

        const confirmar = confirm(
            "¿Seguro que deseas eliminar esta producción?"
        );

        if (!confirmar) return;

        const copiaAnterior = [...producciones];

        producciones = producciones.filter(
            video => video.id !== id
        );

        if (!guardarDatos()) {
            producciones = copiaAnterior;
            return;
        }

        if (idEditando === id) {
            formulario.reset();
            idEditando = null;
            botonGuardar.textContent =
                "Guardar producción";
        }

        mostrarProducciones();
        actualizarIndicadores();
    }


    // ======================================
    // 11. FILTROS Y FORMULARIO
    // ======================================

    filtroMarca.addEventListener(
        "change",
        mostrarProducciones
    );

    formulario.addEventListener("reset", () => {

        idEditando = null;

        botonGuardar.textContent =
            "Guardar producción";

    });


    // ======================================
    // 12. ACTIVAR EL SISTEMA
    // ======================================

    botonGuardar.disabled = false;
    filtroMarca.disabled = false;

    const ayuda =
        formulario.querySelector(".helper-text");

    if (ayuda) {

        ayuda.textContent =
            "Las producciones se guardan " +
            "en este navegador automáticamente.";

    }

    mostrarProducciones();
    actualizarIndicadores();

    console.log(
        "Producción Audiovisual activada."
    );

});
