const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    console.log("¡MKA Frontend inicializado!");

    cargarDatosCliente();
    cargarDatosTecnicoSesion();

    window.navTo = function(viewId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`view-${viewId}`);
        if (target) target.classList.remove('hidden');

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            if (viewId === 'landing') logoutBtn.classList.add('hidden');
            else logoutBtn.classList.remove('hidden');
        }
    };

    window.switchTabCliente = function(tabName) {
        document.querySelectorAll('[id^="subview-cli-"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[id^="tab-cli-"]').forEach(el => {
            el.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all";
        });

        const targetSub = document.getElementById(`subview-cli-${tabName}`);
        if (targetSub) targetSub.classList.remove('hidden');
        
        const activeTab = document.getElementById(`tab-cli-${tabName}`);
        if (activeTab) {
            activeTab.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 transition-all";
        }

        if (tabName === 'dispositivos') obtenerDispositivosCliente();
    };

    window.switchTabTecnico = function(tabName) {
        document.querySelectorAll('[id^="subview-tec-"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[id^="tab-tec-"]').forEach(el => {
            el.className = "px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all";
        });

        const targetSub = document.getElementById(`subview-tec-${tabName}`);
        if (targetSub) targetSub.classList.remove('hidden');
        
        const activeTab = document.getElementById(`tab-tec-${tabName}`);
        if (activeTab) {
            activeTab.className = "px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 transition-all";
        }

        if (tabName === 'disponibles' || tabName === 'tomadas') obtenerOrdenesTecnico();
    };

    // REGISTRO CLIENTE
    const clientForm = document.getElementById("client-form");
    if (clientForm) {
        clientForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = {
                full_name: document.getElementById("full_name")?.value || "",
                document_type: document.getElementById("document_type")?.value || "CC",
                document_id: document.getElementById("document_id")?.value || "",
                email: document.getElementById("email")?.value || null,
                phone: document.getElementById("phone")?.value || "",
                direccion: document.getElementById("direccion")?.value || "",
                password: document.getElementById("cli-password")?.value || ""
            };

            try {
                const response = await fetch(`${API_URL}/clients/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || "Error al registrar cliente");
                }
                const cli = await response.json();
                localStorage.setItem("clienteActivo", JSON.stringify(cli));
                alert("¡Cliente registrado con éxito!");
                clientForm.reset();
                navTo("dashboard-cliente");
                cargarDatosCliente();
                fetchOrdenes();
            } catch (err) {
                alert("Error al registrar cliente: " + err.message);
            }
        });
    }

    // REGISTRO TÉCNICO (Sincronizado con campos 'nombre' y 'telefono')
    const tecnicoForm = document.getElementById("tecnico-form");
    if (tecnicoForm) {
        tecnicoForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = {
                nombre: document.getElementById("tec-nombre")?.value || "",
                especialidad: document.getElementById("tec-especialidad")?.value || "",
                telefono: document.getElementById("tec-telefono")?.value || "",
                document_type: "CC",
                document_id: document.getElementById("tec-document-id")?.value || "",
                password: document.getElementById("tec-password")?.value || ""
            };

            try {
                const response = await fetch(`${API_URL}/tecnicos/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || "Error al registrar técnico");
                }
                alert("¡Técnico registrado con éxito!");
                tecnicoForm.reset();
                navTo("auth-tecnico-login");
            } catch (err) {
                alert("Error al registrar técnico: " + err.message);
            }
        });
    }

    // CREAR ORDEN (CLIENTE)
    const ordenForm = document.getElementById("orden-form");
    if (ordenForm) {
        ordenForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const cli = JSON.parse(localStorage.getItem("clienteActivo") || '{"id": 1}');
            const data = {
                cliente_id: cli.id,
                equipo: document.getElementById("ord-equipo")?.value || "",
                descripcion: document.getElementById("ord-descripcion")?.value || ""
            };

            try {
                const response = await fetch(`${API_URL}/orders/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error("Error al crear orden");
                alert("¡Orden enviada al panel técnico con éxito!");
                ordenForm.reset();
                fetchOrdenes();
            } catch (err) {
                alert("Error al crear orden: " + err.message);
            }
        });
    }

    // REGISTRAR DISPOSITIVO (CLIENTE)
    const dispForm = document.getElementById("dispositivo-form");
    if (dispForm) {
        dispForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const cli = JSON.parse(localStorage.getItem("clienteActivo") || '{"id": 1}');
            const data = {
                cliente_id: cli.id,
                nombre_equipo: document.getElementById("disp-nombre")?.value || "",
                marca: document.getElementById("disp-marca")?.value || "",
                serial_modelo: document.getElementById("disp-serial")?.value || "N/A"
            };

            try {
                const response = await fetch(`${API_URL}/clients/dispositivos/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error("Error al registrar dispositivo");
                alert("¡Dispositivo registrado exitosamente!");
                dispForm.reset();
                obtenerDispositivosCliente();
            } catch (err) {
                alert("Error al registrar dispositivo: " + err.message);
            }
        });
    }
});

// LOGIN CLIENTE (Blindado)
window.simularLoginCliente = async function(event) {
    if (event) event.preventDefault();
    const doc = document.getElementById("cli-login-doc")?.value.trim();
    const pass = document.getElementById("cli-login-pass")?.value.trim();

    try {
        const res = await fetch(`${API_URL}/clients/`);
        const clientes = await res.json();

        if (!Array.isArray(clientes)) {
            throw new Error(clientes.detail || "Error al obtener los clientes del servidor.");
        }

        const cli = clientes.find(c => String(c.document_id) === doc && String(c.password) === pass);

        if (!cli) {
            alert("Documento o contraseña incorrectos.");
            return;
        }

        localStorage.setItem("clienteActivo", JSON.stringify(cli));
        alert(`¡Bienvenido, ${cli.full_name}!`);
        navTo("dashboard-cliente");
        cargarDatosCliente();
        fetchOrdenes();
        obtenerDispositivosCliente();
    } catch (err) {
        alert("Error en login: " + err.message);
    }
};

// LOGIN TÉCNICO (Blindado)
window.simularLoginTecnico = async function(event) {
    if (event) event.preventDefault();
    const doc = document.getElementById("tecnico-login-input")?.value.trim();
    const pass = document.getElementById("tecnico-login-pass")?.value.trim();

    try {
        const res = await fetch(`${API_URL}/tecnicos/`);
        const tecnicos = await res.json();

        if (!Array.isArray(tecnicos)) {
            throw new Error(tecnicos.detail || "Error al obtener los técnicos del servidor.");
        }

        const tec = tecnicos.find(t => String(t.document_id) === doc && String(t.password) === pass);

        if (!tec) {
            alert("Cédula o contraseña incorrectas.");
            return;
        }

        localStorage.setItem("tecnicoActivo", JSON.stringify(tec));
        alert(`¡Bienvenido, ${tec.nombre}!`);
        navTo("dashboard-tecnico");
        obtenerOrdenesTecnico();
        cargarDatosTecnicoSesion();
    } catch (err) {
        alert("Error en login: " + err.message);
    }
};

function cargarDatosCliente() {
    const cli = JSON.parse(localStorage.getItem("clienteActivo") || "null");
    if (!cli) return;
    const setTexto = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || "-";
    };
    setTexto("perfil-nombre", cli.full_name);
    setTexto("perfil-doc-tipo", cli.document_type);
    setTexto("perfil-doc-id", cli.document_id);
    setTexto("perfil-telefono", cli.phone);
    setTexto("perfil-correo", cli.email);
    setTexto("perfil-direccion", cli.direccion);
}

function cargarDatosTecnicoSesion() {
    const tec = JSON.parse(localStorage.getItem("tecnicoActivo") || "null");
    const container = document.getElementById("perfil-tecnico-container");
    if (!tec || !container) return;
    container.innerHTML = `
        <h3 class="font-bold text-slate-100 border-b border-slate-800 pb-3">Información del Técnico</h3>
        <p class="text-sm text-slate-300"><strong>Nombre:</strong> ${tec.nombre}</p>
        <p class="text-sm text-slate-300"><strong>Cédula:</strong> ${tec.document_id}</p>
        <p class="text-sm text-slate-300"><strong>Teléfono:</strong> ${tec.telefono || "-"}</p>
        <p class="text-sm text-slate-300"><strong>Especialidad:</strong> ${tec.especialidad || "-"}</p>
    `;
}

// OBTENER DISPOSITIVOS DEL CLIENTE
async function obtenerDispositivosCliente() {
    const list = document.getElementById("dispositivos-list");
    if (!list) return;
    const cli = JSON.parse(localStorage.getItem("clienteActivo") || '{"id": 1}');

    try {
        const res = await fetch(`${API_URL}/clients/dispositivos/${cli.id}`);
        const dispositivos = await res.json();
        list.innerHTML = "";
        if (!dispositivos.length) {
            list.innerHTML = `<p class="text-xs text-slate-500 col-span-2">No has registrado ningún dispositivo aún.</p>`;
            return;
        }
        dispositivos.forEach(d => {
            list.innerHTML += `
                <li class="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                    <p class="text-sm font-bold text-slate-200">${d.nombre_equipo}</p>
                    <p class="text-xs text-slate-400">Marca: ${d.marca}</p>
                    <p class="text-xs text-slate-500">Serial/Modelo: ${d.serial_modelo}</p>
                </li>
            `;
        });
    } catch (err) {
        console.error("Error cargando dispositivos:", err);
    }
}

// ÓRDENES DEL CLIENTE (CON AVANCE EN TIEMPO REAL)
async function fetchOrdenes() {
    const list = document.getElementById("ordenes-list");
    if (!list) return;
    const cli = JSON.parse(localStorage.getItem("clienteActivo") || '{"id": 1}');

    try {
        const res = await fetch(`${API_URL}/orders/`);
        const ordenes = await res.json();
        const misOrdenes = ordenes.filter(o => o.cliente_id === cli.id);

        list.innerHTML = "";
        if (!misOrdenes.length) {
            list.innerHTML = `<p class="text-xs text-slate-500">No tienes órdenes registradas todavía.</p>`;
            return;
        }

        misOrdenes.forEach(ord => {
            list.innerHTML += `
                <li class="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
                    <div class="flex justify-between items-center">
                        <p class="text-sm font-bold text-slate-200">Equipo: ${ord.equipo}</p>
                        <span class="px-2.5 py-1 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">Estado: ${ord.estado}</span>
                    </div>
                    <p class="text-xs text-slate-400">Falla: ${ord.descripcion}</p>
                    <div class="bg-slate-900 border border-slate-800 p-3 rounded-xl mt-2">
                        <p class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1">🔍 Seguimiento del Técnico en Tiempo Real:</p>
                        <p class="text-xs text-slate-300 italic">${ord.avance_realtime || 'A la espera de asignación.'}</p>
                    </div>
                </li>
            `;
        });
    } catch (err) {
        console.error("Error cargando órdenes cliente:", err);
    }
}

// GESTIÓN DE ÓRDENES TÉCNICO (DISPONIBLES Y TOMADAS - MÁXIMO 4)
async function obtenerOrdenesTecnico() {
    const dispList = document.getElementById("tecnico-ordenes-disponibles");
    const tomadasList = document.getElementById("tecnico-ordenes-tomadas");
    const counter = document.getElementById("contador-ordenes-tomadas");
    if (!dispList || !tomadasList) return;

    const tec = JSON.parse(localStorage.getItem("tecnicoActivo") || "null");
    if (!tec) return;

    try {
        const res = await fetch(`${API_URL}/orders/`);
        const ordenes = await res.json();

        const disponibles = ordenes.filter(o => o.tecnico_id === null && o.estado !== "Finalizado");
        const tomadasPorMi = ordenes.filter(o => o.tecnico_id === tec.id && o.estado !== "Finalizado");

        if (counter) counter.textContent = tomadasPorMi.length;

        dispList.innerHTML = "";
        if (!disponibles.length) {
            dispList.innerHTML = `<p class="text-xs text-slate-500">No hay órdenes libres en este momento.</p>`;
        } else {
            disponibles.forEach(ord => {
                dispList.innerHTML += `
                    <li class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
                        <div>
                            <p class="text-sm font-bold text-slate-200">Equipo: ${ord.equipo}</p>
                            <p class="text-xs text-slate-400">Problema: ${ord.descripcion}</p>
                        </div>
                        <button onclick="tomarOrden(${ord.id})" class="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-semibold rounded-xl border border-emerald-500/30 transition-all">Tomar Órden</button>
                    </li>
                `;
            });
        }

        tomadasList.innerHTML = "";
        if (!tomadasPorMi.length) {
            tomadasList.innerHTML = `<p class="text-xs text-slate-500">No has tomado ninguna orden todavía.</p>`;
        } else {
            tomadasPorMi.forEach(ord => {
                tomadasList.innerHTML += `
                    <li class="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-3">
                        <div class="flex justify-between items-center">
                            <p class="text-sm font-bold text-slate-200">Equipo: ${ord.equipo}</p>
                            <span class="text-xs font-mono text-emerald-400">#${ord.id} - ${ord.estado}</span>
                        </div>
                        <p class="text-xs text-slate-400">Falla: ${ord.descripcion}</p>
                        
                        <div class="space-y-2 pt-2 border-t border-slate-800">
                            <label class="block text-[11px] text-slate-400 uppercase font-semibold">Actualizar Avance en Tiempo Real:</label>
                            <input type="text" id="avance-input-${ord.id}" value="${ord.avance_realtime || ''}" placeholder="Ej. Cambio de pantalla completado, testeando..." class="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200">
                            
                            <div class="flex gap-2 justify-end pt-1">
                                <button onclick="guardarAvance(${ord.id}, 'En Reparación')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg">Guardar Avance</button>
                                <button onclick="guardarAvance(${ord.id}, 'Finalizado')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg">Finalizar Trabajo</button>
                            </div>
                        </div>
                    </li>
                `;
            });
        }
    } catch (err) {
        console.error("Error obteniendo órdenes técnico:", err);
    }
}

// TOMAR ORDEN (Máximo 4)
async function tomarOrden(ordenId) {
    const tec = JSON.parse(localStorage.getItem("tecnicoActivo") || "null");
    if (!tec) return alert("Debes iniciar sesión como técnico.");

    try {
        const res = await fetch(`${API_URL}/orders/tomar/${ordenId}/${tec.id}`, { method: "PUT" });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "No se pudo tomar la orden");
        }
        alert("¡Órden asignada con éxito!");
        obtenerOrdenesTecnico();
    } catch (err) {
        alert(err.message);
    }
}

// GUARDAR AVANCE EN TIEMPO REAL
async function guardarAvance(ordenId, nuevoEstado) {
    const input = document.getElementById(`avance-input-${ordenId}`);
    const textoAvance = input ? input.value : "";

    try {
        const res = await fetch(`${API_URL}/orders/actualizar-avance/${ordenId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado, avance_realtime: textoAvance })
        });
        if (!res.ok) throw new Error("No se pudo guardar el avance");
        alert("¡Avance actualizado!");
        obtenerOrdenesTecnico();
    } catch (err) {
        alert(err.message);
    }
}