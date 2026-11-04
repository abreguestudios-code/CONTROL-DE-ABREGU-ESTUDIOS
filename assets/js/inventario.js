/* ==========================================
  ABREGU STUDIOS 
   MODULO: INVENTARIO
   Administrador: SAMGIUK INGA
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // 1. CONFIGURACION
    // ======================================

    const $ = id => document.getElementById(id);

    const CLAVE = "aa_inventario";

    const form = $("form-inventario");
    const lista = $("lista-inventario");
    const control = $("lista-equipos-control");
    const boton = $("guardar-equipo");

    const buscar = $("buscar-equipo");
    const filtroCategoria = $("filtro-categoria");
    const filtroEstado = $("filtro-estado-equipo");
    const exportar = $("exportar-inventario");

    if (![
        form, lista, control, boton,
        buscar, filtroCategoria, filtroEstado, exportar
    ].every(Boolean)) {
        console.error(
            "Inventario: faltan elementos en inventario.html"
        );
        return;
    }

    const CATEGORIAS = {
        computacion: "Computación",
        camaras: "Cámaras",
        lentes: "Lentes y óptica",
        audio: "Audio",
        iluminacion: "Iluminación",
        cables: "Cables y conexiones",
        soportes: "Soportes y accesorios",
        otros: "Otros"
    };

    const ESTADOS = {
        disponible: "Disponible",
        uso: "En uso",
        prestado: "Prestado",
        mantenimiento: "En mantenimiento",
        danado: "Dañado",
        baja: "Dado de baja"
    };

    const CONDICIONES = {
        bueno: "Buen estado",
        regular: "Regular",
        observacion: "Con observaciones",
        defectuoso: "Defectuoso"
    };

    // ======================================
    // 2. ALMACENAMIENTO
    // ======================================

    function leerInventario() {
        try {
            const datos = JSON.parse(
                localStorage.getItem(CLAVE) || "[]"
            );

            return Array.isArray(datos) ? datos : [];

        } catch (error) {
            console.error(
                "Error leyendo inventario:",
                error
            );
            return [];
        }
    }

    // Respaldo independiente de los registros locales previos.
    const CLAVE_RESPALDO = "aa_inventario_respaldo_pre_supabase";
    const MODULO_REMOTO = "inventario";
    const equiposLocalesIniciales = leerInventario();

    let equipos = [];
    let idEditando = null;
    let db = null;
    let estudioId = null;
    let usuarioId = null;
    let nubeLista = false;
    let procesando = false;
    const versiones = new Map();

    // Conservamos aa_inventario como caché/compatibilidad con los otros módulos.
    // El registro verdadero se confirma en Supabase antes de actualizarla.
    function guardar() {
        try {
            localStorage.setItem(CLAVE, JSON.stringify(equipos));
            return true;
        } catch (error) {
            console.warn("No se pudo actualizar la caché local:", error);
            return false;
        }
    }

    // ======================================
    // 3. FECHAS E IDENTIFICADORES
    // ======================================

    function hoy() {
        const d = new Date();

        return (
            `${d.getFullYear()}-` +
            `${String(d.getMonth() + 1).padStart(2, "0")}-` +
            `${String(d.getDate()).padStart(2, "0")}`
        );
    }

    function nuevoId() {
        return window.crypto?.randomUUID?.() ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    // ======================================
    // 4. ELEMENTOS VISUALES
    // ======================================

    function texto(tag, contenido, clase = "") {
        const nodo = document.createElement(tag);

        nodo.textContent = contenido;

        if (clase) {
            nodo.className = clase;
        }

        return nodo;
    }

    function dato(caja, etiqueta, valor) {
        if (
            valor !== "" &&
            valor !== null &&
            valor !== undefined
        ) {
            caja.appendChild(
                texto("p", `${etiqueta}: ${valor}`)
            );
        }
    }

    function botonAccion(nombre, funcion) {
        const b = texto("button", nombre);

        b.type = "button";
        b.addEventListener("click", funcion);

        return b;
    }

    function vacio(caja, mensaje) {
        caja.replaceChildren();

        const estado = document.createElement("div");
        estado.className = "empty-state";

        estado.appendChild(
            texto("p", mensaje)
        );

        caja.appendChild(estado);
    }

    // ======================================
    // 5. CALCULAR CANTIDADES
    // ======================================

    function cantidad(equipo) {
        const n = Number(equipo.cantidad);

        return Number.isInteger(n) && n > 0
            ? n
            : 0;
    }

    function sumar(filtro) {
        return equipos
            .filter(filtro)
            .reduce(
                (acum, equipo) =>
                    acum + cantidad(equipo),
                0
            );
    }

    function actualizarIndicadores() {
        $("inventario-total").textContent =
            sumar(() => true);

        $("inventario-disponibles").textContent =
            sumar(e =>
                e.estado === "disponible"
            );

        $("inventario-uso").textContent =
            sumar(e =>
                ["uso", "prestado"].includes(e.estado)
            );

        $("inventario-incidencias").textContent =
            sumar(e =>
                ["mantenimiento", "danado"]
                    .includes(e.estado) ||
                ["observacion", "defectuoso"]
                    .includes(e.condicion)
            );
    }

    // ======================================
    // 6. CREAR TARJETA DE EQUIPO
    // ======================================

    function tarjeta(equipo, conAcciones = true) {
        const caja = document.createElement("article");
        caja.className = "production-card";

        caja.appendChild(
            texto("h3", equipo.nombre || "Equipo sin nombre")
        );

        dato(
            caja, "Categoría",
            CATEGORIAS[equipo.categoria] || equipo.categoria
        );

        dato(caja, "Marca", equipo.marca);
        dato(caja, "Modelo", equipo.modelo);
        dato(caja, "Código", equipo.codigo);
        dato(caja, "Serie", equipo.serie);
        dato(caja, "Cantidad", cantidad(equipo));

        dato(
            caja, "Estado",
            ESTADOS[equipo.estado] || equipo.estado
        );

        dato(
            caja, "Condición",
            CONDICIONES[equipo.condicion] || equipo.condicion
        );

        dato(caja, "Ubicación", equipo.ubicacion);
        dato(caja, "Responsable", equipo.responsable);
        dato(caja, "Registrado", equipo.fecha);

        dato(
            caja, "Próxima revisión",
            equipo.mantenimiento
        );

        dato(caja, "Accesorios", equipo.accesorios);
        dato(caja, "Observaciones", equipo.observaciones);

        // Avisar sobre revisiones vencidas.

        if (
            equipo.mantenimiento &&
            equipo.mantenimiento < hoy() &&
            equipo.estado !== "baja"
        ) {
            const aviso = texto(
                "p",
                "Revisión pendiente o vencida"
            );

            aviso.style.color = "#ff4058";
            aviso.style.fontWeight = "700";

            caja.appendChild(aviso);
        }

        // Botones de edición y eliminación.

        if (conAcciones) {
            const acciones = document.createElement("div");
            acciones.className = "form-actions";

            acciones.append(
                botonAccion(
                    "Editar",
                    () => editarEquipo(equipo.id)
                ),
                botonAccion(
                    "Eliminar",
                    () => eliminarEquipo(equipo.id)
                )
            );

            caja.appendChild(acciones);
        }

        return caja;
    }

    // ======================================
    // 7. BUSQUEDA Y FILTROS
    // ======================================

    function normalizar(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function mostrarEquipos() {
        const termino = normalizar(
            buscar.value.trim()
        );

        const categoria = filtroCategoria.value;
        const estado = filtroEstado.value;

        const filtrados = equipos
            .filter(e => {
                const indice = normalizar([
                    e.nombre,
                    e.marca,
                    e.modelo,
                    e.codigo,
                    e.serie,
                    e.ubicacion,
                    e.responsable
                ].join(" "));

                return (
                    (!termino || indice.includes(termino)) &&
                    (
                        categoria === "todos" ||
                        e.categoria === categoria
                    ) &&
                    (
                        estado === "todos" ||
                        e.estado === estado
                    )
                );
            })
            .sort((a, b) =>
                String(a.nombre).localeCompare(
                    String(b.nombre), "es"
                )
            );

        lista.replaceChildren();

        if (!filtrados.length) {
            vacio(
                lista,
                equipos.length
                    ? "No hay equipos que coincidan con los filtros."
                    : "Aún no hay equipos registrados."
            );
        } else {
            filtrados.forEach(e =>
                lista.appendChild(tarjeta(e))
            );
        }

        // Control de equipos asignados o con problemas.

        const especiales = equipos.filter(e =>
            [
                "uso",
                "prestado",
                "mantenimiento",
                "danado",
                "baja"
            ].includes(e.estado)
        );

        control.replaceChildren();

        if (!especiales.length) {
            vacio(
                control,
                "No hay equipos en uso, prestados o con incidencias."
            );
        } else {
            especiales.forEach(e =>
                control.appendChild(tarjeta(e, false))
            );
        }

        exportar.disabled = false;
    }

    function refrescar() {
        actualizarIndicadores();
        mostrarEquipos();
    }

    // ======================================
    // 8. GUARDAR EQUIPO
    // ======================================

    form.addEventListener("submit", async evento => {
        evento.preventDefault();

        if (!nubeLista || procesando) {
            alert("Primero espera a que Inventario se conecte a Supabase.");
            return;
        }
        if (!form.reportValidity()) return;

        const equipo = {
            id: idEditando || nuevoId(),
            nombre: $("equipo-nombre").value.trim(),
            categoria: $("equipo-categoria").value,
            marca: $("equipo-marca").value.trim(),
            modelo: $("equipo-modelo").value.trim(),
            codigo: $("equipo-codigo").value.trim(),
            serie: $("equipo-serie").value.trim(),
            cantidad: Number($("equipo-cantidad").value),
            estado: $("equipo-estado").value,
            condicion: $("equipo-condicion").value,
            ubicacion: $("equipo-ubicacion").value.trim(),
            responsable: $("equipo-responsable").value.trim(),
            fecha: $("equipo-fecha").value,
            mantenimiento: $("equipo-mantenimiento").value,
            accesorios: $("equipo-accesorios").value.trim(),
            observaciones: $("equipo-observaciones").value.trim()
        };

        if (!equipo.nombre || !Number.isInteger(equipo.cantidad) || equipo.cantidad < 1) {
            alert("Indica un nombre y una cantidad entera mayor que cero.");
            return;
        }

        const duplicado = equipos.some(e =>
            String(e.id) !== String(equipo.id) &&
            ((equipo.codigo && normalizar(e.codigo) === normalizar(equipo.codigo)) ||
             (equipo.serie && normalizar(e.serie) === normalizar(equipo.serie)))
        );
        if (duplicado) {
            alert("Ya existe otro equipo con ese código o número de serie.");
            return;
        }

        procesando = true;
        boton.disabled = true;
        try {
            await subirEquipo(equipo, Boolean(idEditando));

            equipos = idEditando
                ? equipos.map(e => String(e.id) === String(equipo.id) ? equipo : e)
                : [...equipos, equipo];

            guardar();
            idEditando = null;
            form.reset();
            boton.textContent = "Guardar equipo";
            refrescar();
            actualizarPanelNube();
            alert("¡Equipo guardado en Supabase correctamente!");
        } catch (error) {
            console.error("Error al guardar en Supabase:", error);
            alert("No se guardó el equipo en la nube. " + error.message);
        } finally {
            procesando = false;
            boton.disabled = !nubeLista;
        }
    });

    // ======================================
    // 9. EDITAR EQUIPO
    // ======================================

    function editarEquipo(id) {
        const equipo = equipos.find(e => e.id === id);

        if (!equipo) return;

        idEditando = id;

        const campos = {
            "equipo-nombre": "nombre",
            "equipo-categoria": "categoria",
            "equipo-marca": "marca",
            "equipo-modelo": "modelo",
            "equipo-codigo": "codigo",
            "equipo-serie": "serie",
            "equipo-cantidad": "cantidad",
            "equipo-estado": "estado",
            "equipo-condicion": "condicion",
            "equipo-ubicacion": "ubicacion",
            "equipo-responsable": "responsable",
            "equipo-fecha": "fecha",
            "equipo-mantenimiento": "mantenimiento",
            "equipo-accesorios": "accesorios",
            "equipo-observaciones": "observaciones"
        };

        Object.entries(campos).forEach(
            ([idCampo, propiedad]) => {
                $(idCampo).value =
                    equipo[propiedad] ?? "";
            }
        );

        boton.textContent = "Guardar cambios";

        $("nuevo-equipo").scrollIntoView({
            behavior: "smooth"
        });
    }

    // ======================================
    // 10. ELIMINAR EQUIPO
    // ======================================

    async function eliminarEquipo(id) {
        if (!nubeLista || procesando) return;
        const equipo = equipos.find(e => String(e.id) === String(id));
        if (!equipo || !confirm(`¿Eliminar ${equipo.nombre} del inventario en Supabase?`)) return;

        procesando = true;
        boton.disabled = true;
        try {
            const version = versiones.get(String(id));
            if (!version) throw new Error("No se encontró la versión del equipo. Actualiza desde Supabase.");

            const { data, error } = await db
                .from("registros_modulos")
                .delete()
                .eq("estudio_id", estudioId)
                .eq("modulo", MODULO_REMOTO)
                .eq("registro_clave", String(id))
                .eq("actualizado_en", version)
                .select("id");

            if (error) throw error;
            if (!data?.length) throw new Error("Alguien cambió este equipo. Actualiza desde Supabase antes de eliminar.");

            equipos = equipos.filter(e => String(e.id) !== String(id));
            versiones.delete(String(id));
            guardar();
            if (String(idEditando) === String(id)) form.reset();
            refrescar();
            actualizarPanelNube();
        } catch (error) {
            console.error("Error al eliminar:", error);
            alert("No se pudo eliminar en Supabase. " + error.message);
        } finally {
            procesando = false;
            boton.disabled = !nubeLista;
        }
    }

    // ======================================
    // 11. LIMPIAR FORMULARIO
    // ======================================

    form.addEventListener("reset", () => {
        idEditando = null;
        boton.textContent = "Guardar equipo";

        setTimeout(() => {
            if (!$("equipo-fecha").value) {
                $("equipo-fecha").value = hoy();
            }
        }, 0);
    });

    // ======================================
    // 12. EXPORTAR INVENTARIO PARA EXCEL
    // ======================================

    function valorCsv(valor) {
        let cadena = String(valor ?? "");

        // Evita que Excel ejecute fórmulas
        // introducidas como texto.
        if (/^\s*[=+@-]/.test(cadena)) {
            cadena = "'" + cadena;
        }

        return '"' +
            cadena.replace(/"/g, '""') +
            '"';
    }

    function exportarCSV() {
        if (!equipos.length) return;

        const columnas = [
            ["Nombre", "nombre"],
            ["Categoría", "categoria"],
            ["Marca", "marca"],
            ["Modelo", "modelo"],
            ["Código", "codigo"],
            ["Serie", "serie"],
            ["Cantidad", "cantidad"],
            ["Estado", "estado"],
            ["Condición", "condicion"],
            ["Ubicación", "ubicacion"],
            ["Responsable", "responsable"],
            ["Fecha registro", "fecha"],
            ["Próxima revisión", "mantenimiento"],
            ["Accesorios", "accesorios"],
            ["Observaciones", "observaciones"]
        ];

        const lineas = [
            columnas
                .map(([nombre]) => valorCsv(nombre))
                .join(";")
        ];

        equipos.forEach(e => {
            lineas.push(
                columnas
                    .map(([, propiedad]) =>
                        valorCsv(e[propiedad])
                    )
                    .join(";")
            );
        });

        const blob = new Blob(
            ["\ufeff" + lineas.join("\r\n")],
            { type: "text/csv;charset=utf-8" }
        );

        const url = URL.createObjectURL(blob);

        const enlace = document.createElement("a");

        enlace.href = url;
        enlace.download =
            `inventario-audiovisual-${hoy()}.csv`;

        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    
/* ==========================================
   ABREGU STUDIOS
   GENERADOR DE INFORMES PDF
========================================== */

function exportarPDF() {

    if (!window.jspdf?.jsPDF) {
        alert(
            "No se cargó la biblioteca para generar PDF. " +
            "Revisa tu conexión a Internet y recarga la página."
        );
        return;
    }

    // 1. Obtener la categoría seleccionada

    const categoriaElegida =
        $("reporte-categoria").value;

    const seleccionados = equipos

        .filter(e =>
            categoriaElegida === "todos" ||
            e.categoria === categoriaElegida
        )

        .sort((a, b) =>
            String(a.nombre || "").localeCompare(
                String(b.nombre || ""),
                "es"
            )
        );

    // 2. Crear documento A4

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
    });

    const margen = 16;
    const ancho = 178;

    let y = 0;

    // ======================================
    // ENCABEZADO DE CADA PAGINA
    // ======================================

    function iniciarPagina(nueva = false) {

        if (nueva) {
            pdf.addPage();
        }

        pdf.setFillColor(23, 20, 22);
        pdf.rect(0, 0, 210, 40, "F");

        pdf.setTextColor(245, 235, 214);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(19);

        pdf.text(
            "ABREGU STUDIOS",
            margen,
            19
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        pdf.text(
            "INFORME DE INVENTARIO AUDIOVISUAL",
            margen,
            27
        );

        pdf.setFillColor(199, 49, 55);

        pdf.rect(
            margen,
            33,
            48,
            1.5,
            "F"
        );

        y = 49;
    }

    // ======================================
    // SALTOS DE PAGINA
    // ======================================

    function comprobarEspacio(alto) {

        if (y + alto > 279) {
            iniciarPagina(true);
        }
    }

    // ======================================
    // ESCRIBIR CAMPOS DEL EQUIPO
    // ======================================

    function escribirLinea(etiqueta, valor) {

        const cadena =
            valor === undefined ||
            valor === null ||
            String(valor).trim() === ""

                ? "No registrado"
                : String(valor);

        const partes = pdf.splitTextToSize(
            `${etiqueta}: ${cadena}`,
            ancho
        );

        pdf.setTextColor(52, 49, 50);

        pdf.setFont(
            "helvetica",
            "normal"
        );

        pdf.setFontSize(9.5);

        partes.forEach(parte => {

            comprobarEspacio(5);

            pdf.text(
                parte,
                margen + 1,
                y
            );

            y += 5;
        });
    }

    // ======================================
    // TITULO Y RESUMEN
    // ======================================

    iniciarPagina();

    const titulo =
        categoriaElegida === "todos"

            ? "INVENTARIO GENERAL"

            : "CATEGORÍA: " +
              (
                  CATEGORIAS[categoriaElegida] ||
                  categoriaElegida
              ).toUpperCase();

    pdf.setTextColor(26, 24, 25);

    pdf.setFont(
        "helvetica",
        "bold"
    );

    pdf.setFontSize(14);

    pdf.text(
        pdf.splitTextToSize(
            titulo,
            ancho
        ),
        margen,
        y
    );

    y += 10;

    const unidades = seleccionados.reduce(
        (suma, equipo) => {

            const n = Number(equipo.cantidad);

            return suma + (
                Number.isInteger(n) && n > 0
                    ? n
                    : 0
            );
        },
        0
    );

    escribirLinea(
        "Fecha de emisión",
        hoy()
    );

    escribirLinea(
        "Responsable",
        "SAMGIUK INGA"
    );

    escribirLinea(
        "Fichas registradas",
        seleccionados.length
    );

    escribirLinea(
        "Unidades registradas",
        unidades
    );

    y += 7;

    // ======================================
    // ORGANIZAR POR CATEGORIAS
    // ======================================

    if (!seleccionados.length) {

        escribirLinea(
            "Observación",
            "No hay equipos registrados en esta selección."
        );

    } else {

        const categorias =
            categoriaElegida === "todos"

                ? Object.keys(CATEGORIAS)

                : [categoriaElegida];

        categorias.forEach(categoria => {

            const grupo = seleccionados.filter(
                e => e.categoria === categoria
            );

            if (!grupo.length) {
                return;
            }

            comprobarEspacio(16);

            // Cabecera de categoría

            pdf.setFillColor(
                239, 236, 230
            );

            pdf.rect(
                margen,
                y - 5,
                ancho,
                10,
                "F"
            );

            pdf.setTextColor(
                53, 40, 39
            );

            pdf.setFont(
                "helvetica",
                "bold"
            );

            pdf.setFontSize(10);

            pdf.text(
                (
                    CATEGORIAS[categoria] ||
                    categoria
                ).toUpperCase(),

                margen + 3,
                y + 1
            );

            y += 13;

            // ==================================
            // EQUIPOS DE LA CATEGORIA
            // ==================================

            grupo.forEach((equipo, indice) => {

                comprobarEspacio(18);

                pdf.setDrawColor(
                    202, 64, 69
                );

                pdf.setLineWidth(0.3);

                pdf.line(
                    margen,
                    y - 4,
                    margen + ancho,
                    y - 4
                );

                pdf.setTextColor(
                    26, 24, 25
                );

                pdf.setFont(
                    "helvetica",
                    "bold"
                );

                pdf.setFontSize(11);

                const tituloEquipo =
                    pdf.splitTextToSize(

                        `${indice + 1}. ` +
                        `${equipo.nombre || "Equipo sin nombre"}`,

                        ancho
                    );

                tituloEquipo.forEach(linea => {

                    comprobarEspacio(6);

                    pdf.text(
                        linea,
                        margen,
                        y
                    );

                    y += 6;
                });

                escribirLinea(
                    "Marca / modelo",

                    [
                        equipo.marca,
                        equipo.modelo
                    ].filter(Boolean).join(" / ")
                );

                escribirLinea(
                    "Cantidad",
                    equipo.cantidad
                );

                escribirLinea(
                    "Código interno",
                    equipo.codigo
                );

                escribirLinea(
                    "Número de serie",
                    equipo.serie
                );

                escribirLinea(
                    "Estado",

                    ESTADOS[equipo.estado] ||
                    equipo.estado
                );

                escribirLinea(
                    "Condición",

                    CONDICIONES[equipo.condicion] ||
                    equipo.condicion
                );

                escribirLinea(
                    "Ubicación",
                    equipo.ubicacion
                );

                escribirLinea(
                    "Responsable",
                    equipo.responsable
                );

                escribirLinea(
                    "Registro",
                    equipo.fecha
                );

                escribirLinea(
                    "Próxima revisión",
                    equipo.mantenimiento
                );

                escribirLinea(
                    "Accesorios",
                    equipo.accesorios
                );

                escribirLinea(
                    "Observaciones",
                    equipo.observaciones
                );

                y += 8;
            });
        });
    }

    // ======================================
    // PIE DE PAGINA Y NUMERACION
    // ======================================

    const paginas = pdf.getNumberOfPages();

    for (
        let pagina = 1;
        pagina <= paginas;
        pagina++
    ) {

        pdf.setPage(pagina);

        pdf.setDrawColor(
            205, 205, 205
        );

        pdf.line(
            margen,
            286,
            210 - margen,
            286
        );

        pdf.setTextColor(
            115, 110, 108
        );

        pdf.setFont(
            "helvetica",
            "normal"
        );

        pdf.setFontSize(8);

        pdf.text(
            "ABREGU STUDIOS | Control de activos audiovisuales",
            margen,
            291
        );

        pdf.text(
            `${pagina} / ${paginas}`,
            210 - margen,
            291,
            { align: "right" }
        );
    }

    // ======================================
    // DESCARGAR PDF
    // ======================================

    const archivo =
        categoriaElegida === "todos"

            ? "general"

            : categoriaElegida;

    pdf.save(
        `inventario-${archivo}-${hoy()}.pdf`
    );
}

/* ==========================================
   ABREGU STUDIOS
   INFORMES PDF SIN BIBLIOTECAS EXTERNAS
========================================== */

function imprimirInventario() {

    const clave =
        $("reporte-categoria")?.value || "todos";

    const seleccionados = equipos.filter(e =>
        clave === "todos" ||
        e.categoria === clave
    );

    // Evitar interpretar los datos del usuario
    // como código HTML.

    const escapar = valor =>
        String(valor ?? "No registrado")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    function campo(etiqueta, valor) {

        return `
            <div class="dato">
                <strong>${escapar(etiqueta)}:</strong>
                ${escapar(
                    valor === ""
                        ? "No registrado"
                        : valor
                )}
            </div>
        `;
    }

    // Total de unidades seleccionadas.

    const total = seleccionados.reduce(
        (suma, e) => {

            const n = Number(e.cantidad);

            return suma + (
                Number.isInteger(n) && n > 0
                    ? n
                    : 0
            );
        },
        0
    );

    // Agrupar por categoría.

    const grupos = (
        clave === "todos"
            ? Object.keys(CATEGORIAS)
            : [clave]
    )
        .map(categoria => ({
            categoria,
            items: seleccionados.filter(
                e => e.categoria === categoria
            )
        }))
        .filter(grupo => grupo.items.length > 0);

    // Crear fichas de cada equipo.

    const contenido = grupos.map(grupo => `

        <section class="grupo">

            <h2>
                ${escapar(
                    CATEGORIAS[grupo.categoria] ||
                    grupo.categoria
                )}
            </h2>

            ${grupo.items.map((e, i) => `

                <article class="ficha">

                    <h3>
                        ${i + 1}.
                        ${escapar(
                            e.nombre || "Equipo sin nombre"
                        )}
                    </h3>

                    <div class="datos">

                        ${campo("Marca", e.marca)}
                        ${campo("Modelo", e.modelo)}
                        ${campo("Cantidad", e.cantidad)}
                        ${campo("Código", e.codigo)}
                        ${campo("Serie", e.serie)}

                        ${campo(
                            "Estado",
                            ESTADOS[e.estado] || e.estado
                        )}

                        ${campo(
                            "Condición",
                            CONDICIONES[e.condicion] ||
                            e.condicion
                        )}

                        ${campo("Ubicación", e.ubicacion)}
                        ${campo("Responsable", e.responsable)}
                        ${campo("Registro", e.fecha)}
                        ${campo(
                            "Próxima revisión",
                            e.mantenimiento
                        )}
                        ${campo("Accesorios", e.accesorios)}
                        ${campo(
                            "Observaciones",
                            e.observaciones
                        )}

                    </div>

                </article>

            `).join("")}

        </section>

    `).join("") ||
    "<p>No hay equipos registrados en esta categoría.</p>";

    const nombreCategoria =
        clave === "todos"
            ? "Inventario general"
            : CATEGORIAS[clave] || clave;

    // Abrir ventana del informe.

    const ventana = window.open(
        "",
        "_blank",
        "width=950,height=750"
    );

    if (!ventana) {

        alert(
            "Permite ventanas emergentes para " +
            "este sitio y vuelve a descargar."
        );

        return;
    }

    ventana.document.open();

    ventana.document.write(`

<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">

<title>
ABREGU_STUDIOS_inventario_${escapar(clave)}_${hoy()}
</title>

<style>

@page {
    size: A4;
    margin: 17mm;
}

* {
    box-sizing: border-box;
}

body {
    font: 12px/1.5 Arial, sans-serif;
    color: #201d1e;
    background: white;
    margin: 35px auto;
    max-width: 820px;
    padding: 0 25px;
}

header {
    border-bottom: 3px solid #bd343e;
    padding-bottom: 15px;
    margin-bottom: 20px;
}

.marca {
    font-size: 27px;
    font-weight: 800;
    letter-spacing: 1px;
}

.sub {
    font-size: 10px;
    letter-spacing: 2px;
    margin-top: 5px;
}

h1 {
    font-size: 20px;
}

h2 {
    font-size: 15px;
    border-bottom: 1px solid #c8bcbc;
    padding: 9px 0 5px;
    margin: 24px 0 12px;
}

h3 {
    font-size: 13px;
    margin: 0 0 8px;
}

.resumen {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    margin: 15px 0 20px;
}

.resumen span {
    border: 1px solid #ddd;
    padding: 7px 12px;
}

.ficha {
    border: 1px solid #d6d3d1;
    border-left: 3px solid #ba3741;
    padding: 12px;
    margin-bottom: 12px;
    break-inside: avoid;
    page-break-inside: avoid;
}

.datos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px 14px;
}

.dato {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.dato strong {
    color: #4d4342;
}

.acciones {
    margin-bottom: 25px;
    padding: 12px;
    background: #f4f1ef;
}

button {
    padding: 12px 15px;
    border: 0;
    background: #a52c37;
    color: white;
    font-weight: bold;
    border-radius: 5px;
    cursor: pointer;
}

footer {
    margin-top: 30px;
    padding-top: 12px;
    border-top: 1px solid #aaa;
    font-size: 10px;
}

@media print {

    body {
        margin: 0;
        max-width: none;
        padding: 0;
    }

    .acciones {
        display: none;
    }
}

</style>

</head>

<body>

<div class="acciones">

    <button onclick="window.print()">
        Imprimir / Guardar como PDF
    </button>

    <span>
        En Destino selecciona
        "Guardar como PDF".
    </span>

</div>

<header>

    <div class="marca">
        ABREGU STUDIOS
    </div>

    <div class="sub">
        CONTROL DE ACTIVOS AUDIOVISUALES
    </div>

</header>

<h1>${escapar(nombreCategoria)}</h1>

<div class="resumen">

    <span>Fecha: ${escapar(hoy())}</span>

    <span>
        Fichas: ${seleccionados.length}
    </span>

    <span>
        Unidades: ${total}
    </span>

</div>

<p>
    <strong>Responsable:</strong>
    SAMGIUK INGA
</p>

${contenido}

<footer>
    ABREGU STUDIOS |
    Informe de inventario audiovisual
</footer>

</body>
</html>

    `);

    ventana.document.close();
    ventana.focus();
}

    // ======================================
    // 13. ACTIVAR CONTROLES
    // ======================================

    buscar.disabled = false;
    filtroCategoria.disabled = false;
    filtroEstado.disabled = false;
    boton.disabled = false;

    $("equipo-fecha").value = hoy();

    buscar.addEventListener(
        "input",
        mostrarEquipos
    );

    filtroCategoria.addEventListener(
        "change",
        mostrarEquipos
    );

    filtroEstado.addEventListener(
        "change",
        mostrarEquipos
    );

 exportar.addEventListener(
    "click",
    imprimirInventario
); 

    // ======================================
    // 14. INICIAR INVENTARIO
    // ======================================

    const ayuda = form.querySelector(".helper-text");

    if (ayuda) {
        ayuda.textContent =
            "Los datos se guardan en este navegador. " +
            "Registra cada unidad por separado si tiene " +
            "código, serie, estado o responsable distinto.";
    }

    
/* ==========================================
   ABREGU STUDIOS
   NAVEGACION DEL INVENTARIO POR CATEGORIAS
========================================== */

const seccionCategorias = Array.from(
    document.querySelectorAll(
        "section.dashboard-section"
    )
).find(seccion =>
    seccion.querySelector(".section-header h2")
        ?.textContent.trim() ===
        "Categorías de equipamiento"
);

const seccionDetalle = lista.closest(
    ".dashboard-section"
);

if (seccionCategorias && seccionDetalle) {

    const categorias = [
        "computacion",
        "camaras",
        "lentes",
        "audio",
        "iluminacion",
        "cables",
        "soportes",
        "otros"
    ];

    const tarjetas = Array.from(
        seccionCategorias.querySelectorAll(
            ".productions-list > .production-card"
        )
    );

    // 1. Convertir el inventario general
    // en un panel de categoría seleccionada.

    seccionDetalle.id = "detalle-categoria";

    seccionDetalle.querySelector(
        ".section-header h2"
    ).textContent = "Equipos de la categoría";

    seccionDetalle.querySelector(
        ".section-header p"
    ).textContent =
        "Selecciona una categoría para consultar sus equipos.";

    // Mover el panel debajo de las categorías.

    seccionCategorias.insertAdjacentElement(
        "afterend",
        seccionDetalle
    );

    // Ocultarlo hasta seleccionar una categoría.

    seccionDetalle.style.display = "none";

    // 2. Ocultar el selector de categoría
    // porque ahora utilizaremos las tarjetas.

    const etiquetaCategoria =
        seccionDetalle.querySelector(
            'label[for="filtro-categoria"]'
        );

    if (etiquetaCategoria) {
        etiquetaCategoria.style.display = "none";
    }

    filtroCategoria.style.display = "none";

    // El buscador y el filtro de estado
    // se mantienen dentro del panel.

    // 3. Agregar estilos interactivos.

    const estilosCategoria =
        document.createElement("style");

    estilosCategoria.textContent = `

        .categoria-inventario {
            cursor: pointer;
            position: relative;
            transition:
                border-color .2s ease,
                transform .2s ease,
                background .2s ease;
        }

        .categoria-inventario:hover {
            border-color: #e2394f;
            transform: translateY(-2px);
            background: #21191d;
        }

        .categoria-inventario:focus-visible {
            outline: 2px solid #e2394f;
            outline-offset: 3px;
        }

        .categoria-inventario.activa {
            border-color: #e2394f;
            background: #24171c;
        }

        .categoria-contador {
            display: inline-block;
            margin-top: 12px;
            padding: 5px 11px;
            border-radius: 20px;
            background: #302428;
            color: #f5e9db;
            font-size: 12px;
            font-weight: 600;
        }

        #detalle-categoria {
            scroll-margin-top: 20px;
        }
    `;

    document.head.appendChild(estilosCategoria);

    // 4. Mostrar equipos de una categoría.

    function abrirCategoria(clave, tarjetaActiva) {

        // Limpiar filtros anteriores.

        buscar.value = "";
        filtroEstado.value = "todos";

        // Seleccionar la categoría.

        filtroCategoria.value = clave;

        // Actualizar el título.

        seccionDetalle.querySelector(
            ".section-header h2"
        ).textContent =
            "Equipos — " +
            (CATEGORIAS[clave] || clave);

        seccionDetalle.querySelector(
            ".section-header p"
        ).textContent =
            "Equipos registrados, responsables y estado actual.";

        // Mostrar el panel.

        seccionDetalle.style.display = "";

        // Resaltar la categoría seleccionada.

        tarjetas.forEach(tarjeta => {

            const activa =
                tarjeta === tarjetaActiva;

            tarjeta.classList.toggle(
                "activa",
                activa
            );

            tarjeta.setAttribute(
                "aria-expanded",
                String(activa)
            );
        });

        // Utilizar el filtro que ya funciona
        // en el inventario original.

        mostrarEquipos();

        // Llevar al usuario hasta los equipos.

        seccionDetalle.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // 5. Convertir las ocho tarjetas
    // en elementos interactivos.

    tarjetas.forEach((tarjeta, indice) => {

        const clave = categorias[indice];

        if (!clave) return;

        tarjeta.classList.add(
            "categoria-inventario"
        );

        tarjeta.setAttribute("role", "button");
        tarjeta.setAttribute("tabindex", "0");

        tarjeta.setAttribute(
            "aria-controls",
            "detalle-categoria"
        );

        tarjeta.setAttribute(
            "aria-expanded",
            "false"
        );

        const contador =
            document.createElement("span");

        contador.className =
            "categoria-contador";

        contador.textContent = "0 equipos";

        tarjeta.appendChild(contador);

        // Clic con mouse.

        tarjeta.addEventListener(
            "click",
            () => abrirCategoria(clave, tarjeta)
        );

        // Acceso por teclado.

        tarjeta.addEventListener(
            "keydown",
            evento => {

                if (
                    evento.key === "Enter" ||
                    evento.key === " "
                ) {

                    evento.preventDefault();

                    abrirCategoria(clave, tarjeta);
                }
            }
        );
    });

    // 6. Actualizar cantidad por categoría.

    function actualizarContadoresCategorias() {

        tarjetas.forEach((tarjeta, indice) => {

            const clave = categorias[indice];

            const total = equipos
                .filter(equipo =>
                    equipo.categoria === clave
                )
                .reduce((suma, equipo) => {

                    const unidades =
                        Number(equipo.cantidad);

                    return suma + (
                        Number.isInteger(unidades) &&
                        unidades > 0
                            ? unidades
                            : 0
                    );

                }, 0);

            const contador =
                tarjeta.querySelector(
                    ".categoria-contador"
                );

            if (contador) {

                contador.textContent =
                    `${total} ` +
                    (
                        total === 1
                            ? "equipo"
                            : "equipos"
                    );
            }
        });
    }

    // Se actualizan automáticamente cuando
    // se registra, edita o elimina un equipo.

    const observadorInventario =
        new MutationObserver(
            actualizarContadoresCategorias
        );

    observadorInventario.observe(
        lista,
        { childList: true }
    );

    actualizarContadoresCategorias();
}

    // ======================================
    // 15. CONEXIÓN SEGURA CON SUPABASE
    // ======================================

    // El respaldo es intencionalmente distinto de aa_inventario.
    // No se borra, incluso después de importar correctamente.
    function preservarRespaldoInicial() {
        if (!equiposLocalesIniciales.length) return;
        if (localStorage.getItem(CLAVE_RESPALDO)) return;
        try {
            localStorage.setItem(
                CLAVE_RESPALDO,
                JSON.stringify(equiposLocalesIniciales)
            );
        } catch (error) {
            console.error("No se pudo crear el respaldo local:", error);
            throw new Error(
                "No hay espacio para respaldar el inventario anterior. " +
                "Exporta un respaldo desde Configuración antes de continuar."
            );
        }
    }

    function leerRespaldo() {
        try {
            const respaldo = JSON.parse(
                localStorage.getItem(CLAVE_RESPALDO) || "[]"
            );
            return Array.isArray(respaldo) ? respaldo : [];
        } catch {
            return [];
        }
    }

    const panelNube = document.createElement("div");
    panelNube.style.cssText =
        "padding:16px;margin:14px 0;border:1px solid #70525a;" +
        "border-radius:12px;background:#211a1f;color:#f1e8e0;";

    const estadoNube = document.createElement("p");
    estadoNube.textContent = "Supabase: conectando...";
    estadoNube.setAttribute("role", "status");

    const botonActualizar = document.createElement("button");
    botonActualizar.type = "button";
    botonActualizar.textContent = "Actualizar desde Supabase";
    botonActualizar.disabled = true;

    const botonMigrar = document.createElement("button");
    botonMigrar.type = "button";
    botonMigrar.textContent = "Importar equipos locales a Supabase";
    botonMigrar.hidden = true;
    botonMigrar.disabled = true;

    const botonRespaldo = document.createElement("button");
    botonRespaldo.type = "button";
    botonRespaldo.textContent = "Descargar respaldo local";
    botonRespaldo.hidden = true;

    const grupoBotones = document.createElement("div");
    grupoBotones.className = "form-actions";
    grupoBotones.append(botonActualizar, botonMigrar, botonRespaldo);
    panelNube.append(estadoNube, grupoBotones);

    const seccionRegistro = $("nuevo-equipo");
    const cabeceraRegistro = seccionRegistro?.querySelector(".section-header");
    if (cabeceraRegistro) cabeceraRegistro.after(panelNube);
    else form.before(panelNube);

    function pendientesDeImportar() {
        const idsNube = new Set(equipos.map(e => String(e.id)));
        return leerRespaldo().filter(e =>
            e && e.id != null && !idsNube.has(String(e.id))
        );
    }

    function actualizarPanelNube(mensaje) {
        const pendientes = nubeLista ? pendientesDeImportar().length : 0;
        estadoNube.textContent = mensaje || (
            nubeLista
                ? `Supabase conectado: ${equipos.length} fichas en la nube.` +
                  (pendientes ? ` ${pendientes} registros locales pendientes de importar.` : "")
                : "Supabase: sin conexión; las modificaciones están bloqueadas."
        );
        botonActualizar.disabled = !nubeLista || procesando;
        botonMigrar.hidden = !nubeLista || !pendientes;
        botonMigrar.disabled = !nubeLista || procesando;
        botonRespaldo.hidden = !leerRespaldo().length;
    }

    function descargarRespaldoLocal() {
        const contenido = localStorage.getItem(CLAVE_RESPALDO);
        if (!contenido) return;
        const url = URL.createObjectURL(new Blob(
            [contenido], { type: "application/json;charset=utf-8" }
        ));
        const a = document.createElement("a");
        a.href = url;
        a.download = `inventario-respaldo-pre-supabase-${hoy()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    botonRespaldo.addEventListener("click", descargarRespaldoLocal);

    async function filasRemotas() {
        const todas = [];
        const tamano = 200;
        for (let desde = 0; ; desde += tamano) {
            const { data, error } = await db
                .from("registros_modulos")
                .select("registro_clave,contenido,actualizado_en")
                .eq("estudio_id", estudioId)
                .eq("modulo", MODULO_REMOTO)
                .order("registro_clave", { ascending: true })
                .range(desde, desde + tamano - 1);
            if (error) throw error;
            todas.push(...(data || []));
            if (!data || data.length < tamano) break;
        }
        return todas;
    }

    async function recargarInventarioNube() {
        if (!nubeLista || procesando) return;
        procesando = true;
        boton.disabled = true;
        actualizarPanelNube("Actualizando inventario desde Supabase...");
        try {
            const filas = await filasRemotas();
            versiones.clear();
            equipos = filas.map(fila => {
                versiones.set(String(fila.registro_clave), fila.actualizado_en);
                return { ...fila.contenido, id: String(fila.registro_clave) };
            });
            guardar(); // Solo caché local; la nube es la fuente principal.
            refrescar();
        } catch (error) {
            console.error("Error consultando inventario:", error);
            alert("No se pudo actualizar desde Supabase: " + error.message);
        } finally {
            procesando = false;
            boton.disabled = !nubeLista;
            actualizarPanelNube();
        }
    }

    botonActualizar.addEventListener("click", recargarInventarioNube);

    async function subirEquipo(equipo, edicion) {
        if (!nubeLista) throw new Error("No hay conexión autorizada.");
        const ahora = new Date().toISOString();
        const clave = String(equipo.id);

        if (edicion) {
            const version = versiones.get(clave);
            if (!version) throw new Error("La ficha no está sincronizada. Actualiza desde Supabase.");
            const { data, error } = await db
                .from("registros_modulos")
                .update({ contenido: equipo, actualizado_en: ahora })
                .eq("estudio_id", estudioId)
                .eq("modulo", MODULO_REMOTO)
                .eq("registro_clave", clave)
                .eq("actualizado_en", version)
                .select("actualizado_en");
            if (error) throw error;
            if (!data?.length) throw new Error(
                "Otro navegador modificó esta ficha. Actualiza desde Supabase " +
                "antes de guardar para evitar sobrescribir cambios."
            );
            versiones.set(clave, data[0].actualizado_en);
        } else {
            const { data, error } = await db
                .from("registros_modulos")
                .insert({
                    estudio_id: estudioId,
                    modulo: MODULO_REMOTO,
                    registro_clave: clave,
                    contenido: equipo,
                    creado_por: usuarioId,
                    actualizado_en: ahora
                })
                .select("actualizado_en");
            if (error) throw error;
            if (!data?.length) throw new Error("No se confirmó el registro en Supabase.");
            versiones.set(clave, data[0].actualizado_en);
        }
    }

    async function importarRespaldo() {
        if (!nubeLista || procesando) return;

        // Antes de importar, releemos la nube para no pisar IDs existentes.
        await recargarInventarioNube();
        const pendientes = pendientesDeImportar();
        if (!pendientes.length) {
            alert("No quedan registros locales por importar.");
            return;
        }
        if (!confirm(
            `¿Importar ${pendientes.length} fichas del respaldo local? ` +
            "No se sobrescribirán fichas con el mismo ID existentes en Supabase."
        )) return;

        procesando = true;
        boton.disabled = true;
        let importados = 0;
        let omitidos = 0;
        try {
            const codigos = new Set(equipos.map(e => normalizar(e.codigo)).filter(Boolean));
            const series = new Set(equipos.map(e => normalizar(e.serie)).filter(Boolean));

            for (const origen of pendientes) {
                const codigo = normalizar(origen.codigo);
                const serie = normalizar(origen.serie);
                if ((codigo && codigos.has(codigo)) || (serie && series.has(serie))) {
                    omitidos++;
                    continue;
                }
                const equipo = { ...origen, id: String(origen.id) };
                try {
                    await subirEquipo(equipo, false);
                    equipos.push(equipo);
                    importados++;
                    if (codigo) codigos.add(codigo);
                    if (serie) series.add(serie);
                } catch (error) {
                    console.error("Falló importación de", equipo.id, error);
                    // No borramos el respaldo ni reemplazamos un conflicto.
                    omitidos++;
                }
            }
            guardar();
            refrescar();
            alert(
                `Importados: ${importados}. Omitidos o con conflicto: ${omitidos}. ` +
                "El respaldo local se conserva."
            );
        } finally {
            procesando = false;
            boton.disabled = !nubeLista;
            actualizarPanelNube();
        }
    }

    botonMigrar.addEventListener("click", importarRespaldo);

    async function conectarInventario() {
        boton.disabled = true;
        exportar.disabled = true;
        vacio(lista, "Verificando sesión y cargando inventario desde Supabase...");
        try {
            db = window.abreguDB;
            if (!db) throw new Error(
                "No se inicializó Supabase. Revisa los scripts y la conexión."
            );

            const { data: datosUsuario, error: errorUsuario } = await db.auth.getUser();
            const user = datosUsuario?.user;
            if (errorUsuario || !user) throw new Error("Inicia sesión antes de entrar al inventario.");
            usuarioId = user.id;

            const { data: estudio, error: errorEstudio } = await db
                .from("estudios")
                .select("id")
                .eq("propietario_id", usuarioId)
                .maybeSingle();
            if (errorEstudio || !estudio) throw new Error(
                "No se pudo verificar el estudio del propietario: " +
                (errorEstudio?.message || "sin registro")
            );
            estudioId = estudio.id;

            const { data: miembro, error: errorMiembro } = await db
                .from("miembros_estudio")
                .select("rol,activo")
                .eq("estudio_id", estudioId)
                .eq("usuario_id", usuarioId)
                .maybeSingle();
            if (errorMiembro || miembro?.rol !== "administrador" || !miembro?.activo) {
                throw new Error("Esta cuenta no tiene permisos de administrador.");
            }

            // Nunca sustituimos equipos antiguos antes de guardar su respaldo.
            preservarRespaldoInicial();

            const filas = await filasRemotas();
            versiones.clear();
            equipos = filas.map(fila => {
                versiones.set(String(fila.registro_clave), fila.actualizado_en);
                return { ...fila.contenido, id: String(fila.registro_clave) };
            });

            nubeLista = true;
            guardar();
            refrescar();
            actualizarPanelNube();
            console.log("Inventario conectado con Supabase:", equipos.length, "fichas.");
        } catch (error) {
            console.error("No se pudo conectar Inventario:", error);
            nubeLista = false;
            vacio(lista, "No se pudo cargar Supabase. No se han modificado los datos locales.");
            estadoNube.textContent = "Supabase no disponible: " + error.message;
            boton.disabled = true;
            exportar.disabled = true;
            botonActualizar.disabled = true;
            botonMigrar.hidden = true;
            botonRespaldo.hidden = !leerRespaldo().length;
        }
    }

    conectarInventario();

    console.log("Inventario: sincronización segura iniciada.");

});