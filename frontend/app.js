// URL base de tu backend de FastAPI
const API_URL = "http://localhost:8000";

document.addEventListener("DOMContentLoaded", () => {
    console.log("¡MKA Frontend inicializado y listo!");

    // Cargar datos del cliente si ya hay una sesión guardada
    cargarDatosCliente();

    // ==========================================
    // 1. CONTROL DE NAVEGACIÓN Y VISTAS (PROTOTIPO)
    // ==========================================
    window.navTo = function(viewId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const target = document.getElementById(`view-${viewId}`);
        if (target) {
            target.classList.remove('hidden');
        } else {
            console.warn(`No se encontró la vista con ID: view-${viewId}`);
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            if (viewId === 'landing') {
                logoutBtn.classList.add('hidden');
            } else {
                logoutBtn.classList.remove('hidden');
            }
        }
    };

    window.simularLogin = function(event, dashboardId) {
        event.preventDefault();
        navTo(dashboardId);
        if (dashboardId === 'dashboard-cliente') {
            fetchOrdenes();
        } else if (dashboardId === 'dashboard-tecnico') {
            obtenerOrdenesTecnico();
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
    };

    // ==========================================
    // 2. CONEXIÓN CON EL BACKEND (FASTAPI)
    // ==========================================

    // Registro de Cliente (POST)
    const clientForm = document.getElementById("client-form");
    if (clientForm) {
        clientForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            console.log("Intentando registrar cliente...");

            const data = {
                full_name: document.getElementById("full_name")?.value || "",
                document_type: document.getElementById("document_type")?.value || "CC",
                document_id: document.getElementById("document_id")?.value || "",
                email: document.getElementById("email")?.value || "",
                phone: document.getElementById("phone")?.value || "",
                direccion: document.getElementById("direccion")?.value || ""
            };

            try {
                const response = await fetch(`${API_URL}/clients/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const errData = await response.json();
                    let mensaje = errData.detail;
                    if (Array.isArray(mensaje)) {
                        mensaje = mensaje.map(err => `${err.loc.join('.')}: ${err.msg}`).join(' | ');
                    }
                    throw new Error(mensaje || "Error al registrar cliente");
                }

                const clienteCreado = await response.json();
                localStorage.setItem("clienteActivo", JSON.stringify(clienteCreado));

                alert("¡Cliente registrado con éxito!");
                clientForm.reset();
                cargarDatosCliente();
                navTo("dashboard-cliente");
                fetchOrdenes();
            } catch (error) {
                console.error("Error en cliente:", error);
                alert("Hubo un error al registrar el cliente: " + error.message);
            }
        });
    }

    // Registro de Técnico (POST)
    const tecnicoForm = document.getElementById("tecnico-form");
    if (tecnicoForm) {
        tecnicoForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            console.log("Intentando registrar técnico...");

            const data = {
                nombre: document.getElementById("tec-nombre")?.value || "",
                especialidad: document.getElementById("tec-especialidad")?.value || "",
                telefono: document.getElementById("tec-telefono")?.value || ""
            };

            try {
                const response = await fetch(`${API_URL}/tecnicos/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    let mensaje = errData.detail;
                    if (Array.isArray(mensaje)) {
                        mensaje = mensaje.map(err => `${err.loc.join('.')}: ${err.msg}`).join(' | ');
                    }
                    throw new Error(mensaje || "Error al registrar técnico");
                }

                alert("¡Técnico registrado con éxito!");
                tecnicoForm.reset();
                navTo("dashboard-tecnico");
                obtenerOrdenesTecnico();
            } catch (error) {
                console.error("Error en técnico:", error);
                alert("Hubo un error al registrar el técnico: " + error.message);
            }
        });
    }
});

// ==========================================
// 3. CAPTURA DE ÓRDENES Y CONSULTAS
// ==========================================

document.addEventListener("click", async (e) => {
    const targetText = e.target.textContent.trim().toLowerCase();
    if (e.target && (e.target.id === "btn-crear-orden" || targetText.includes("crear órden") || targetText.includes("crear orden"))) {
        e.preventDefault();
        console.log("¡Clic detectado en botón de crear orden!");

        const clienteIdInput = document.getElementById("ord-cliente-id") || document.getElementById("cliente_id");
        const equipoInput = document.getElementById("ord-equipo") || document.getElementById("equipo");
        const descripcionInput = document.getElementById("ord-descripcion") || document.getElementById("descripcion");

        if (!clienteIdInput || !equipoInput || !descripcionInput) {
            alert("Error: Faltan campos en el formulario de órdenes. Revisa los IDs de los inputs.");
            return;
        }

        const data = {
            cliente_id: parseInt(clienteIdInput.value),
            equipo: equipoInput.value,
            descripcion: descripcionInput.value,
            estado: "Solicitado"
        };

        try {
            const response = await fetch(`${API_URL}/orders/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errData = await response.json();
                let mensaje = errData.detail;
                if (Array.isArray(mensaje)) {
                    mensaje = mensaje.map(err => `${err.loc.join('.')}: ${err.msg}`).join(' | ');
                }
                throw new Error(mensaje || "Error al crear orden");
            }

            alert("¡Orden de servicio creada con éxito!");
            
            const ordenForm = document.getElementById("orden-form");
            if (ordenForm) ordenForm.reset();

            fetchOrdenes();
        } catch (error) {
            console.error("Error en orden:", error);
            alert("Error al crear la orden: " + error.message);
        }
    }
});

function cargarDatosCliente() {
    const clienteGuardado = localStorage.getItem("clienteActivo");
    if (!clienteGuardado) return;
    try {
        const cli = JSON.parse(clienteGuardado);
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
        
        const ordClienteInput = document.getElementById("ord-cliente-id");
        if (ordClienteInput && cli.id) {
            ordClienteInput.value = cli.id;
        }
    } catch (e) {
        console.error("Error cargando perfil del cliente", e);
    }
}

async function fetchOrdenes() {
    const listContainer = document.getElementById("ordenes-list");
    if (!listContainer) return;

    try {
        const response = await fetch(`${API_URL}/orders/`);
        if (!response.ok) throw new Error("Error al obtener órdenes");
        const ordenes = await response.json();

        listContainer.innerHTML = "";
        if (ordenes.length === 0) {
            listContainer.innerHTML = `<p class="text-xs text-slate-500">No hay órdenes registradas todavía.</p>`;
            return;
        }

        ordenes.forEach(ord => {
            listContainer.innerHTML += `
                <li class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                        <p class="text-sm font-bold text-slate-200">${ord.equipo}</p>
                        <p class="text-xs text-slate-400">${ord.descripcion}</p>
                        <span class="inline-block mt-2 px-2.5 py-1 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/20">Estado: ${ord.estado}</span>
                    </div>
                    <span class="text-xs font-mono text-slate-500">#${ord.id}</span>
                </li>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function obtenerOrdenesTecnico() {
    const listContainer = document.getElementById("tecnico-ordenes-list");
    if (!listContainer) return;

    try {
        const response = await fetch(`${API_URL}/orders/`);
        if (!response.ok) throw new Error("Error al obtener órdenes");
        const ordenes = await response.json();

        listContainer.innerHTML = "";
        if (ordenes.length === 0) {
            listContainer.innerHTML = `<p class="text-xs text-slate-500">No hay equipos en cola de mantenimiento.</p>`;
            return;
        }

        ordenes.forEach(ord => {
            listContainer.innerHTML += `
                <li class="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex justify-between items-center">
                    <div>
                        <p class="text-sm font-bold text-slate-200">Equipo: ${ord.equipo}</p>
                        <p class="text-xs text-slate-400">Problema: ${ord.descripcion}</p>
                        <p class="text-[10px] text-emerald-400 font-mono mt-1">Estado actual: ${ord.estado}</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="actualizarEstadoOrden(${ord.id}, 'En Reparación')" class="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white text-xs font-semibold rounded-xl border border-emerald-500/30 transition-all">Reparar</button>
                        <button onclick="actualizarEstadoOrden(${ord.id}, 'Finalizado')" class="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white text-xs font-semibold rounded-xl border border-blue-500/30 transition-all">Finalizar</button>
                    </div>
                </li>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

async function actualizarEstadoOrden(ordenId, nuevoEstado) {
    try {
        const response = await fetch(`${API_URL}/orders/${ordenId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: nuevoEstado })
        });
        if (!response.ok) throw new Error("No se pudo actualizar el estado");
        alert(`Orden #${ordenId} actualizada a: ${nuevoEstado}`);
        obtenerOrdenesTecnico();
    } catch (error) {
        console.error(error);
        alert("Error al actualizar el estado de la orden.");
    }
}