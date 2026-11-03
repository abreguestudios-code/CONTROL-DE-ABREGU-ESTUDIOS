
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

    let clientes = cargarClientesIniciales();
    let ventas = leerArray(CLAVE_VENTAS);

    let clienteEditando = null;
    let ventaEditando = null;

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

    formCliente.addEventListener("submit", evento => {

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

        const anteriores = [...clientes];

        if (anterior) {
            clientes = clientes.map(item =>
                item.id === cliente.id ? cliente : item
            );
        } else {
            clientes.push(cliente);
        }

        if (!guardar(CLAVE_CLIENTES, clientes)) {
            clientes = anteriores;
            return;
        }

        clienteEditando = null;
        formCliente.reset();

        $("guardar-cliente").textContent =
            "Guardar cliente";

        actualizarPantalla();

        alert("¡Cliente guardado correctamente!");
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

    function eliminarCliente(id) {

        const cliente = clientes.find(
            item => item.id === id
        );

        if (!cliente) return;

        if (!confirm(
            `¿Eliminar la ficha de ${cliente.nombre}?`
        )) {
            return;
        }

        const anteriores = [...clientes];

        clientes = clientes.filter(
            item => item.id !== id
        );

        if (!guardar(CLAVE_CLIENTES, clientes)) {
            clientes = anteriores;
            return;
        }

        if (clienteEditando === id) {
            clienteEditando = null;
            formCliente.reset();
        }

        actualizarPantalla();
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

    formVenta.addEventListener("submit", evento => {

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

        const anteriores = [...ventas];

        if (anterior) {
            ventas = ventas.map(item =>
                item.id === venta.id ? venta : item
            );
        } else {
            ventas.push(venta);
        }

        if (!guardar(CLAVE_VENTAS, ventas)) {
            ventas = anteriores;
            return;
        }

        ventaEditando = null;
        formVenta.reset();

        $("venta-fecha").value = hoy();

        $("guardar-venta").textContent =
            "Guardar oportunidad";

        actualizarPantalla();

        alert("¡Oportunidad registrada correctamente!");
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

    function eliminarVenta(id) {

        const venta = ventas.find(
            item => item.id === id
        );

        if (!venta) return;

        if (!confirm(
            `¿Eliminar la oportunidad de ${venta.prospecto}?`
        )) {
            return;
        }

        const anteriores = [...ventas];

        ventas = ventas.filter(
            item => item.id !== id
        );

        if (!guardar(CLAVE_VENTAS, ventas)) {
            ventas = anteriores;
            return;
        }

        if (ventaEditando === id) {
            ventaEditando = null;
            formVenta.reset();
        }

        actualizarPantalla();
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

    $("guardar-cliente").disabled = false;
    $("guardar-venta").disabled = false;

    $("venta-fecha").value = hoy();

    const ayudaCliente =
        formCliente.querySelector(".helper-text");

    if (ayudaCliente) {
        ayudaCliente.textContent =
            "Las fichas se guardan en este navegador.";
    }

    const ayudaVenta =
        formVenta.querySelector(".helper-text");

    if (ayudaVenta) {
        ayudaVenta.textContent =
            "Registra prospectos, cotizaciones " +
            "y próximos seguimientos.";
    }

    actualizarPantalla();

    console.log(
        "Clientes y ventas iniciado correctamente."
    );

});
