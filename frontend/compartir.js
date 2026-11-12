// Botón "Compartir": muestra el enlace público (Cloudflare) y el de la red local.
(function () {
    "use strict";

    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

    function fila(titulo, enlace, nota, color) {
        return `
            <div class="space-y-2">
                <p class="text-[10px] font-bold uppercase tracking-widest ${color}">${titulo}</p>
                <div class="flex gap-2">
                    <input readonly value="${esc(enlace)}" class="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100">
                    <button type="button" data-copiar="${esc(enlace)}" class="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all">Copiar</button>
                </div>
                <p class="text-[11px] text-slate-500">${nota}</p>
            </div>`;
    }

    async function abrir() {
        let modal = document.getElementById("modal-compartir");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "modal-compartir";
            modal.className = "fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6";
            modal.addEventListener("click", (ev) => {
                if (ev.target === modal || ev.target.closest("[data-cerrar]")) modal.remove();
                const copiar = ev.target.closest("[data-copiar]");
                if (copiar) {
                    navigator.clipboard?.writeText(copiar.dataset.copiar).then(
                        () => { copiar.textContent = "¡Copiado!"; },
                        () => { copiar.textContent = "Selecciónalo y copia"; },
                    );
                }
            });
            document.body.appendChild(modal);
        }
        modal.innerHTML = `
            <div class="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-7 space-y-6 shadow-2xl">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h3 class="text-xl font-black text-white">Compartir MKA</h3>
                        <p class="text-xs text-slate-400 mt-1">Envía este enlace a quien quieras que use el aplicativo.</p>
                    </div>
                    <button type="button" data-cerrar class="text-slate-400 hover:text-white text-xs font-bold">Cerrar</button>
                </div>
                <div id="compartir-contenido" class="space-y-5"><p class="text-xs text-slate-500">Buscando enlaces…</p></div>
            </div>`;

        const caja = modal.querySelector("#compartir-contenido");
        try {
            const datos = await fetch(`${API_URL}/compartir`).then((r) => r.json());
            let html = "";
            if (datos.publico) {
                html += fila("Por internet", datos.publico,
                    "Funciona desde cualquier lugar mientras tu PC tenga MKA encendido. Cambia cada vez que lo enciendes.",
                    "text-emerald-400");
            } else {
                html += `<div class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 leading-relaxed">
                    El enlace por internet no está activo. Ábrelo con el ícono <b>MKA Servicio Tecnico</b> del escritorio
                    (la ventana «MKA - Enlace publico» debe quedar abierta).</div>`;
            }
            if (datos.red_local && datos.red_local.length) {
                html += fila("Misma red Wi-Fi", datos.red_local[0],
                    "Solo para equipos conectados a tu misma red.", "text-cyan-400");
            }
            caja.innerHTML = html;
        } catch (e) {
            caja.innerHTML = `<p class="text-xs text-rose-300">No se pudo consultar la API: ${esc(e.message)}</p>`;
        }
    }

    window.abrirCompartir = abrir;

    // Botón "Base de datos": solo cuando la página se abre en este mismo PC.
    document.addEventListener("DOMContentLoaded", () => {
        const local = ["localhost", "127.0.0.1"].includes(location.hostname);
        const nav = document.querySelector("header nav");
        if (!local || !nav) return;
        const enlace = document.createElement("a");
        enlace.href = "basedatos.html";
        enlace.textContent = "Base de datos";
        enlace.className = "px-5 py-2.5 text-xs font-bold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-600 rounded-xl border border-cyan-500/30 transition-all";
        nav.insertBefore(enlace, nav.firstChild);
    });
})();
