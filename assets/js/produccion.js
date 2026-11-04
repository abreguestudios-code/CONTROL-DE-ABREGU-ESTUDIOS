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

    if (!formulario || !lista || !botonGuardar || !filtroMarca) {
        console.error("Producción: faltan elementos del HTML.");
        return;
    }

    const panelNube = document.createElement("div");
    panelNube.className = "production-card";
    panelNube.style.marginBottom = "18px";
    panelNube.style.borderLeft = "3px solid #e53d54";

    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    const contadorNube = document.createElement("p");
    const botonesNube = document.createElement("div");
    botonesNube.className = "form-actions";
    const botonActualizar = document.createElement("button");
    botonActualizar.type = "button";
    botonActualizar.textContent = "Actualizar desde Supabase";
    const botonImportar = document.createElement("button");
    botonImportar.type = "button";
    botonImportar.textContent = "Importar producciones locales";
    const botonRespaldo = document.createElement("button");
    botonRespaldo.type = "button";
    botonRespaldo.textContent = "Descargar respaldo local";
    botonesNube.append(botonActualizar, botonImportar, botonRespaldo);
    panelNube.append(estadoNube, contadorNube, botonesNube);
    const seccionListado = lista.closest("section") || lista.parentElement;
    seccionListado.parentElement.insertBefore(panelNube, seccionListado);

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

    // Los registros de Supabase serán la fuente principal.
    // El inventario anterior de este navegador queda protegido
    // en un respaldo para importarlo manualmente.
    const MODULO_NUBE = "produccion";
    const CLAVE_RESPALDO = "aa_producciones_respaldo_migracion";
    const CLAVE_MIGRADA = "aa_producciones_migracion_detectada_v1";

    let producciones = [];
    let estudioId = null;
    let usuarioId = null;
    let db = null;
    let conectado = false;
    let ocupado = false;
    let versiones = new Map();

    if (!localStorage.getItem(CLAVE_MIGRADA)) {
        const antiguas = leerDatos(CLAVE_PRODUCCIONES);
        try {
            if (antiguas.length && !localStorage.getItem(CLAVE_RESPALDO)) {
                localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(antiguas));
            }
            localStorage.setItem(CLAVE_MIGRADA, "1");
        } catch (e) {
            console.error("No se pudo asegurar el respaldo de producciones", e);
            alert("No se pudo crear el respaldo de las producciones locales. No se iniciará la migración.");
            return;
        }
    }

    function pendientesImportar() {
        return leerDatos(CLAVE_RESPALDO).filter(v =>
            v && typeof v === "object" &&
            typeof v.id === "string" && v.id.trim() &&
            !versiones.has(v.id)
        );
    }

    function quitarDelRespaldo(id) {
        const anteriores = leerDatos(CLAVE_RESPALDO);
        const nuevos = anteriores.filter(v => v?.id !== id);
        try {
            localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(nuevos));
        } catch (e) {
            console.warn("No se pudo actualizar el respaldo de migración", e);
        }
    }



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

    // Solo se actualiza el caché tras un cambio confirmado por Supabase.
    function guardarDatosLocales() {
        try {
            localStorage.setItem(CLAVE_PRODUCCIONES, JSON.stringify(producciones));

            // Mantener compatible el Resumen y los informes.
            // Las publicaciones externas no se eliminan.
            const anteriores = leerDatos(CLAVE_PUBLICACIONES);
            const externas = anteriores.filter(v => v.origen !== "produccion");
            const publicadas = producciones
                .filter(v => v.estado === "publicado" && v.fechaPublicacion)
                .map(v => ({
                    id: v.id,
                    marca: v.marca,
                    fecha: v.fechaPublicacion,
                    origen: "produccion"
                }));

            localStorage.setItem(
                CLAVE_PUBLICACIONES,
                JSON.stringify([...externas, ...publicadas])
            );
            return true;
        } catch (e) {
            console.error("Se guardó en Supabase pero falló el caché local", e);
            mostrarEstado("Guardado en Supabase. No pudo actualizarse el caché local; revisa el espacio del navegador.", true);
            return false;
        }
    }

    function mostrarEstado(mensaje, error = false) {
        if (!estadoNube) return;
        estadoNube.textContent = mensaje;
        estadoNube.style.color = error ? "#ff8c98" : "#d8c6c7";
    }

    function bloquear(bloqueo) {
        ocupado = bloqueo;
        botonGuardar.disabled = !conectado || ocupado;
        filtroMarca.disabled = !conectado || ocupado;
        if (botonActualizar) botonActualizar.disabled = !conectado || ocupado;
        if (botonImportar) botonImportar.disabled = !conectado || ocupado || !pendientesImportar().length;
        lista.querySelectorAll("button").forEach(b => b.disabled = !conectado || ocupado);
    }

    // Paginación para que Supabase no recorte los resultados al llegar a 1000.
    async function cargarDesdeSupabase() {
        const recibidos = [];
        const lote = 500;

        for (let inicio = 0; ; inicio += lote) {
            const { data, error } = await db
                .from("registros_modulos")
                .select("registro_clave, contenido, actualizado_en")
                .eq("estudio_id", estudioId)
                .eq("modulo", MODULO_NUBE)
                .order("registro_clave", { ascending: true })
                .range(inicio, inicio + lote - 1);

            if (error) throw error;
            recibidos.push(...(data || []));
            if (!data || data.length < lote) break;
        }

        const nuevoMapa = new Map();
        const nuevasProducciones = [];
        for (const fila of recibidos) {
            if (!fila.contenido || typeof fila.contenido !== "object") continue;
            nuevoMapa.set(fila.registro_clave, fila.actualizado_en);
            nuevasProducciones.push({
                ...fila.contenido,
                id: fila.registro_clave
            });
        }

        // Solo sustituimos la vista después de recibir TODAS las páginas.
        versiones = nuevoMapa;
        producciones = nuevasProducciones;
        guardarDatosLocales();
        mostrarProducciones();
        actualizarIndicadores();
        actualizarPanelNube();
    }

    function actualizarPanelNube() {
        if (botonImportar) botonImportar.disabled = !conectado || ocupado || !pendientesImportar().length;
        if (contadorNube) {
            const cantidad = pendientesImportar().length;
            contadorNube.textContent =
                `${producciones.length} producciones en Supabase · ${cantidad} locales pendientes de importar`;
        }
    }

    async function crearEnSupabase(video) {
        const { data, error } = await db
            .from("registros_modulos")
            .insert({
                estudio_id: estudioId,
                modulo: MODULO_NUBE,
                registro_clave: video.id,
                contenido: video,
                creado_por: usuarioId,
                actualizado_en: new Date().toISOString()
            })
            .select("registro_clave, actualizado_en")
            .single();
        if (error) throw error;
        versiones.set(video.id, data.actualizado_en);
    }

    async function modificarEnSupabase(video) {
        const version = versiones.get(video.id);
        if (!version) throw new Error("Este registro no está cargado desde Supabase. Actualiza la vista antes de editar.");

        const { data, error } = await db
            .from("registros_modulos")
            .update({
                contenido: video,
                actualizado_en: new Date().toISOString()
            })
            .eq("estudio_id", estudioId)
            .eq("modulo", MODULO_NUBE)
            .eq("registro_clave", video.id)
            .eq("actualizado_en", version)
            .select("registro_clave, actualizado_en")
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("La producción cambió en otro navegador o fue eliminada. Actualiza desde Supabase antes de continuar.");
        versiones.set(video.id, data.actualizado_en);
    }

    async function borrarEnSupabase(id) {
        const version = versiones.get(id);
        if (!version) throw new Error("No se encontró la versión de la producción en Supabase.");
        const { data, error } = await db
            .from("registros_modulos")
            .delete()
            .eq("estudio_id", estudioId)
            .eq("modulo", MODULO_NUBE)
            .eq("registro_clave", id)
            .eq("actualizado_en", version)
            .select("registro_clave")
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("El registro fue modificado o eliminado desde otro navegador. Actualiza desde Supabase.");
        versiones.delete(id);
    }

    async function actualizarManual() {
        if (ocupado || !conectado) return;
        bloquear(true);
        mostrarEstado("Actualizando producciones desde Supabase...");
        try {
            await cargarDesdeSupabase();
            mostrarEstado("Producciones actualizadas correctamente desde Supabase.");
        } catch (e) {
            console.error(e);
            mostrarEstado(`No se pudo actualizar: ${e.message}`, true);
        } finally {
            bloquear(false);
            actualizarPanelNube();
        }
    }

    async function importarLocales() {
        if (ocupado || !conectado) return;
        const originales = leerDatos(CLAVE_RESPALDO);
        if (!originales.length) return;
        if (!confirm("¿Importar las producciones locales que todavía no existen en Supabase? No se sobrescribirá ninguna producción existente.")) return;
        bloquear(true);
        let importadas = 0;
        try {
            // Consultar de nuevo para evitar pisar registros recientes.
            await cargarDesdeSupabase();
            const pendientes = pendientesImportar();
            for (const video of pendientes) {
                // INSERT: no sobrescribe registros de otros navegadores.
                await crearEnSupabase(video);
                quitarDelRespaldo(video.id);
                importadas++;
            }
            await cargarDesdeSupabase();
            mostrarEstado(`Importación finalizada: ${importadas} producciones importadas. Sin sobrescribir existentes.`);
        } catch (e) {
            console.error(e);
            mostrarEstado(`Importación parcial (${importadas} guardadas). Error: ${e.message}`, true);
            // Recargar lo que sí pudo guardarse.
            try { await cargarDesdeSupabase(); } catch (otro) { console.error(otro); }
        } finally {
            bloquear(false);
            actualizarPanelNube();
        }
    }

    function descargarRespaldo() {
        const datos = leerDatos(CLAVE_RESPALDO);
        if (!datos.length) {
            alert("No hay producciones anteriores para respaldar.");
            return;
        }
        const blob = new Blob([JSON.stringify(datos, null, 2)], {
            type: "application/json;charset=utf-8"
        });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `abregu-producciones-respaldo-${fechaLocal()}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function iniciarSupabase() {
        mostrarEstado("Conectando Producción audiovisual con Supabase...");
        bloquear(true);
        try {
            db = window.abreguDB;
            if (!db) throw new Error("No se cargó supabase.js. Comprueba el orden de los scripts en produccion.html.");

            const { data: { user }, error: authError } = await db.auth.getUser();
            if (authError || !user) throw new Error("No hay una sesión válida. Inicia sesión nuevamente.");
            usuarioId = user.id;

            // La política RLS actual solo permite gestionar registros al propietario.
            const { data: estudio, error: estudioError } = await db
                .from("estudios")
                .select("id")
                .eq("propietario_id", usuarioId)
                .maybeSingle();
            if (estudioError || !estudio) throw new Error("No se pudo identificar el estudio de la cuenta administradora.");
            estudioId = estudio.id;

            await cargarDesdeSupabase();
            conectado = true;
            mostrarEstado("Supabase conectado. Las producciones se guardarán primero en la nube.");
        } catch (e) {
            conectado = false;
            console.error("Producción: fallo de conexión", e);
            mostrarEstado(`Conexión no disponible: ${e.message}. Para proteger los datos, el registro y la edición quedan deshabilitados.`, true);
        } finally {
            bloquear(false);
            actualizarPanelNube();
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

    formulario.addEventListener("submit", async evento => {

        evento.preventDefault();

        if (!conectado || ocupado || !formulario.reportValidity()) {
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

        bloquear(true);
        mostrarEstado("Guardando producción en Supabase...");

        try {
            if (anterior) {
                await modificarEnSupabase(video);
            } else {
                await crearEnSupabase(video);
            }

            producciones = anterior
                ? producciones.map(item => item.id === video.id ? video : item)
                : [...producciones, video];

            guardarDatosLocales();
            quitarDelRespaldo(video.id);
            idEditando = null;
            formulario.reset();
            botonGuardar.textContent = "Guardar producción";
            mostrarProducciones();
            actualizarIndicadores();
            mostrarEstado("Producción guardada en Supabase correctamente.");
            // No se anuncia éxito hasta que la nube confirma la operación.
        } catch (e) {
            console.error("No se pudo guardar la producción", e);
            mostrarEstado(`No se pudo guardar: ${e.message}`, true);
            alert("La producción NO se guardó en Supabase. Revisa el aviso del panel.");
        } finally {
            bloquear(false);
            actualizarPanelNube();
        }

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

    async function eliminarProduccion(id) {
        if (!conectado || ocupado) return;
        if (!confirm("¿Seguro que deseas eliminar esta producción?")) return;
        bloquear(true);
        mostrarEstado("Eliminando producción de Supabase...");
        try {
            await borrarEnSupabase(id);
            producciones = producciones.filter(video => video.id !== id);
            quitarDelRespaldo(id);
            guardarDatosLocales();
            if (idEditando === id) formulario.reset();
            mostrarProducciones();
            actualizarIndicadores();
            mostrarEstado("Producción eliminada de Supabase.");
        } catch (e) {
            console.error("No se pudo eliminar", e);
            mostrarEstado(`No se pudo eliminar: ${e.message}`, true);
        } finally {
            bloquear(false);
            actualizarPanelNube();
        }
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
    // 12. ACTIVAR CON SUPABASE
    // ======================================

    botonActualizar.addEventListener("click", actualizarManual);
    botonImportar.addEventListener("click", importarLocales);
    botonRespaldo.addEventListener("click", descargarRespaldo);

    const ayuda = formulario.querySelector(".helper-text");
    if (ayuda) {
        ayuda.textContent =
            "Las producciones se guardan en Supabase. " +
            "El Resumen conserva un caché local de los videos publicados.";
    }

    // Evitar editar registros locales hasta haber leído la nube.
    mostrarProducciones();
    actualizarIndicadores();
    bloquear(false);
    iniciarSupabase();

    console.log("Producción audiovisual: conexión Supabase iniciada.");

});