
/* ==========================================
   ABREGU STUDIOS
   MODULO: CLIENTES Y VENTAS
   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // =====================================
    // 1. CONFIGURACION
    // =====================================

    const $ = id => document.getElementById(id);

    const CLAVE_CLIENTES = "aa_clientes";
    const CLAVE_VENTAS = "aa_ventas";

    const TIPOS = {
        contenido: "Producción audiovisual",
        live: "Transmisiones en vivo",
        ambos: "Contenido y transmisiones",
        otros: "Otros servicios"
    };

    const ESTADOS_CLIENTE = {
        activo: "Activo",
        potencial: "Potencial",
        pausado: "Pausado",
        inactivo: "Inactivo"
    };

    const ESTADOS_VENTA = {
        nuevo: "Nuevo prospecto",
        contactado: "Contactado",
        cotizacion: "Cotización enviada",
        seguimiento: "En seguimiento",
        ganado: "Venta concretada",
        perdido: "Oportunidad perdida"
    };

    const MARCAS = {
        abregu: "ABREGU PRINT",
        fuze: "FUZE",
        kintex: "KINTEX",
        caedla: "CAEDLA",
        otro: "Otro"
    };

    const formCliente = $("form-cliente");
    const formVenta = $("form-venta");

    if (!formCliente || !formVenta) {
        console.error("Faltan formularios del módulo.");
        return;
    }

    // =====================================
    // 2. FUNCIONES GENERALES
    // =====================================

    function leerArray(clave) {
        try {
            const datos = JSON.parse(
                localStorage.getItem(clave)
            );

            return Array.isArray(datos) ? datos : [];

        } catch (error) {
            console.error("Error al leer:", clave);
            return [];
        }
    }

    function guardar(clave, datos) {
        try {
            localStorage.setItem(
                clave,
                JSON.stringify(datos)
            );

            return true;

        } catch (error) {
            console.error("Error al guardar:", error);

            alert(
                "No se pudieron guardar los datos."
            );

            return false;
        }
    }

    function generarId() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return window.crypto.randomUUID();
        }

        return (
            Date.now().toString() +
            "-" +
            Math.random().toString(36).slice(2)
        );
    }

    function hoy() {
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

    function formatearFecha(valor) {
        if (!valor) return "Sin fecha";

        const fecha = new Date(`${valor}T12:00:00`);

        if (Number.isNaN(fecha.getTime())) {
            return valor;
        }

        return fecha.toLocaleDateString("es-PE");
    }

    function soles(valor) {
        if (valor === null || valor === undefined) {
            return "Sin cotización";
        }

        return Number(valor).toLocaleString("es-PE", {
            style: "currency",
            currency: "PEN"
        });
    }

    function crearElemento(etiqueta, contenido) {
        const elemento = document.createElement(etiqueta);

        if (contenido !== undefined) {
            elemento.textContent = contenido;
        }

        return elemento;
    }

    function agregarDato(contenedor, titulo, valor) {
        if (
            valor === "" ||
            valor === null ||
            valor === undefined
        ) {
            return;
        }

        contenedor.appendChild(
            crearElemento("p", `${titulo}: ${valor}`)
        );
    }

    function crearBoton(texto, accion) {
        const boton = document.createElement("button");

        boton.type = "button";
        boton.textContent = texto;
        boton.addEventListener("click", accion);

        return boton;
    }

    function mostrarVacio(contenedor, mensaje) {
        const caja = crearElemento("div");
        caja.className = "empty-state";

        caja.appendChild(
            crearElemento("p", mensaje)
        );

        contenedor.appendChild(caja);
    }

    // =====================================
    // 3. CLIENTES INICIALES
    // =====================================

    const CLIENTES_INICIALES = [
        {
            id: "cliente-abregu",
            nombre: "ABREGU PRINT",
            tipo: "ambos",
            rubro: "Producción textil",
            minimo: 100,
            servicios:
                "DTF, vinil 3D, insignias, maquinaria",
            objetivo:
                "Producción audiovisual y captación de clientes"
        },
        {
            id: "cliente-fuze",
            nombre: "FUZE",
            tipo: "ambos",
            rubro: "Comercial textil",
            minimo: null,
            servicios:
                "Promociones, productos y transmisiones",
            objetivo:
                "Publicaciones diarias y ventas"
        },
        {
            id: "cliente-kintex",
            nombre: "KINTEX",
            tipo: "contenido",
            rubro: "Sector textil",
            minimo: null,
            servicios:
                "Sketches publicitarios y demostraciones",
            objetivo:
                "Dos sketches audiovisuales por semana"
        },
        {
            id: "cliente-caedla",
            nombre: "CAEDLA",
            tipo: "contenido",
            rubro: "Producción textil",
            minimo: 12,
            servicios:
                "Procesos de producción textil",
            objetivo:
                "Tres videos por semana"
        },
        {
            id: "cliente-juan",
            nombre: "JUAN INFANTE",
            tipo: "live",
            rubro: "Programas y entrevistas",
            minimo: null,
            servicios:
                "Jóvenes y Mujeres Emprendedoras",
            objetivo:
                "Producción técnica de transmisiones"
        },
        {
            id: "cliente-intepa",
            nombre: "INTEPA",
            tipo: "live",
            rubro: "Programas audiovisuales",
            minimo: null,
            servicios:
                "Transmisiones y uso del estudio",
            objetivo:
                "Producción y operación de LIVE"
        }
    ];

    function cargarClientesIniciales() {

        // No reemplazar clientes ya guardados.

        if (
            localStorage.getItem(CLAVE_CLIENTES) !== null
        ) {
            return leerArray(CLAVE_CLIENTES);
        }

        const iniciales = CLIENTES_INICIALES.map(
            cliente => ({
                ...cliente,

                estado: "activo",
                contacto: "",
                telefono: "",
                correo: "",
                locacion: "",
                descripcion: "",
                notas: "",
                fechaRegistro: hoy()
            })
        );

        guardar(CLAVE_CLIENTES, iniciales);

        return iniciales;
    }

    // Respaldar los datos existentes una sola vez, antes de sustituir
    // las vistas locales por los registros de Supabase.
    const clientesLocales = cargarClientesIniciales();
    const ventasLocales = leerArray(CLAVE_VENTAS);
    const RESPALDO_CLIENTES = "aa_clientes_respaldo_pre_supabase_v1";
    const RESPALDO_VENTAS = "aa_ventas_respaldo_pre_supabase_v1";

    try {
        if (localStorage.getItem(RESPALDO_CLIENTES) === null) {
            localStorage.setItem(RESPALDO_CLIENTES, JSON.stringify(clientesLocales));
        }
        if (localStorage.getItem(RESPALDO_VENTAS) === null) {
            localStorage.setItem(RESPALDO_VENTAS, JSON.stringify(ventasLocales));
        }
    } catch (error) {
        console.error("No se pudo crear el respaldo previo a Supabase:", error);
        alert("No se pudo respaldar Clientes y Ventas. No se iniciará la sincronización.");
        return;
    }

    let clientes = [];
    let ventas = [];
    let clienteEditando = null;
    let ventaEditando = null;

    // =====================================
    // CONEXIÓN SUPABASE (CLIENTES Y VENTAS)
    // =====================================

    const db = window.abreguDB;
    let estudioId = null;
    let usuarioId = null;
    let conectado = false;
    let listo = false;
    let ocupado = false;
    const versiones = new Map();

    const panelNube = document.createElement("div");
    panelNube.className = "production-card";
    panelNube.style.cssText =
        "padding:16px;margin:16px 0 22px;border-left:3px solid #e53d54";

    const estadoNube = document.createElement("p");
    estadoNube.setAttribute("role", "status");
    estadoNube.textContent = "Conectando Clientes y Ventas a Supabase...";

    const accionesNube = document.createElement("div");
    accionesNube.className = "form-actions";

    function botonNube(nombre) {
        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = nombre;
        return boton;
    }

    const botonActualizar = botonNube("Actualizar desde Supabase");
    const botonImportarClientes = botonNube("Importar clientes locales");
    const botonImportarVentas = botonNube("Importar ventas locales");
    const botonRespaldo = botonNube("Descargar respaldo local");

    accionesNube.append(
        botonActualizar, botonImportarClientes,
        botonImportarVentas, botonRespaldo
    );
    panelNube.append(estadoNube, accionesNube);
    formCliente.before(panelNube);

    const registroClave = (tipo, id) =>
        `${tipo === "clientes" ? "cliente" : "venta"}:` +
        encodeURIComponent(String(id));
    const claveVersion = (tipo, id) => `${tipo}:${String(id)}`;
    const respaldoDe = tipo =>
        leerArray(tipo === "clientes" ? RESPALDO_CLIENTES : RESPALDO_VENTAS)
            .filter(item => item && typeof item.id === "string" && item.id);

    function pendientesDe(tipo) {
        const enNube = new Set(
            (tipo === "clientes" ? clientes : ventas).map(item => String(item.id))
        );
        return respaldoDe(tipo).filter(item => !enNube.has(String(item.id)));
    }

    function mostrarEstado(mensaje, esError = false) {
        estadoNube.textContent = mensaje;
        estadoNube.style.color = esError ? "#ff8391" : "";
    }

    function disponibilidad() {
        const bloqueado = !listo || ocupado;
        $("guardar-cliente").disabled = bloqueado;
        $("guardar-venta").disabled = bloqueado;
        botonActualizar.disabled = !conectado || ocupado;
        botonImportarClientes.hidden = listo && !pendientesDe("clientes").length;
        botonImportarVentas.hidden = listo && !pendientesDe("ventas").length;
        botonImportarClientes.disabled = bloqueado || !pendientesDe("clientes").length;
        botonImportarVentas.disabled = bloqueado || !pendientesDe("ventas").length;
        botonRespaldo.disabled = false;
        $("lista-clientes")?.querySelectorAll("button").forEach(b => b.disabled = bloqueado);
        $("lista-ventas")?.querySelectorAll("button").forEach(b => b.disabled = bloqueado);
    }

    function guardarCacheLocal() {
        // Compatibilidad temporal con el Resumen y otros módulos antiguos.
        // Los respaldos originales NO se modifican.
        try {
            localStorage.setItem(CLAVE_CLIENTES, JSON.stringify(clientes));
            localStorage.setItem(CLAVE_VENTAS, JSON.stringify(ventas));
        } catch (error) {
            console.warn("Datos confirmados en Supabase, pero falló la caché:", error);
            mostrarEstado("Guardado en Supabase, pero no se actualizó la caché local.", true);
        }
    }

    function pintarEstado() {
        mostrarEstado(
            `Supabase conectado: ${clientes.length} clientes y ${ventas.length} oportunidades.` +
            (pendientesDe("clientes").length
                ? ` ${pendientesDe("clientes").length} clientes locales pendientes.` : "") +
            (pendientesDe("ventas").length
                ? ` ${pendientesDe("ventas").length} ventas locales pendientes.` : "")
        );
        disponibilidad();
    }

    // Consulta paginada para superar el límite por defecto de Supabase.
    async function leerModulo(tipo) {
        const resultado = [];
        const lote = 500;
        for (let desde = 0; ; desde += lote) {
            const { data, error } = await db.from("registros_modulos")
                .select("id,registro_clave,contenido,actualizado_en")
                .eq("estudio_id", estudioId)
                .eq("modulo", tipo)
                .order("registro_clave", { ascending: true })
                .range(desde, desde + lote - 1);
            if (error) throw error;
            resultado.push(...(data || []));
            if (!data || data.length < lote) break;
        }
        return resultado;
    }

    async function cargarNube() {
        if (!conectado || ocupado) return;
        ocupado = true;
        listo = false;
        disponibilidad();
        mostrarEstado("Consultando Clientes y Ventas en Supabase...");
        try {
            const [filasClientes, filasVentas] = await Promise.all([
                leerModulo("clientes"), leerModulo("ventas")
            ]);

            const nuevasVersiones = new Map();
            function convertirFilas(tipo, filas) {
                const resultado = [];
                const prefijo = tipo === "clientes" ? "cliente:" : "venta:";
                for (const fila of filas) {
                    const dato = fila.contenido;
                    if (!fila.registro_clave?.startsWith(prefijo) ||
                        !dato || Array.isArray(dato) || typeof dato !== "object" ||
                        typeof dato.id !== "string" || !dato.id ||
                        registroClave(tipo, dato.id) !== fila.registro_clave) continue;
                    resultado.push(dato);
                    nuevasVersiones.set(claveVersion(tipo, dato.id), {
                        id: fila.id,
                        actualizado_en: fila.actualizado_en
                    });
                }
                return resultado;
            }

            const nuevosClientes = convertirFilas("clientes", filasClientes);
            const nuevasVentas = convertirFilas("ventas", filasVentas);
            versiones.clear();
            nuevasVersiones.forEach((valor, clave) => versiones.set(clave, valor));
            clientes = nuevosClientes;
            ventas = nuevasVentas;
            listo = true;
            guardarCacheLocal();
            actualizarPantalla();
            pintarEstado();
        } catch (error) {
            console.error("Clientes y Ventas: error al cargar Supabase", error);
            mostrarEstado(`No se pudo cargar Supabase: ${error.message || error}. Edición bloqueada.`, true);
        } finally {
            ocupado = false;
            disponibilidad();
        }
    }

    async function iniciarSupabase() {
        try {
            if (!db) throw new Error("Falta cargar supabase.js.");
            const { data, error } = await db.auth.getUser();
            if (error || !data?.user) throw new Error("Inicia sesión para acceder.");
            usuarioId = data.user.id;

            const { data: estudio, error: errorEstudio } = await db
                .from("estudios").select("id")
                .eq("propietario_id", usuarioId).maybeSingle();
            if (errorEstudio || !estudio) throw new Error("No se encontró tu estudio.");
            estudioId = estudio.id;

            const { data: miembro, error: errorMiembro } = await db
                .from("miembros_estudio").select("rol,activo")
                .eq("estudio_id", estudioId)
                .eq("usuario_id", usuarioId).maybeSingle();
            if (errorMiembro || !miembro || !miembro.activo ||
                miembro.rol !== "administrador") {
                throw new Error("Esta cuenta no tiene permiso de administrador.");
            }
            conectado = true;
            await cargarNube();
        } catch (error) {
            console.error("Clientes y Ventas: acceso Supabase", error);
            mostrarEstado(`Sin conexión: ${error.message || error}. Edición bloqueada.`, true);
            disponibilidad();
        }
    }

    async function crearRemoto(tipo, item) {
        const { data, error } = await db.from("registros_modulos")
            .insert({
                estudio_id: estudioId,
                modulo: tipo,
                registro_clave: registroClave(tipo, item.id),
                contenido: item,
                creado_por: usuarioId
            })
            .select("id,actualizado_en").single();
        if (error) throw error;
        versiones.set(claveVersion(tipo, item.id), data);
    }

    async function editarRemoto(tipo, item) {
        const clave = claveVersion(tipo, item.id);
        const version = versiones.get(clave);
        if (!version) throw new Error("El registro no tiene versión de Supabase. Actualiza la lista.");

        const { data, error } = await db.from("registros_modulos")
            .update({ contenido: item, actualizado_en: new Date().toISOString() })
            .eq("id", version.id)
            .eq("estudio_id", estudioId)
            .eq("modulo", tipo)
            .eq("registro_clave", registroClave(tipo, item.id))
            .eq("actualizado_en", version.actualizado_en)
            .select("id,actualizado_en").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Este registro cambió desde otra computadora. Actualiza antes de guardar.");
        versiones.set(clave, data);
    }

    async function borrarRemoto(tipo, id) {
        const clave = claveVersion(tipo, id);
        const version = versiones.get(clave);
        if (!version) throw new Error("No se encontró la versión del registro. Actualiza primero.");
        const { data, error } = await db.from("registros_modulos")
            .delete()
            .eq("id", version.id)
            .eq("estudio_id", estudioId)
            .eq("modulo", tipo)
            .eq("registro_clave", registroClave(tipo, id))
            .eq("actualizado_en", version.actualizado_en)
            .select("id").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Este registro cambió o fue eliminado. Actualiza antes de continuar.");
        versiones.delete(clave);
    }

    function descargarRespaldo() {
        const contenido = {
            modulo: "clientes-y-ventas",
            generadoEn: new Date().toISOString(),
            clientes: respaldoDe("clientes"),
            ventas: respaldoDe("ventas")
        };
        const blob = new Blob([JSON.stringify(contenido, null, 2)],
            { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = "abregu-studios-clientes-ventas-respaldo.json";
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function importar(tipo) {
        if (!listo || ocupado) return;
        const pendientes = pendientesDe(tipo);
        if (!pendientes.length) return;
        const nombre = tipo === "clientes" ? "clientes" : "oportunidades de venta";
        if (!confirm(`¿Importar ${pendientes.length} ${nombre} locales a Supabase? No se sobrescribirán registros existentes.`)) return;
        ocupado = true;
        disponibilidad();
        let importados = 0, omitidos = 0, fallo = null;
        try {
            for (const item of pendientes) {
                try {
                    await crearRemoto(tipo, item);
                    importados++;
                } catch (error) {
                    if (error?.code === "23505") omitidos++;
                    else { fallo = error; break; }
                }
            }
        } catch (error) {
            fallo = error;
        } finally {
            ocupado = false;
            disponibilidad();
        }
        await cargarNube();
        alert(
            `Importados: ${importados}. Omitidos o con conflicto: ${omitidos}. ` +
            (fallo ? `Error: ${fallo.message}. ` : "") +
            "El respaldo local se conserva."
        );
    }

    botonActualizar.addEventListener("click", cargarNube);
    botonImportarClientes.addEventListener("click", () => importar("clientes"));
    botonImportarVentas.addEventListener("click", () => importar("ventas"));
    botonRespaldo.addEventListener("click", descargarRespaldo);
    disponibilidad();

    // =====================================
    // 4. INDICADORES COMERCIALES
    // =====================================

    function actualizarIndicadores() {

        $("total-clientes").textContent =
            clientes.length;

        $("total-prospectos").textContent =
            ventas.length;

        $("prospectos-seguimiento").textContent =
            ventas.filter(venta =>
                venta.estado === "seguimiento"
            ).length;

        $("ventas-concretadas").textContent =
            ventas.filter(venta =>
                venta.estado === "ganado"
            ).length;
    }

    // =====================================
    // 5. GUARDAR CLIENTE
    // =====================================

    formCliente.addEventListener("submit", async evento => {

        evento.preventDefault();

        if (!formCliente.reportValidity()) return;

        const anterior = clientes.find(
            cliente => cliente.id === clienteEditando
        );

        const cliente = {
            id: anterior?.id || generarId(),

            nombre: $("cliente-nombre").value.trim(),
            tipo: $("cliente-tipo").value,
            rubro: $("cliente-rubro").value.trim(),
            estado: $("cliente-estado").value,

            contacto: $("cliente-contacto").value.trim(),
            telefono: $("cliente-telefono").value.trim(),
            correo: $("cliente-correo").value.trim(),

            locacion: $("cliente-locacion").value.trim(),

            minimo: $("cliente-minimo").value
                ? Number($("cliente-minimo").value)
                : null,

            servicios:
                $("cliente-servicios").value.trim(),

            descripcion:
                $("cliente-descripcion").value.trim(),

            objetivo:
                $("cliente-objetivo").value.trim(),

            notas:
                $("cliente-notas").value.trim(),

            fechaRegistro:
                anterior?.fechaRegistro || hoy()
        };

        if (!cliente.nombre) {
            alert("Ingresa un nombre válido.");
            return;
        }

        // Evitar registrar dos veces el mismo cliente.

        const normalizar = texto =>
            texto.trim().toLocaleLowerCase("es");

        const duplicado = clientes.some(item =>
            item.id !== cliente.id &&
            normalizar(item.nombre) ===
            normalizar(cliente.nombre)
        );

        if (duplicado) {
            alert(
                "Ya existe un cliente con ese nombre. " +
                "Utiliza el botón Editar de su ficha."
            );
            return;
        }

        if (!listo || ocupado) return;
        ocupado = true;
        disponibilidad();
        try {
            if (anterior) await editarRemoto("clientes", cliente);
            else await crearRemoto("clientes", cliente);

            clientes = anterior
                ? clientes.map(item => item.id === cliente.id ? cliente : item)
                : [...clientes, cliente];
            guardarCacheLocal();

            clienteEditando = null;
            formCliente.reset();
            $("guardar-cliente").textContent = "Guardar cliente";
            actualizarPantalla();
            pintarEstado();
            alert("¡Cliente guardado en Supabase!");
        } catch (error) {
            console.error("Error guardando cliente:", error);
            alert(`No se guardó el cliente: ${error.message || error}`);
        } finally {
            ocupado = false;
            disponibilidad();
        }
    });

    // =====================================
    // 6. EDITAR CLIENTE
    // =====================================

    function editarCliente(id) {

        const cliente = clientes.find(
            item => item.id === id
        );

        if (!cliente) return;

        clienteEditando = id;

        const campos = {
            "cliente-nombre": cliente.nombre,
            "cliente-tipo": cliente.tipo,
            "cliente-rubro": cliente.rubro,
            "cliente-estado": cliente.estado,
            "cliente-contacto": cliente.contacto,
            "cliente-telefono": cliente.telefono,
            "cliente-correo": cliente.correo,
            "cliente-locacion": cliente.locacion,
            "cliente-minimo": cliente.minimo,
            "cliente-servicios": cliente.servicios,
            "cliente-descripcion": cliente.descripcion,
            "cliente-objetivo": cliente.objetivo,
            "cliente-notas": cliente.notas
        };

        Object.entries(campos).forEach(
            ([idCampo, valor]) => {

                $(idCampo).value = valor ?? "";

            }
        );

        $("guardar-cliente").textContent =
            "Guardar cambios";

        $("nuevo-cliente").scrollIntoView({
            behavior: "smooth"
        });
    }

    // =====================================
    // 7. ELIMINAR CLIENTE
    // =====================================

    async function eliminarCliente(id) {

        const cliente = clientes.find(
            item => item.id === id
        );

        if (!cliente) return;

        if (!confirm(
            `¿Eliminar la ficha de ${cliente.nombre}?`
        )) {
            return;
        }

        if (!listo || ocupado) return;
        ocupado = true;
        disponibilidad();
        try {
            await borrarRemoto("clientes", id);
            clientes = clientes.filter(item => item.id !== id);
            guardarCacheLocal();

            if (clienteEditando === id) {
                clienteEditando = null;
                formCliente.reset();
            }
            actualizarPantalla();
            pintarEstado();
        } catch (error) {
            console.error("Error eliminando cliente:", error);
            alert(`No se eliminó el cliente: ${error.message || error}`);
        } finally {
            ocupado = false;
            disponibilidad();
        }
    }

    // =====================================
    // 8. MOSTRAR CLIENTES
    // =====================================

    const filtroClientes = $("filtro-tipo-cliente");

    function mostrarClientes() {

        const contenedor = $("lista-clientes");

        contenedor.replaceChildren();

        const filtro = filtroClientes.value;

        const filtrados = clientes.filter(cliente => {

            if (filtro === "todos") return true;

            if (filtro === "ambos") {
                return cliente.tipo === "ambos";
            }

            return (
                cliente.tipo === filtro ||
                cliente.tipo === "ambos"
            );
        });

        if (!filtrados.length) {
            mostrarVacio(
                contenedor,
                "No hay clientes para este filtro."
            );
            return;
        }

        filtrados.forEach(cliente => {

            const tarjeta = crearElemento("article");
            tarjeta.className = "production-card";

            tarjeta.appendChild(
                crearElemento("h3", cliente.nombre)
            );

            agregarDato(
                tarjeta,
                "Servicio",
                TIPOS[cliente.tipo] || "Otro"
            );

            agregarDato(
                tarjeta,
                "Estado",
                ESTADOS_CLIENTE[cliente.estado] ||
                cliente.estado
            );

            agregarDato(
                tarjeta,
                "Rubro",
                cliente.rubro
            );

            agregarDato(
                tarjeta,
                "Contacto",
                cliente.contacto
            );

            agregarDato(
                tarjeta,
                "Teléfono",
                cliente.telefono
            );

            agregarDato(
                tarjeta,
                "Correo",
                cliente.correo
            );

            agregarDato(
                tarjeta,
                "Locación",
                cliente.locacion
            );

            if (cliente.minimo !== null &&
                cliente.minimo !== undefined) {

                agregarDato(
                    tarjeta,
                    "Pedido mínimo",
                    `${cliente.minimo} unidades`
                );
            }

            agregarDato(
                tarjeta,
                "Servicios",
                cliente.servicios
            );

            agregarDato(
                tarjeta,
                "Descripción",
                cliente.descripcion
            );

            agregarDato(
                tarjeta,
                "Objetivo",
                cliente.objetivo
            );

            agregarDato(
                tarjeta,
                "Observaciones",
                cliente.notas
            );

            const acciones = crearElemento("div");
            acciones.className = "form-actions";

            acciones.append(
                crearBoton(
                    "Editar",
                    () => editarCliente(cliente.id)
                ),

                crearBoton(
                    "Eliminar",
                    () => eliminarCliente(cliente.id)
                )
            );

            tarjeta.appendChild(acciones);
            contenedor.appendChild(tarjeta);
        });
    }

    // =====================================
    // 9. GUARDAR OPORTUNIDAD DE VENTA
    // =====================================

    formVenta.addEventListener("submit", async evento => {

        evento.preventDefault();

        if (!formVenta.reportValidity()) return;

        const anterior = ventas.find(
            venta => venta.id === ventaEditando
        );

        const venta = {
            id: anterior?.id || generarId(),

            prospecto:
                $("venta-prospecto").value.trim(),

            marca: $("venta-marca").value,

            contacto:
                $("venta-contacto").value.trim(),

            producto:
                $("venta-producto").value.trim(),

            cantidad: $("venta-cantidad").value
                ? Number($("venta-cantidad").value)
                : null,

            monto: $("venta-monto").value !== ""
                ? Number($("venta-monto").value)
                : null,

            estado: $("venta-estado").value,

            fecha: $("venta-fecha").value,

            seguimiento:
                $("venta-seguimiento").value,

            origen: $("venta-origen").value,

            notas: $("venta-notas").value.trim(),

            fechaRegistro:
                anterior?.fechaRegistro || hoy()
        };

        if (!venta.prospecto || !venta.producto) {
            alert("Completa los datos principales.");
            return;
        }

        if (
            venta.seguimiento &&
            venta.seguimiento < venta.fecha
        ) {
            alert(
                "El seguimiento no puede ser anterior " +
                "a la fecha de contacto."
            );
            return;
        }

        if (!listo || ocupado) return;
        ocupado = true;
        disponibilidad();
        try {
            if (anterior) await editarRemoto("ventas", venta);
            else await crearRemoto("ventas", venta);

            ventas = anterior
                ? ventas.map(item => item.id === venta.id ? venta : item)
                : [...ventas, venta];
            guardarCacheLocal();

            ventaEditando = null;
            formVenta.reset();
            $("venta-fecha").value = hoy();
            $("guardar-venta").textContent = "Guardar oportunidad";
            actualizarPantalla();
            pintarEstado();
            alert("¡Oportunidad guardada en Supabase!");
        } catch (error) {
            console.error("Error guardando oportunidad:", error);
            alert(`No se guardó la oportunidad: ${error.message || error}`);
        } finally {
            ocupado = false;
            disponibilidad();
        }
    });

    // =====================================
    // 10. EDITAR VENTA
    // =====================================

    function editarVenta(id) {

        const venta = ventas.find(
            item => item.id === id
        );

        if (!venta) return;

        ventaEditando = id;

        const campos = {
            "venta-prospecto": venta.prospecto,
            "venta-marca": venta.marca,
            "venta-contacto": venta.contacto,
            "venta-producto": venta.producto,
            "venta-cantidad": venta.cantidad,
            "venta-monto": venta.monto,
            "venta-estado": venta.estado,
            "venta-fecha": venta.fecha,
            "venta-seguimiento": venta.seguimiento,
            "venta-origen": venta.origen,
            "venta-notas": venta.notas
        };

        Object.entries(campos).forEach(
            ([idCampo, valor]) => {

                $(idCampo).value = valor ?? "";

            }
        );

        $("guardar-venta").textContent =
            "Guardar cambios";

        $("nueva-venta").scrollIntoView({
            behavior: "smooth"
        });
    }

    // =====================================
    // 11. ELIMINAR VENTA
    // =====================================

    async function eliminarVenta(id) {

        const venta = ventas.find(
            item => item.id === id
        );

        if (!venta) return;

        if (!confirm(
            `¿Eliminar la oportunidad de ${venta.prospecto}?`
        )) {
            return;
        }

        if (!listo || ocupado) return;
        ocupado = true;
        disponibilidad();
        try {
            await borrarRemoto("ventas", id);
            ventas = ventas.filter(item => item.id !== id);
            guardarCacheLocal();

            if (ventaEditando === id) {
                ventaEditando = null;
                formVenta.reset();
            }
            actualizarPantalla();
            pintarEstado();
        } catch (error) {
            console.error("Error eliminando oportunidad:", error);
            alert(`No se eliminó la oportunidad: ${error.message || error}`);
        } finally {
            ocupado = false;
            disponibilidad();
        }
    }

    // =====================================
    // 12. MOSTRAR VENTAS
    // =====================================

    const filtroVentas = $("filtro-venta-estado");

    function mostrarVentas() {

        const contenedor = $("lista-ventas");

        contenedor.replaceChildren();

        const filtro = filtroVentas.value;

        const filtradas = ventas.filter(venta =>
            filtro === "todos" ||
            venta.estado === filtro
        );

        if (!filtradas.length) {
            mostrarVacio(
                contenedor,
                "No hay oportunidades para este filtro."
            );
            return;
        }

        filtradas.sort((a, b) =>
            b.fecha.localeCompare(a.fecha)
        );

        filtradas.forEach(venta => {

            const tarjeta = crearElemento("article");
            tarjeta.className = "production-card";

            tarjeta.appendChild(
                crearElemento("h3", venta.prospecto)
            );

            agregarDato(
                tarjeta,
                "Marca",
                MARCAS[venta.marca] || venta.marca
            );

            agregarDato(
                tarjeta,
                "Producto o servicio",
                venta.producto
            );

            agregarDato(
                tarjeta,
                "Contacto",
                venta.contacto
            );

            agregarDato(
                tarjeta,
                "Estado",
                ESTADOS_VENTA[venta.estado] ||
                venta.estado
            );

            agregarDato(
                tarjeta,
                "Monto estimado",
                soles(venta.monto)
            );

            if (venta.cantidad !== null) {
                agregarDato(
                    tarjeta,
                    "Cantidad",
                    venta.cantidad
                );
            }

            agregarDato(
                tarjeta,
                "Fecha de contacto",
                formatearFecha(venta.fecha)
            );

            if (venta.seguimiento) {

                agregarDato(
                    tarjeta,
                    "Próximo seguimiento",
                    formatearFecha(venta.seguimiento)
                );

                const abierta = ![
                    "ganado",
                    "perdido"
                ].includes(venta.estado);

                if (
                    abierta &&
                    venta.seguimiento <= hoy()
                ) {

                    const aviso = crearElemento(
                        "p",
                        venta.seguimiento === hoy()
                            ? "Seguimiento para hoy"
                            : "Seguimiento vencido"
                    );

                    aviso.style.color = "#ff4058";
                    aviso.style.fontWeight = "700";

                    tarjeta.appendChild(aviso);
                }
            }

            agregarDato(
                tarjeta,
                "Origen",
                venta.origen
            );

            agregarDato(
                tarjeta,
                "Observaciones",
                venta.notas
            );

            const acciones = crearElemento("div");
            acciones.className = "form-actions";

            acciones.append(
                crearBoton(
                    "Editar",
                    () => editarVenta(venta.id)
                ),

                crearBoton(
                    "Eliminar",
                    () => eliminarVenta(venta.id)
                )
            );

            tarjeta.appendChild(acciones);
            contenedor.appendChild(tarjeta);
        });
    }

    // =====================================
    // 13. FILTROS Y LIMPIEZA
    // =====================================

    filtroClientes.disabled = false;
    filtroVentas.disabled = false;

    filtroClientes.addEventListener(
        "change",
        mostrarClientes
    );

    filtroVentas.addEventListener(
        "change",
        mostrarVentas
    );

    formCliente.addEventListener("reset", () => {
        clienteEditando = null;

        $("guardar-cliente").textContent =
            "Guardar cliente";
    });

    formVenta.addEventListener("reset", () => {
        ventaEditando = null;

        $("guardar-venta").textContent =
            "Guardar oportunidad";

        // El reset nativo ocurre después del evento.
        setTimeout(() => {
            if (!$("venta-fecha").value) {
                $("venta-fecha").value = hoy();
            }
        }, 0);
    });

    // =====================================
    // 14. ACTUALIZAR PANTALLA
    // =====================================

    function actualizarPantalla() {
        actualizarIndicadores();
        mostrarClientes();
        mostrarVentas();
    }

    // =====================================
    // 15. INICIAR MODULO
    // =====================================

    $("guardar-cliente").disabled = true;
    $("guardar-venta").disabled = true;

    $("venta-fecha").value = hoy();

    const ayudaCliente =
        formCliente.querySelector(".helper-text");

    if (ayudaCliente) {
        ayudaCliente.textContent =
            "Clientes y contactos se guardan en Supabase. Los datos anteriores pueden importarse manualmente.";
    }

    const ayudaVenta =
        formVenta.querySelector(".helper-text");

    if (ayudaVenta) {
        ayudaVenta.textContent =
            "Registra prospectos, cotizaciones y seguimientos. Los cambios se confirman en Supabase.";
    }

    actualizarPantalla();
    disponibilidad();
    iniciarSupabase();

    console.log("ABREGU STUDIOS: Clientes y Ventas preparado para Supabase.");

});