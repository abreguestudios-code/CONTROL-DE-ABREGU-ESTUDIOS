
/* ==========================================
   ABREGU STUDIOS
   PROTECCION DE ACCESO
========================================== */

(async function verificarAcceso() {

    const db = window.abreguDB;

    function irAlLogin() {

        const dentroDePages =
            window.location.pathname.includes("/pages/");

        const ruta = dentroDePages
            ? "login.html"
            : "pages/login.html";

        window.location.replace(ruta);
    }

    try {

        if (!db) {
            irAlLogin();
            return;
        }

        // 1. Verificar usuario autenticado

        const {
            data: { user },
            error
        } = await db.auth.getUser();

        if (error || !user) {
            irAlLogin();
            return;
        }

        // 2. Buscar estudio del propietario

        const { data: estudio, error: errorEstudio } =
            await db
                .from("estudios")
                .select("id, nombre")
                .eq("propietario_id", user.id)
                .maybeSingle();

        if (errorEstudio || !estudio) {
            irAlLogin();
            return;
        }

        // 3. Verificar rol y estado

        const { data: miembro, error: errorMiembro } =
            await db
                .from("miembros_estudio")
                .select("rol, activo")
                .eq("usuario_id", user.id)
                .eq("estudio_id", estudio.id)
                .maybeSingle();

        if (
            errorMiembro ||
            !miembro ||
            miembro.rol !== "administrador" ||
            miembro.activo !== true
        ) {
            irAlLogin();
            return;
        }

        // 4. Mostrar el panel autorizado

        document.documentElement.style.visibility =
            "visible";
            
/* ==========================================
   BOTÓN GLOBAL PARA CERRAR SESIÓN
========================================== */

const menu = document.querySelector(".sidebar-nav");

if (menu && !document.getElementById("cerrar-sesion-global")) {

    const botonSalir = document.createElement("button");

    botonSalir.id = "cerrar-sesion-global";
    botonSalir.type = "button";
    botonSalir.className = "nav-item";

    botonSalir.textContent = "Cerrar sesión";

    botonSalir.style.cssText = `
        display: block;
        width: 100%;
        margin-top: 16px;
        padding: 12px 16px;
        background: transparent;
        color: #ff6074;
        border: 1px solid #71303e;
        border-radius: 8px;
        text-align: left;
        cursor: pointer;
        font: inherit;
    `;

    botonSalir.addEventListener("click", async () => {

        const confirmar = confirm(
            "¿Deseas cerrar tu sesión de ABREGU STUDIOS?"
        );

        if (!confirmar) return;

        botonSalir.disabled = true;
        botonSalir.textContent = "Cerrando sesión...";

        const { error } = await db.auth.signOut({
            scope: "local"
        });

        if (error) {
            console.error(error);

            alert("No se pudo cerrar sesión.");

            botonSalir.disabled = false;
            botonSalir.textContent = "Cerrar sesión";

            return;
        }

        const rutaLogin =
            window.location.pathname.includes("/pages/")
                ? "login.html"
                : "pages/login.html";

        window.location.replace(rutaLogin);
    });

    menu.appendChild(botonSalir);
}


        console.log(
            "ABREGU STUDIOS: acceso autorizado."
        );

    } catch (error) {

        console.error(
            "Error al verificar el acceso:",
            error
        );

        irAlLogin();
    }

})();
