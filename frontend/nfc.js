// =============================================================================
// Lector NFC del panel técnico MKA
// -----------------------------------------------------------------------------
// - Consulta /nfc/estado cada 1.5 s mientras el panel técnico está abierto.
// - Cuando llega una lectura nueva abre la ficha del equipo (o el registro si la
//   tarjeta es nueva). Si el técnico está escribiendo, solo muestra un aviso.
// - Ficha editable + historial técnico (agregar, editar, eliminar).
// Usa API_URL de app.js.
// =============================================================================
(function () {
    "use strict";

    const NFC_API = `${API_URL}/nfc`;
    const INTERVALO_MS = 1500;

    const TIPOS_EQUIPO = ["Portátil", "PC de escritorio", "Todo en uno", "Celular", "Tablet", "Impresora", "Monitor", "Consola", "Servidor", "Otro"];
    const TIPOS_HISTORIAL = ["Diagnóstico", "Reparación", "Mantenimiento", "Cambio de repuesto", "Pruebas", "Entrega", "Recepción", "Nota"];

    const C_INPUT = "w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-all";
    const C_LABEL = "block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1";
    const C_BTN_VERDE = "px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all disabled:opacity-50";
    const C_BTN_INDIGO = "px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50";
    const C_BTN_GRIS = "px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all";

    const estado = {
        ultimaLecturaId: null,   // null = todavía no sincronizado con el servidor
        consultando: false,
        ficha: null,             // ficha abierta en el panel
        uidNuevo: null,          // tarjeta nueva que se está registrando
        sucio: false,            // el técnico escribió algo sin guardar
        editandoHistorial: null,
        equipos: [],
    };

    // ---------------------------------------------------------------- utilidades
    const $ = (id) => document.getElementById(id);

    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));

    function cuando(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        const hoy = new Date();
        if (d.toDateString() === hoy.toDateString()) {
            return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        }
        return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    }

    const fechaLarga = (iso) => iso
        ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
        : "—";

    const dinero = (n) => Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

    function opciones(lista, actual) {
        const valores = actual && !lista.includes(actual) ? [actual, ...lista] : lista;
        return valores.map((v) => `<option value="${esc(v)}" ${v === actual ? "selected" : ""}>${esc(v)}</option>`).join("");
    }

    function tecnicoId() {
        try {
            const tec = JSON.parse(localStorage.getItem("tecnicoActivo") || "null");
            return tec && tec.id ? tec.id : null;
        } catch (_) {
            return null;
        }
    }

    function datosForm(form) {
        return Object.fromEntries(new FormData(form).entries());
    }

    const panelVisible = () => {
        const vista = $("view-dashboard-tecnico");
        return !!vista && !vista.classList.contains("hidden");
    };
    const pestanaVisible = () => {
        const sub = $("subview-tec-nfc");
        return panelVisible() && !!sub && !sub.classList.contains("hidden");
    };

    async function api(ruta, { metodo = "GET", datos } = {}) {
        const opcionesFetch = { method: metodo, headers: {} };
        if (datos !== undefined) {
            opcionesFetch.headers["Content-Type"] = "application/json";
            opcionesFetch.body = JSON.stringify(datos);
        }
        const res = await fetch(`${NFC_API}${ruta}`, opcionesFetch);
        let cuerpo = null;
        try { cuerpo = await res.json(); } catch (_) { /* respuesta sin cuerpo */ }
        if (!res.ok) {
            const det = cuerpo && cuerpo.detail;
            let mensaje = `Error ${res.status}`;
            if (typeof det === "string") mensaje = det;
            else if (Array.isArray(det)) mensaje = det.map((x) => x.msg).join(", ");
            else if (det && det.mensaje) mensaje = det.mensaje;
            const error = new Error(mensaje);
            error.status = res.status;
            error.codigo = det && det.codigo;
            throw error;
        }
        return cuerpo;
    }

    // ------------------------------------------------------------------- avisos
    function aviso(mensaje, tipo = "ok", accion = null) {
        let caja = $("nfc-avisos");
        if (!caja) {
            caja = document.createElement("div");
            caja.id = "nfc-avisos";
            caja.className = "fixed bottom-6 right-6 z-[60] space-y-3 w-80 max-w-[calc(100vw-3rem)]";
            document.body.appendChild(caja);
        }
        const colores = {
            ok: "border-emerald-500/40 text-emerald-200",
            error: "border-rose-500/50 text-rose-200",
            info: "border-cyan-500/40 text-cyan-200",
        };
        const el = document.createElement("div");
        el.className = `bg-slate-900/95 backdrop-blur border ${colores[tipo] || colores.info} rounded-2xl px-4 py-3 shadow-2xl text-xs flex items-start gap-3`;
        el.innerHTML = `<p class="flex-1 leading-relaxed">${esc(mensaje)}</p>`;
        if (accion) {
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className = "shrink-0 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold";
            boton.textContent = accion.texto;
            boton.addEventListener("click", () => { el.remove(); accion.fn(); });
            el.appendChild(boton);
        }
        caja.appendChild(el);
        setTimeout(() => el.remove(), accion ? 10000 : 4500);
    }

    // ------------------------------------------------------ estado del lector
    function pintarEstado(info, error) {
        const punto = $("nfc-estado-punto");
        const texto = $("nfc-estado-texto");
        const badge = $("nfc-estado-badge");
        const detalle = $("nfc-estado-detalle");
        const onda = $("nfc-onda");
        if (!punto || !texto || !badge || !detalle) return;

        let color = "bg-slate-500";
        let borde = "border-slate-700 text-slate-400";
        let titulo;
        let descripcion;
        let activo = false;

        if (error) {
            color = "bg-rose-500";
            borde = "border-rose-500/40 text-rose-300";
            titulo = "Sin conexión con la API";
            descripcion = `No responde ${API_URL}. Arranca el backend con iniciar_mka.bat.`;
        } else {
            const conectado = (info.lectores || []).find((l) => l.conectado);
            if (conectado && conectado.chip_ok === false) {
                color = "bg-amber-400";
                borde = "border-amber-500/40 text-amber-300";
                titulo = "Módulo NFC sin respuesta";
                descripcion = `El Arduino (${conectado.puerto || conectado.lector}) está conectado, pero el RC522 no contesta. Revisa los cables y que esté a 3.3 V.`;
            } else if (conectado) {
                color = "bg-emerald-400 animate-pulse";
                borde = "border-emerald-500/40 text-emerald-300";
                titulo = "Lector conectado";
                descripcion = [conectado.lector, conectado.puerto, conectado.modo && conectado.modo.toUpperCase()].filter(Boolean).join(" · ");
                activo = true;
            } else {
                titulo = "Sin lector conectado";
                descripcion = "Conecta el Arduino por USB y abre el puente (hardware/puente_usb/puente_nfc.py). Mientras tanto puedes escribir el UID a mano.";
            }
        }

        punto.className = `w-2 h-2 rounded-full ${color}`;
        badge.className = `inline-flex items-center gap-2 text-[11px] font-bold px-3 py-1 rounded-full border ${borde}`;
        texto.textContent = titulo;
        detalle.textContent = descripcion;
        if (onda) onda.classList.toggle("animate-ping", activo);
    }

    function pintarUltima(lectura) {
        const uid = $("nfc-ultimo-uid");
        const det = $("nfc-ultimo-detalle");
        if (!uid || !det) return;
        uid.textContent = lectura.uid;
        const equipo = lectura.registrado ? (lectura.equipo || "Equipo registrado") : "Tarjeta nueva";
        det.textContent = `${cuando(lectura.fecha)} · ${lectura.lector} · ${equipo}`;
    }

    // ------------------------------------------------------------ sondeo (poll)
    async function ciclo() {
        if (estado.consultando || !panelVisible() || document.hidden) return;
        estado.consultando = true;
        try {
            const info = await api("/estado");
            pintarEstado(info);
            const ultima = info.ultima_lectura_id || 0;

            if (estado.ultimaLecturaId === null || ultima < estado.ultimaLecturaId) {
                estado.ultimaLecturaId = ultima;
            } else if (ultima > estado.ultimaLecturaId) {
                const nuevas = await api(`/lecturas?despues_de=${estado.ultimaLecturaId}&limite=10`);
                estado.ultimaLecturaId = ultima;
                if (nuevas.length) recibirLectura(nuevas[0]);
                if (pestanaVisible()) cargarLecturas();
            }
        } catch (e) {
            pintarEstado(null, e);
        } finally {
            estado.consultando = false;
        }
    }

    function recibirLectura(lectura) {
        pintarUltima(lectura);
        if (pestanaVisible() && !estado.sucio) {
            abrirUid(lectura.uid);
            return;
        }
        const quien = lectura.registrado
            ? `${lectura.equipo}${lectura.cliente ? " (" + lectura.cliente + ")" : ""}`
            : "tarjeta nueva, sin equipo";
        aviso(`Tarjeta ${lectura.uid}: ${quien}`, lectura.registrado ? "ok" : "info", {
            texto: "Abrir",
            fn: () => { window.switchTabTecnico("nfc"); abrirUid(lectura.uid); },
        });
    }

    async function abrirUid(uid) {
        try {
            const r = await api(`/buscar?uid=${encodeURIComponent(uid)}`);
            if (r.registrado) pintarFicha(r);
            else pintarNueva(r.uid);
        } catch (e) {
            aviso(e.message, "error");
        }
    }

    async function abrirEquipo(id) {
        try {
            pintarFicha(await api(`/equipos/${id}`));
        } catch (e) {
            aviso(e.message, "error");
        }
    }

    // ------------------------------------------------------------ piezas de UI
    const chipUid = (uid) =>
        `<span class="font-mono text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl whitespace-nowrap">${esc(uid)}</span>`;

    function campo(nombre, etiqueta, valor, atributos = "", clase = "") {
        return `
            <div class="${clase}">
                <label class="${C_LABEL}">${etiqueta}</label>
                <input name="${nombre}" value="${esc(valor)}" ${atributos} class="${C_INPUT}">
            </div>`;
    }

    function camposEquipo(d = {}, compacto = false) {
        const ancho = compacto ? "" : "md:col-span-2";
        return `
            ${campo("nombre_equipo", "Nombre del equipo *", d.nombre_equipo, 'required maxlength="100" placeholder="Ej. Portátil Dell XPS 15"')}
            ${campo("marca", "Marca *", d.marca, 'required maxlength="50" placeholder="Ej. Dell / HP / Lenovo"')}
            ${campo("serial_modelo", "Serial / Modelo", d.serial_modelo === "N/A" ? "" : d.serial_modelo, 'maxlength="50" placeholder="Ej. SN-998823"')}
            <div>
                <label class="${C_LABEL}">Tipo de equipo</label>
                <select name="tipo_equipo" class="${C_INPUT}">
                    <option value="">—</option>
                    ${opciones(TIPOS_EQUIPO, d.tipo_equipo)}
                </select>
            </div>
            ${campo("color", "Color", d.color, 'maxlength="30" placeholder="Ej. Gris"')}
            ${campo("accesorios", "Accesorios recibidos", d.accesorios, 'maxlength="200" placeholder="Cargador, funda, mouse…"')}
            ${campo("estado_fisico", "Estado físico", d.estado_fisico, 'maxlength="200" placeholder="Rayones en la tapa, pantalla sin daños…"', ancho)}
            <div class="${ancho}">
                <label class="${C_LABEL}">Notas</label>
                <textarea name="notas" rows="2" maxlength="5000" placeholder="Falla que reporta el cliente, observaciones…" class="${C_INPUT}">${esc(d.notas)}</textarea>
            </div>`;
    }

    function colorTipo(tipo) {
        return {
            "Diagnóstico": "bg-cyan-500",
            "Reparación": "bg-emerald-500",
            "Mantenimiento": "bg-indigo-500",
            "Cambio de repuesto": "bg-amber-400",
            "Pruebas": "bg-sky-400",
            "Entrega": "bg-emerald-300",
            "Recepción": "bg-violet-400",
        }[tipo] || "bg-slate-500";
    }

    // ----------------------------------------------------------- vista: inicio
    function pintarInicio() {
        estado.ficha = null;
        estado.uidNuevo = null;
        estado.sucio = false;
        const panel = $("nfc-panel");
        if (!panel) return;
        panel.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center gap-4 py-20">
                <p class="text-xl font-black text-white">Pase una tarjeta por el lector</p>
                <p class="text-xs text-slate-400 max-w-md leading-relaxed">
                    Si la tarjeta ya está vinculada se abre la ficha del equipo con su historial.
                    Si es nueva, aquí mismo registra el equipo y la tarjeta queda asociada.
                </p>
                <p class="text-[11px] text-slate-500">También puede abrir cualquier equipo desde «Equipos registrados».</p>
            </div>`;
    }

    // ---------------------------------------------------- vista: tarjeta nueva
    async function pintarNueva(uid) {
        estado.ficha = null;
        estado.uidNuevo = uid;
        estado.sucio = false;
        const panel = $("nfc-panel");
        panel.innerHTML = `<p class="text-xs text-slate-500">Cargando…</p>`;

        let clientes = [];
        let equipos = [];
        try {
            const [respClientes, respEquipos] = await Promise.all([
                fetch(`${API_URL}/clients/`).then((r) => r.json()),
                api("/equipos"),
            ]);
            clientes = Array.isArray(respClientes) ? respClientes : [];
            equipos = respEquipos;
            estado.equipos = respEquipos;
        } catch (e) {
            aviso("No se pudieron cargar clientes y equipos: " + e.message, "error");
        }
        if (estado.uidNuevo !== uid) return; // llegó otra lectura mientras cargaba

        const opcClientes = clientes
            .map((c) => `<option value="${c.id}">${esc(c.full_name)} · ${esc(c.document_type)} ${esc(c.document_id)}</option>`)
            .join("");
        const opcEquipos = equipos
            .map((e) => `<option value="${e.id}">${esc(e.nombre_equipo)} — ${esc(e.marca)} (${esc(e.cliente_nombre || "sin cliente")})${e.uid ? " · ya tiene tarjeta" : ""}</option>`)
            .join("");

        panel.innerHTML = `
            <div class="space-y-6">
                <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-5">
                    <div>
                        <p class="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Tarjeta nueva</p>
                        <h3 class="text-xl font-black text-white">Registrar equipo con esta tarjeta</h3>
                        <p class="text-xs text-slate-400 mt-1">La tarjeta todavía no está asociada a ningún equipo.</p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        ${chipUid(uid)}
                        <button type="button" data-accion="cerrar" class="text-[11px] font-bold text-slate-400 hover:text-white">Cancelar</button>
                    </div>
                </div>

                <form id="nfc-form-nuevo" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label class="${C_LABEL}">Cliente *</label>
                            <select name="cliente_id" required class="${C_INPUT}">
                                <option value="">Seleccione el cliente…</option>
                                ${opcClientes}
                            </select>
                            ${clientes.length ? "" : `<p class="text-[11px] text-amber-300 mt-1">No hay clientes registrados. Créelo primero con «Crear Cuenta de Cliente».</p>`}
                        </div>
                        ${camposEquipo({})}
                    </div>
                    <div class="flex justify-end">
                        <button type="submit" class="${C_BTN_VERDE}">Registrar equipo y vincular tarjeta</button>
                    </div>
                </form>

                ${equipos.length ? `
                <form id="nfc-form-vincular" class="border-t border-slate-800 pt-5 space-y-3">
                    <p class="text-xs font-bold text-slate-300">¿El equipo ya estaba registrado? Vincule la tarjeta a ese equipo:</p>
                    <div class="flex flex-col sm:flex-row gap-2">
                        <select name="dispositivo_id" required class="${C_INPUT}">
                            <option value="">Seleccione el equipo…</option>
                            ${opcEquipos}
                        </select>
                        <button type="submit" class="shrink-0 ${C_BTN_INDIGO}">Vincular tarjeta</button>
                    </div>
                </form>` : ""}
            </div>`;
    }

    async function enviarNuevo(form) {
        const d = datosForm(form);
        const datos = { ...d, uid: estado.uidNuevo, cliente_id: Number(d.cliente_id), tecnico_id: tecnicoId() };
        const ficha = await api("/equipos", { metodo: "POST", datos });
        aviso("Equipo registrado y tarjeta vinculada.");
        pintarFicha(ficha);
        cargarEquipos();
        cargarLecturas();
    }

    async function enviarVincular(form, reemplazar = false) {
        const dispositivoId = Number(new FormData(form).get("dispositivo_id"));
        try {
            const ficha = await api("/tags", {
                metodo: "POST",
                datos: { uid: estado.uidNuevo, dispositivo_id: dispositivoId, reemplazar, tecnico_id: tecnicoId() },
            });
            aviso("Tarjeta vinculada al equipo.");
            pintarFicha(ficha);
            cargarEquipos();
            cargarLecturas();
        } catch (e) {
            if (e.codigo === "equipo_con_tarjeta" && !reemplazar
                && confirm(`${e.message}\n¿Reemplazarla por la tarjeta ${estado.uidNuevo}?`)) {
                return enviarVincular(form, true);
            }
            throw e;
        }
    }

    // ------------------------------------------------------- vista: ficha
    function pintarFicha(f) {
        estado.ficha = f;
        estado.uidNuevo = null;
        estado.sucio = false;
        estado.editandoHistorial = null;

        const d = f.dispositivo;
        const c = f.cliente || {};
        const ordenes = f.ordenes_activas || [];
        const ordenSugerida = f.orden ? f.orden.id : null;
        const subtitulo = [d.marca, d.tipo_equipo, d.color, d.serial_modelo && d.serial_modelo !== "N/A" ? `S/N ${d.serial_modelo}` : ""]
            .filter(Boolean).join(" · ");

        $("nfc-panel").innerHTML = `
            <div class="space-y-6">
                <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
                    <div class="space-y-1 min-w-0">
                        <p class="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Ficha del equipo #${d.id}</p>
                        <h3 class="text-2xl font-black text-white break-words">${esc(d.nombre_equipo)}</h3>
                        <p class="text-xs text-slate-400">${esc(subtitulo)}</p>
                        <p class="text-xs text-slate-300 pt-1">
                            <span class="text-slate-500">Cliente:</span> ${esc(c.full_name || "—")}
                            ${c.phone ? `<span class="text-slate-600">·</span> <span class="text-slate-500">Tel:</span> ${esc(c.phone)}` : ""}
                            ${c.document_id ? `<span class="text-slate-600">·</span> <span class="text-slate-500">${esc(c.document_type)}:</span> ${esc(c.document_id)}` : ""}
                        </p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        ${d.uid ? chipUid(d.uid) : `<span class="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">Sin tarjeta</span>`}
                        <div class="flex gap-3">
                            ${d.uid ? `<button type="button" data-accion="desvincular" class="text-[11px] font-bold text-rose-300 hover:text-rose-200">Desvincular tarjeta</button>` : ""}
                            <button type="button" data-accion="cerrar" class="text-[11px] font-bold text-slate-400 hover:text-white">Cerrar</button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div class="xl:col-span-2 space-y-5">
                        <form id="nfc-form-editar" class="space-y-3">
                            <p class="text-xs font-bold text-slate-300 uppercase tracking-widest">Datos del equipo</p>
                            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3">${camposEquipo(d, true)}</div>
                            <div class="flex justify-end">
                                <button type="submit" class="${C_BTN_INDIGO}">Guardar cambios</button>
                            </div>
                        </form>
                        <div class="space-y-2">
                            <p class="text-xs font-bold text-slate-300 uppercase tracking-widest">Órdenes activas del cliente</p>
                            <div id="nfc-ordenes" class="space-y-2"></div>
                        </div>
                    </div>

                    <div class="xl:col-span-3 space-y-4">
                        <p class="text-xs font-bold text-slate-300 uppercase tracking-widest">Historial técnico</p>
                        <form id="nfc-form-historial" class="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label class="${C_LABEL}">Tipo</label>
                                    <select name="tipo" class="${C_INPUT}">${opciones(TIPOS_HISTORIAL, "Diagnóstico")}</select>
                                </div>
                                <div>
                                    <label class="${C_LABEL}">Orden relacionada</label>
                                    <select name="orden_id" class="${C_INPUT}">
                                        <option value="">Ninguna</option>
                                        ${ordenes.map((o) => `<option value="${o.id}" ${o.id === ordenSugerida ? "selected" : ""}>#${o.id} · ${esc(o.equipo)}</option>`).join("")}
                                    </select>
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="${C_LABEL}">Descripción *</label>
                                    <textarea name="descripcion" required rows="3" maxlength="5000" placeholder="Qué se revisó, qué se encontró, qué se hizo…" class="${C_INPUT}"></textarea>
                                </div>
                                ${campo("repuestos", "Repuestos usados", "", 'maxlength="200" placeholder="Ej. Pasta térmica, SSD 512 GB"')}
                                ${campo("costo", "Costo (COP)", "", 'type="number" min="0" step="any" placeholder="0"')}
                            </div>
                            <div class="flex flex-wrap items-center justify-between gap-3">
                                ${ordenes.length
                                    ? `<label class="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer"><input type="checkbox" name="publicar_en_orden" class="accent-emerald-500"> Publicar como avance de la orden (lo ve el cliente)</label>`
                                    : `<span></span>`}
                                <button type="submit" class="${C_BTN_VERDE}">Agregar al historial</button>
                            </div>
                        </form>
                        <ol id="nfc-historial-lista" class="space-y-3"></ol>
                    </div>
                </div>
            </div>`;

        pintarOrdenes();
        pintarHistorial();
    }

    function pintarOrdenes() {
        const caja = $("nfc-ordenes");
        if (!caja || !estado.ficha) return;
        const ordenes = estado.ficha.ordenes_activas || [];
        caja.innerHTML = ordenes.length
            ? ordenes.map((o) => `
                <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                    <p class="text-xs font-bold text-slate-200">#${o.id} · ${esc(o.equipo)} <span class="text-emerald-400 font-semibold">· ${esc(o.estado)}</span></p>
                    <p class="text-[11px] text-slate-400 leading-relaxed">${esc(o.avance_realtime || "")}</p>
                </div>`).join("")
            : `<p class="text-[11px] text-slate-500">Sin órdenes activas.</p>`;
    }

    function pintarHistorial() {
        const lista = $("nfc-historial-lista");
        if (!lista || !estado.ficha) return;
        const historial = estado.ficha.historial || [];
        lista.innerHTML = historial.length
            ? historial.map(itemHistorial).join("")
            : `<li class="text-xs text-slate-500">Este equipo aún no tiene historial.</li>`;
    }

    function itemHistorial(h) {
        if (estado.editandoHistorial === h.id) return formEditarHistorial(h);
        const meta = [fechaLarga(h.fecha), h.tecnico_nombre && esc(h.tecnico_nombre), h.orden_id && `Orden #${h.orden_id}`]
            .filter(Boolean).join(" · ");
        const extra = [h.repuestos && `Repuestos: ${esc(h.repuestos)}`, h.costo != null && `Costo: ${dinero(h.costo)}`]
            .filter(Boolean).join(" · ");
        return `
            <li class="relative bg-slate-950 border border-slate-800 rounded-2xl p-4 pl-5 space-y-1.5 overflow-hidden">
                <span class="absolute left-0 top-0 bottom-0 w-1 ${colorTipo(h.tipo)}"></span>
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="text-xs"><span class="font-bold text-white">${esc(h.tipo)}</span> <span class="text-slate-500">· ${meta}</span></p>
                    <div class="flex gap-3">
                        <button type="button" data-accion="editar-historial" data-id="${h.id}" class="text-[11px] font-bold text-cyan-400 hover:text-cyan-300">Editar</button>
                        <button type="button" data-accion="borrar-historial" data-id="${h.id}" class="text-[11px] font-bold text-rose-400 hover:text-rose-300">Eliminar</button>
                    </div>
                </div>
                <p class="text-xs text-slate-300 whitespace-pre-line leading-relaxed">${esc(h.descripcion)}</p>
                ${extra ? `<p class="text-[11px] text-slate-400">${extra}</p>` : ""}
                ${h.editado_en ? `<p class="text-[10px] text-slate-600">Editado ${fechaLarga(h.editado_en)}</p>` : ""}
            </li>`;
    }

    function formEditarHistorial(h) {
        return `
            <li>
                <form data-form="editar-historial" data-id="${h.id}" class="bg-slate-950 border border-cyan-500/40 rounded-2xl p-4 space-y-3">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="${C_LABEL}">Tipo</label>
                            <select name="tipo" class="${C_INPUT}">${opciones(TIPOS_HISTORIAL, h.tipo)}</select>
                        </div>
                        ${campo("costo", "Costo (COP)", h.costo ?? "", 'type="number" min="0" step="any"')}
                        <div class="sm:col-span-2">
                            <label class="${C_LABEL}">Descripción *</label>
                            <textarea name="descripcion" required rows="3" maxlength="5000" class="${C_INPUT}">${esc(h.descripcion)}</textarea>
                        </div>
                        ${campo("repuestos", "Repuestos usados", h.repuestos, 'maxlength="200"', "sm:col-span-2")}
                    </div>
                    <div class="flex justify-end gap-2">
                        <button type="button" data-accion="cancelar-edicion" class="${C_BTN_GRIS}">Cancelar</button>
                        <button type="submit" class="${C_BTN_INDIGO}">Guardar</button>
                    </div>
                </form>
            </li>`;
    }

    function actualizarFicha(f) {
        estado.ficha = f;
        estado.editandoHistorial = null;
        estado.sucio = false;
        pintarOrdenes();
        pintarHistorial();
    }

    async function enviarEditar(form) {
        const ficha = await api(`/equipos/${estado.ficha.dispositivo.id}`, { metodo: "PUT", datos: datosForm(form) });
        pintarFicha(ficha);
        cargarEquipos();
        aviso("Datos del equipo guardados.");
    }

    async function enviarHistorial(form) {
        const d = datosForm(form);
        const publicar = !!(form.elements.publicar_en_orden && form.elements.publicar_en_orden.checked);
        const datos = {
            tipo: d.tipo,
            descripcion: d.descripcion,
            repuestos: d.repuestos || null,
            costo: d.costo === "" || d.costo === undefined ? null : Number(d.costo),
            orden_id: d.orden_id ? Number(d.orden_id) : null,
            publicar_en_orden: publicar,
            tecnico_id: tecnicoId(),
        };
        const ficha = await api(`/equipos/${estado.ficha.dispositivo.id}/historial`, { metodo: "POST", datos });
        form.reset();
        actualizarFicha(ficha);
        cargarEquipos();
        aviso(publicar && datos.orden_id ? "Registro agregado y publicado en la orden." : "Registro agregado al historial.");
    }

    async function enviarEditarHistorial(form) {
        const d = datosForm(form);
        const ficha = await api(`/historial/${form.dataset.id}`, {
            metodo: "PUT",
            datos: {
                tipo: d.tipo,
                descripcion: d.descripcion,
                repuestos: d.repuestos || null,
                costo: d.costo === "" ? null : Number(d.costo),
            },
        });
        actualizarFicha(ficha);
        aviso("Registro actualizado.");
    }

    // -------------------------------------------------- registro de lecturas
    async function cargarLecturas() {
        try {
            const lecturas = await api("/lecturas?limite=30");
            pintarLecturas(lecturas);
            return lecturas;
        } catch (e) {
            const body = $("nfc-lecturas-body");
            if (body) body.innerHTML = `<tr><td colspan="5" class="py-4 text-rose-300">No se pudo cargar el registro: ${esc(e.message)}</td></tr>`;
            return null;
        }
    }

    function pintarLecturas(lecturas) {
        const body = $("nfc-lecturas-body");
        if (!body) return;
        if (!lecturas.length) {
            body.innerHTML = `<tr><td colspan="5" class="py-4 text-slate-500">Aún no hay lecturas. Pase una tarjeta por el lector.</td></tr>`;
            return;
        }
        body.innerHTML = lecturas.map((l) => `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td class="py-2 pr-3 text-slate-400 whitespace-nowrap">${cuando(l.fecha)}</td>
                <td class="py-2 pr-3 font-mono text-slate-200 whitespace-nowrap">${esc(l.uid)}</td>
                <td class="py-2 pr-3 text-slate-500 whitespace-nowrap">${esc(l.lector)}</td>
                <td class="py-2 pr-3">${l.registrado
                    ? `<span class="text-emerald-300">${esc(l.equipo)}</span>${l.cliente ? `<span class="text-slate-500"> · ${esc(l.cliente)}</span>` : ""}`
                    : `<span class="text-amber-300">Tarjeta nueva</span>`}</td>
                <td class="py-2 text-right"><button type="button" data-uid="${esc(l.uid)}" class="text-[11px] font-bold text-emerald-400 hover:text-emerald-300">Abrir</button></td>
            </tr>`).join("");
    }

    // --------------------------------------------------- equipos registrados
    async function cargarEquipos() {
        try {
            estado.equipos = await api("/equipos");
            pintarEquipos();
        } catch (e) {
            const ul = $("nfc-equipos-lista");
            if (ul) ul.innerHTML = `<li class="text-xs text-rose-300">No se pudieron cargar los equipos: ${esc(e.message)}</li>`;
        }
    }

    function pintarEquipos() {
        const ul = $("nfc-equipos-lista");
        if (!ul) return;
        const q = ($("nfc-buscar-equipo")?.value || "").trim().toLowerCase();
        const lista = estado.equipos.filter((e) => !q || [e.nombre_equipo, e.marca, e.cliente_nombre, e.uid, e.serial_modelo]
            .some((v) => String(v || "").toLowerCase().includes(q)));

        if (!lista.length) {
            ul.innerHTML = `<li class="text-xs text-slate-500">${estado.equipos.length ? "Sin resultados." : "No hay equipos registrados todavía."}</li>`;
            return;
        }
        ul.innerHTML = lista.map((e) => `
            <li>
                <button type="button" data-equipo="${e.id}" class="w-full text-left bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all">
                    <span class="min-w-0">
                        <span class="block text-xs font-bold text-slate-200 truncate">${esc(e.nombre_equipo)} <span class="text-slate-500 font-normal">· ${esc(e.marca)}</span></span>
                        <span class="block text-[11px] text-slate-500 truncate">${esc(e.cliente_nombre || "Sin cliente")} · ${e.total_historial} registro${e.total_historial === 1 ? "" : "s"}</span>
                    </span>
                    ${e.uid
                        ? `<span class="shrink-0 font-mono text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">${esc(e.uid)}</span>`
                        : `<span class="shrink-0 text-[10px] text-slate-500 border border-slate-700 px-2 py-1 rounded-lg">Sin tarjeta</span>`}
                </button>
            </li>`).join("");
    }

    async function entrarPestana() {
        cargarEquipos();
        const lecturas = await cargarLecturas();
        const ultimo = $("nfc-ultimo-uid");
        if (lecturas && lecturas.length && ultimo && ultimo.textContent.trim() === "—") pintarUltima(lecturas[0]);
        if (!estado.ficha && !estado.uidNuevo) pintarInicio();
        ciclo();
    }

    // --------------------------------------------------------------- arranque
    document.addEventListener("DOMContentLoaded", () => {
        // app.js ya definió switchTabTecnico: se extiende para la pestaña NFC.
        const cambiarPestanaOriginal = window.switchTabTecnico;
        window.switchTabTecnico = function (tab) {
            cambiarPestanaOriginal(tab);
            if (tab === "nfc") entrarPestana();
        };

        const panel = $("nfc-panel");
        if (!panel) return;
        pintarInicio();

        panel.addEventListener("input", () => { estado.sucio = true; });

        panel.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const form = ev.target;
            const boton = form.querySelector('button[type="submit"]');
            if (boton) boton.disabled = true;
            try {
                if (form.id === "nfc-form-nuevo") await enviarNuevo(form);
                else if (form.id === "nfc-form-vincular") await enviarVincular(form);
                else if (form.id === "nfc-form-editar") await enviarEditar(form);
                else if (form.id === "nfc-form-historial") await enviarHistorial(form);
                else if (form.dataset.form === "editar-historial") await enviarEditarHistorial(form);
            } catch (e) {
                aviso(e.message, "error");
            } finally {
                if (boton && boton.isConnected) boton.disabled = false;
            }
        });

        panel.addEventListener("click", async (ev) => {
            const boton = ev.target.closest("[data-accion]");
            if (!boton) return;
            const accion = boton.dataset.accion;
            const id = Number(boton.dataset.id);
            try {
                if (accion === "cerrar") {
                    pintarInicio();
                } else if (accion === "desvincular") {
                    const d = estado.ficha.dispositivo;
                    if (!confirm(`¿Desvincular la tarjeta ${d.uid} de «${d.nombre_equipo}»? El equipo y su historial se conservan.`)) return;
                    const tec = tecnicoId();
                    pintarFicha(await api(`/equipos/${d.id}/tag${tec ? `?tecnico_id=${tec}` : ""}`, { metodo: "DELETE" }));
                    cargarEquipos();
                    aviso("Tarjeta desvinculada.");
                } else if (accion === "editar-historial") {
                    estado.editandoHistorial = id;
                    pintarHistorial();
                } else if (accion === "cancelar-edicion") {
                    estado.editandoHistorial = null;
                    pintarHistorial();
                } else if (accion === "borrar-historial") {
                    if (!confirm("¿Eliminar este registro del historial?")) return;
                    actualizarFicha(await api(`/historial/${id}`, { metodo: "DELETE" }));
                    cargarEquipos();
                    aviso("Registro eliminado.");
                }
            } catch (e) {
                aviso(e.message, "error");
            }
        });

        $("nfc-form-manual")?.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            const input = $("nfc-uid-manual");
            const uid = input.value.trim();
            if (!uid) return;
            try {
                const r = await api("/lecturas", { metodo: "POST", datos: { uid, lector: "MANUAL" } });
                input.value = "";
                estado.ultimaLecturaId = Math.max(estado.ultimaLecturaId || 0, r.lectura_id);
                pintarUltima({
                    uid: r.uid,
                    fecha: r.fecha,
                    lector: r.lector,
                    registrado: r.registrado,
                    equipo: r.dispositivo ? r.dispositivo.nombre_equipo : null,
                });
                if (r.registrado) await abrirEquipo(r.dispositivo.id);
                else pintarNueva(r.uid);
                cargarLecturas();
            } catch (e) {
                aviso(e.message, "error");
            }
        });

        $("nfc-lecturas-body")?.addEventListener("click", (ev) => {
            const boton = ev.target.closest("[data-uid]");
            if (boton) abrirUid(boton.dataset.uid);
        });

        $("nfc-equipos-lista")?.addEventListener("click", (ev) => {
            const boton = ev.target.closest("[data-equipo]");
            if (boton) abrirEquipo(Number(boton.dataset.equipo));
        });

        $("nfc-buscar-equipo")?.addEventListener("input", pintarEquipos);
        $("nfc-recargar-lecturas")?.addEventListener("click", cargarLecturas);

        setInterval(ciclo, INTERVALO_MS);
        ciclo();
    });
})();
