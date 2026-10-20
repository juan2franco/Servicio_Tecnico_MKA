const API_URL = "http://127.0.0.1:8000";

// ==========================================
// 1. NAVEGACIÓN ENTRE VISTAS (SPA)
// ==========================================
function navTo(targetView) {
  // Ocultar todas las secciones de vista
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));
  
  // Quitar estilo activo de los botones del sidebar
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border', 'border-indigo-500/30');
    btn.classList.add('text-slate-400');
  });

  // Mostrar la vista seleccionada
  const activeView = document.getElementById(`view-${targetView}`);
  if (activeView) {
    activeView.classList.remove('hidden');
  }

  // Resaltar el botón presionado
  const activeBtn = document.getElementById(`nav-btn-${targetView}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400');
    activeBtn.classList.add('bg-indigo-600/20', 'text-indigo-400', 'border', 'border-indigo-500/30');
  }

  // Cargar los datos desde la API según el módulo
  if (targetView === 'clientes') obtenerClientes();
  if (targetView === 'tecnicos') obtenerTecnicos();
  if (targetView === 'ordenes') obtenerOrdenes();
}

// Hacer que navTo esté disponible globalmente en window (para los onclick="" del HTML)
window.navTo = navTo;

// ==========================================
// 2. MÓDULO CLIENTES
// ==========================================
async function obtenerClientes() {
  try {
    const res = await fetch(`${API_URL}/Clientes/`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const clientes = await res.json();
    
    const list = document.getElementById('clientes-list');
    if (!list) return;

    list.innerHTML = clientes.length ? '' : '<p class="text-slate-400 text-sm">No hay clientes registrados.</p>';

    clientes.forEach(c => {
      list.innerHTML += `
        <li class="p-4 bg-slate-900/60 border border-slate-700/50 rounded-lg flex justify-between items-center">
          <div>
            <p class="font-semibold text-slate-200">${c.full_name}</p>
            <p class="text-xs text-slate-400 mt-0.5">
              ${c.document_type || 'Doc'}: ${c.document_id || 'N/A'} | Tel: ${c.phone} | Correo: ${c.email || 'N/A'}
            </p>
            <p class="text-xs text-slate-500">Dir: ${c.direccion}</p>
          </div>
          <span class="text-xs px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md font-mono">
            ID: ${c.id}
          </span>
        </li>`;
    });
  } catch (err) {
    console.error("Error al obtener clientes:", err);
  }
}
window.obtenerClientes = obtenerClientes;

// ==========================================
// 3. MÓDULO TÉCNICOS
// ==========================================
async function obtenerTecnicos() {
  try {
    const res = await fetch(`${API_URL}/Tecnicos/`);
    if (!res.ok) return;
    const tecnicos = await res.json();
    
    const list = document.getElementById('tecnicos-list');
    if (!list) return;

    list.innerHTML = tecnicos.length ? '' : '<p class="text-slate-400 text-sm">No hay técnicos registrados.</p>';

    tecnicos.forEach(t => {
      list.innerHTML += `
        <li class="p-4 bg-slate-900/60 border border-slate-700/50 rounded-lg flex justify-between items-center">
          <div>
            <p class="font-semibold text-slate-200">${t.nombre}</p>
            <p class="text-xs text-slate-400 mt-0.5">Especialidad: ${t.especialidad || 'General'} | Tel: ${t.telefono || 'N/A'}</p>
          </div>
          <span class="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-mono">
            ID: ${t.id}
          </span>
        </li>`;
    });
  } catch (err) {
    console.error("Error al obtener técnicos:", err);
  }
}
window.obtenerTecnicos = obtenerTecnicos;

// ==========================================
// 4. MÓDULO ÓRDENES
// ==========================================
async function obtenerOrdenes() {
  try {
    const res = await fetch(`${API_URL}/Ordenes/`);
    if (!res.ok) return;
    const ordenes = await res.json();
    
    const list = document.getElementById('ordenes-list');
    if (!list) return;

    list.innerHTML = ordenes.length ? '' : '<p class="text-slate-400 text-sm">No hay órdenes registradas.</p>';

    ordenes.forEach(o => {
      list.innerHTML += `
        <li class="p-4 bg-slate-900/60 border border-slate-700/50 rounded-lg flex justify-between items-center">
          <div>
            <p class="font-semibold text-slate-200">Equipo: ${o.equipo}</p>
            <p class="text-xs text-slate-400 mt-0.5">Cliente ID: ${o.cliente_id} | Detalle: ${o.descripcion}</p>
          </div>
          <span class="text-xs px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md font-mono">
            Orden #${o.id}
          </span>
        </li>`;
    });
  } catch (err) {
    console.error("Error al obtener órdenes:", err);
  }
}
window.obtenerOrdenes = obtenerOrdenes;

// ==========================================
// 5. EVENT LISTENERS PARA FORMULARIOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  
  // Guardar Cliente
  const clientForm = document.getElementById('client-form');
  if (clientForm) {
    clientForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        full_name: document.getElementById('full_name').value,
        document_type: document.getElementById('document_type').value,
        document_id: document.getElementById('document_id').value,
        phone: document.getElementById('phone').value,
        email: document.getElementById('email').value || null,
        direccion: document.getElementById('direccion').value
      };

      try {
        const res = await fetch(`${API_URL}/Clientes/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          clientForm.reset();
          obtenerClientes();
        } else {
          console.error("Error al guardar cliente. Estado HTTP:", res.status);
        }
      } catch (err) {
        console.error("Error de red al guardar cliente:", err);
      }
    });
  }

  // Guardar Técnico
  const tecForm = document.getElementById('tecnico-form');
  if (tecForm) {
    tecForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        nombre: document.getElementById('tec-nombre').value,
        especialidad: document.getElementById('tec-especialidad').value,
        telefono: document.getElementById('tec-telefono').value
      };

      try {
        const res = await fetch(`${API_URL}/Tecnicos/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          tecForm.reset();
          obtenerTecnicos();
        }
      } catch (err) {
        console.error("Error de red al guardar técnico:", err);
      }
    });
  }

  // Guardar Orden
  const ordForm = document.getElementById('orden-form');
  if (ordForm) {
    ordForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        cliente_id: parseInt(document.getElementById('ord-cliente-id').value),
        equipo: document.getElementById('ord-equipo').value,
        descripcion: document.getElementById('ord-descripcion').value
      };

      try {
        const res = await fetch(`${API_URL}/Ordenes/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (res.ok) {
          ordForm.reset();
          obtenerOrdenes();
        }
      } catch (err) {
        console.error("Error de red al guardar orden:", err);
      }
    });
  }

  // Cargar vista inicial al abrir la página
  navTo('clientes');
});