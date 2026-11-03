
/* ==========================================
   ABREGU STUDIOS
   MODULO: EQUIPO Y PERMISOS

   Administrador: SAMGIUK INGA

   VERSION LOCAL:
   Gestion de fichas de colaboradores.
   NO crea cuentas ni concede permisos reales.
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    // =====================================
    // 1. CONFIGURACION
    // =====================================

    const $ = id => document.getElementById(id);

    const CLAVE = "aa_equipo_colaboradores";

    const ROLES = {
        productor: "Productor audiovisual",
        live: "Operador LIVE",
        editor: "Editor / Diseñador",
        comercial: "Comercial",
        consulta: "Administración / Consulta"
    };

    const MARCAS = {
        general: "General",
        abregu: "ABREGU PRINT",
        fuze: "FUZE",
        kintex: "KINTEX",
        caedla: "CAEDLA",
        intepa: "INTEPA",
        "juan-infante": "JUAN INFANTE"
    };

    const ESTADOS = {
        pendiente: "Pendiente de invitación",
        activo: "Activo en el directorio",
        suspendido: "Suspendido",
        inactivo: "Inactivo"
    };

    const formulario = $("form-equipo");
    const lista = $("lista-equipo");
    const invitaciones = $("lista-invitaciones");
    const filtro = $("filtro-rol-equipo");
    const botonGuardar = $("guardar-colaborador");

    if (
        !formulario ||
        !lista ||
        !invitaciones ||
        !filtro ||
        !botonGuardar
    ) {
        console.error(
            "Faltan elementos de Equipo y Permisos."
        );
        return;
    }

    // =====================================
    // 2. ALMACENAMIENTO
    // =====================================

    function leerColaboradores() {

        try {

            const datos = JSON.parse(
                localStorage.getItem(CLAVE) || "[]"
            );

            return Array.isArray(datos) ? datos : [];

        } catch (error) {

            console.error(
                "Error al leer colaboradores:",
                error
            );

            return [];
        }
    }

    let colaboradores = leerColaboradores();
    let idEditando = null;

    function guardarDatos(nuevos) {

        try {

            localStorage.setItem(
                CLAVE,
                JSON.stringify(nuevos)
            );

            colaboradores = nuevos;

            return true;

        } catch (error) {

            console.error(error);

            alert(
                "No se pudieron guardar los colaboradores."
            );

            return false;
        }
    }

    // =====================================
    // 3. FUNCIONES GENERALES
    // =====================================

    function generarId() {

        if (
            window.crypto &&
            typeof window.crypto.randomUUID ===
                "function"
        ) {
            return window.crypto.randomUUID();
        }

        return (
            Date.now().toString() +
            "-" +
            Math.random().toString(36).slice(2)
        );
    }

    function fechaActual() {

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

    function normalizar(texto) {

        return String(texto || "")
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function crearElemento(etiqueta, contenido) {

        const elemento =
            document.createElement(etiqueta);

        if (contenido !== undefined) {
            elemento.textContent = contenido;
        }

        return elemento;
    }

    function agregarDato(caja, etiqueta, valor) {

        if (
            valor === "" ||
            valor === null ||
            valor === undefined
        ) {
            return;
        }

        caja.appendChild(
            crearElemento(
                "p",
                `${etiqueta}: ${valor}`
            )
        );
    }

    function crearBoton(texto, accion) {

        const boton = crearElemento(
            "button",
            texto
        );

        boton.type = "button";

        boton.addEventListener(
            "click",
            accion
        );

        return boton;
    }

    function mostrarVacio(caja, mensaje) {

        const contenido =
            crearElemento("div");

        contenido.className = "empty-state";

        contenido.appendChild(
            crearElemento("p", mensaje)
        );

        caja.appendChild(contenido);
    }

    // =====================================
    // 4. INDICADORES
    // =====================================

    function actualizarIndicadores() {

        const total = colaboradores.length;

        const activos = colaboradores.filter(
            c => c.estado === "activo"
        ).length;

        const pendientes = colaboradores.filter(
            c => c.estado === "pendiente"
        ).length;

        const rolesAsignados = new Set(
            colaboradores
                .map(c => c.rol)
                .filter(Boolean)
        ).size;

        $("equipo-total").textContent = total;

        $("equipo-activos").textContent = activos;

        $("equipo-invitaciones").textContent =
            pendientes;

        $("equipo-roles").textContent =
            rolesAsignados;
    }

    // =====================================
    // 5. REGISTRAR COLABORADOR
    // =====================================

    formulario.addEventListener(
        "submit",
        evento => {

            evento.preventDefault();

            if (!formulario.reportValidity()) {
                return;
            }

            const anterior = colaboradores.find(
                c => c.id === idEditando
            );

            const colaborador = {

                id:
                    anterior?.id || generarId(),

                nombre:
                    $("equipo-nombre").value.trim(),

                correo:
                    $("equipo-correo").value.trim(),

                cargo:
                    $("equipo-cargo").value.trim(),

                rol:
                    $("equipo-rol").value,

                marca:
                    $("equipo-marca").value,

                estado:
                    $("equipo-estado").value,

                notas:
                    $("equipo-notas").value.trim(),

                fechaRegistro:
                    anterior?.fechaRegistro ||
                    fechaActual()
            };

            // Validaciones básicas

            if (!colaborador.nombre) {

                alert(
                    "Ingresa el nombre del colaborador."
                );

                return;
            }

            if (!ROLES[colaborador.rol]) {

                alert(
                    "Selecciona un rol válido."
                );

                return;
            }

            // Evitar duplicar correos si se ingresan.

            const correoDuplicado =
                colaborador.correo &&
                colaboradores.some(c =>

                    c.id !== colaborador.id &&

                    normalizar(c.correo) ===
                    normalizar(colaborador.correo)

                );

            if (correoDuplicado) {

                alert(
                    "Ya existe una ficha con ese correo."
                );

                return;
            }

            let nuevos;

            if (anterior) {

                nuevos = colaboradores.map(
                    c =>
                        c.id === colaborador.id
                            ? colaborador
                            : c
                );

            } else {

                nuevos = [
                    ...colaboradores,
                    colaborador
                ];
            }

            if (!guardarDatos(nuevos)) {
                return;
            }

            idEditando = null;

            formulario.reset();

            botonGuardar.textContent =
                "Registrar colaborador";

            actualizarPantalla();

            alert(
                "¡Ficha del colaborador guardada!"
            );
        }
    );

    // =====================================
    // 6. EDITAR COLABORADOR
    // =====================================

    function editarColaborador(id) {

        const colaborador = colaboradores.find(
            c => c.id === id
        );

        if (!colaborador) return;

        idEditando = id;

        const campos = {

            "equipo-nombre":
                colaborador.nombre,

            "equipo-correo":
                colaborador.correo,

            "equipo-cargo":
                colaborador.cargo,

            "equipo-rol":
                colaborador.rol,

            "equipo-marca":
                colaborador.marca,

            "equipo-estado":
                colaborador.estado,

            "equipo-notas":
                colaborador.notas
        };

        Object.entries(campos).forEach(
            ([idCampo, valor]) => {

                const campo = $(idCampo);

                if (campo) {
                    campo.value = valor ?? "";
                }
            }
        );

        botonGuardar.textContent =
            "Guardar cambios";

        $("nuevo-colaborador").scrollIntoView({
            behavior: "smooth"
        });
    }

    // =====================================
    // 7. ELIMINAR COLABORADOR
    // =====================================

    function eliminarColaborador(id) {

        const colaborador = colaboradores.find(
            c => c.id === id
        );

        if (!colaborador) return;

        const confirmar = confirm(
            `¿Eliminar la ficha de ${colaborador.nombre}?`
        );

        if (!confirmar) return;

        const nuevos = colaboradores.filter(
            c => c.id !== id
        );

        if (!guardarDatos(nuevos)) {
            return;
        }

        if (idEditando === id) {

            formulario.reset();
            idEditando = null;

            botonGuardar.textContent =
                "Registrar colaborador";
        }

        actualizarPantalla();
    }

    // =====================================
    // 8. MOSTRAR COLABORADORES
    // =====================================

    function mostrarColaboradores() {

        lista.replaceChildren();

        const rolSeleccionado = filtro.value;

        const filtrados = colaboradores.filter(
            c =>
                rolSeleccionado === "todos" ||
                c.rol === rolSeleccionado
        );

        filtrados.sort(
            (a, b) =>
                a.nombre.localeCompare(
                    b.nombre,
                    "es"
                )
        );

        if (!filtrados.length) {

            mostrarVacio(
                lista,
                colaboradores.length
                    ? "No hay colaboradores para este filtro."
                    : "Todavía no hay colaboradores registrados."
            );

            return;
        }

        filtrados.forEach(colaborador => {

            const tarjeta =
                crearElemento("article");

            tarjeta.className =
                "production-card";

            // Nombre

            tarjeta.appendChild(
                crearElemento(
                    "h3",
                    colaborador.nombre
                )
            );

            // Información

            agregarDato(
                tarjeta,
                "Cargo",
                colaborador.cargo ||
                "Por definir"
            );

            agregarDato(
                tarjeta,
                "Rol previsto",
                ROLES[colaborador.rol] ||
                "Sin rol"
            );

            agregarDato(
                tarjeta,
                "Marca principal",
                MARCAS[colaborador.marca] ||
                "General"
            );

            agregarDato(
                tarjeta,
                "Estado",
                ESTADOS[colaborador.estado] ||
                colaborador.estado
            );

            agregarDato(
                tarjeta,
                "Correo",
                colaborador.correo
            );

            agregarDato(
                tarjeta,
                "Responsabilidades",
                colaborador.notas
            );

            agregarDato(
                tarjeta,
                "Registrado",
                colaborador.fechaRegistro
            );

            // Aviso de seguridad

            const aviso = crearElemento(
                "p",
                "Ficha local. No tiene acceso al sistema."
            );

            aviso.style.fontSize = "12px";

            aviso.style.opacity = "0.7";

            tarjeta.appendChild(aviso);

            // Acciones

            const acciones =
                crearElemento("div");

            acciones.className =
                "form-actions";

            acciones.append(

                crearBoton(
                    "Editar",
                    () => editarColaborador(
                        colaborador.id
                    )
                ),

                crearBoton(
                    "Eliminar",
                    () => eliminarColaborador(
                        colaborador.id
                    )
                )
            );

            tarjeta.appendChild(acciones);

            lista.appendChild(tarjeta);
        });
    }

    // =====================================
    // 9. PENDIENTES DE INVITACION
    // =====================================

    function mostrarInvitaciones() {

        invitaciones.replaceChildren();

        const pendientes = colaboradores.filter(
            c => c.estado === "pendiente"
        );

        if (!pendientes.length) {

            mostrarVacio(
                invitaciones,
                "No hay colaboradores pendientes de invitación."
            );

            return;
        }

        pendientes.forEach(colaborador => {

            const tarjeta =
                crearElemento("article");

            tarjeta.className =
                "production-card";

            tarjeta.appendChild(
                crearElemento(
                    "h3",
                    colaborador.nombre
                )
            );

            agregarDato(
                tarjeta,
                "Rol previsto",
                ROLES[colaborador.rol]
            );

            agregarDato(
                tarjeta,
                "Marca",
                MARCAS[colaborador.marca]
            );

            tarjeta.appendChild(
                crearElemento(
                    "p",
                    "Invitación no enviada. " +
                    "Pendiente de integrar Supabase Auth."
                )
            );

            invitaciones.appendChild(tarjeta);
        });
    }

    // =====================================
    // 10. FILTROS Y FORMULARIO
    // =====================================

    filtro.disabled = false;

    filtro.addEventListener(
        "change",
        mostrarColaboradores
    );

    formulario.addEventListener(
        "reset",
        () => {

            idEditando = null;

            botonGuardar.textContent =
                "Registrar colaborador";
        }
    );

    // =====================================
    // 11. ACTUALIZAR TODO
    // =====================================

    function actualizarPantalla() {

        actualizarIndicadores();

        mostrarColaboradores();

        mostrarInvitaciones();
    }

    // =====================================
    // 12. ACTIVAR CAMPOS
    // =====================================

    formulario.querySelectorAll(
        "input, select, textarea, button"
    ).forEach(elemento => {

        elemento.disabled = false;
    });

    // El correo es opcional hasta tener Auth.

    const correo = $("equipo-correo");

    correo.required = false;

    correo.placeholder =
        "Opcional - sin invitación automática";

    // Cambiar aclaraciones del HTML.

    const ayuda = formulario.querySelector(
        ".helper-text"
    );

    if (ayuda) {

        ayuda.textContent =
            "Registra solamente fichas internas. " +
            "Esto no crea cuentas ni concede permisos. " +
            "Los datos quedan en este navegador.";
    }

    const indicadorActivos = $(
        "equipo-activos"
    );

    const tarjetaActivos =
        indicadorActivos?.closest(".stat-card");

    const textoActivos =
        tarjetaActivos?.querySelector("span");

    if (textoActivos) {
        textoActivos.textContent =
            "Fichas activas, sin acceso real";
    }

    const indicadorInvitaciones = $(
        "equipo-invitaciones"
    );

    const tarjetaInvitaciones =
        indicadorInvitaciones?.closest(".stat-card");

    const textoInvitaciones =
        tarjetaInvitaciones?.querySelector("span");

    if (textoInvitaciones) {
        textoInvitaciones.textContent =
            "Pendientes, sin correos enviados";
    }

    const indicadorRoles = $(
        "equipo-roles"
    );

    const tarjetaRoles =
        indicadorRoles?.closest(".stat-card");

    const textoRoles =
        tarjetaRoles?.querySelector("span");

    if (textoRoles) {
        textoRoles.textContent =
            "Roles distintos asignados";
    }

    // =====================================
    // 13. SINCRONIZAR ENTRE PESTAÑAS
    // =====================================

    window.addEventListener(
        "storage",
        evento => {

            if (
                evento.key === CLAVE ||
                evento.key === null
            ) {

                colaboradores =
                    leerColaboradores();

                actualizarPantalla();
            }
        }
    );

    // =====================================
    // 14. INICIAR MODULO
    // =====================================

    actualizarPantalla();

    console.log(
        "Equipo y Permisos iniciado. " +
        "Modo directorio local."
    );

});
