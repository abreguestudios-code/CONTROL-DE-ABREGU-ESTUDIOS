
/* ==========================================
   ABREGU STUDIOS
   CONEXIÓN CON SUPABASE
========================================== */

// 1. URL de nuestro proyecto
const SUPABASE_URL =
    "https://cbwcbupghigcvvgbyexy.supabase.co";

// 2. Clave pública de Supabase
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_jrqOpcJilInnZ98isX4vww_Mtgvo9kp";

// 3. Crear cliente de Supabase
if (!window.supabase?.createClient) {

    console.error(
        "No se pudo cargar la biblioteca de Supabase."
    );

} else {

    window.abreguDB = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    console.log(
        "ABREGU STUDIOS: cliente Supabase inicializado."
    );
}
