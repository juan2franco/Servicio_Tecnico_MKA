const API_URL = "http://127.0.0.1:8000";

// --- NAVEGACIÓN SPA ENTRE VISTAS PRINCIPALES ---
function navTo(targetView) {
  // Ocultar todas las secciones principales
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));

  // Mostrar la vista seleccionada
  const activeView = document.getElementById(`view-${targetView}`);
  if (activeView) activeView.classList.remove('hidden');

  // Controlar botón de Cerrar Sesión en Header
  const btnLogout = document.getElementById('btn-logout');
  if (targetView === 'landing' || targetView.startsWith('auth-')) {
    btnLogout?.classList.add('hidden');
  } else {
    btnLogout?.classList.remove('hidden');
  }

  // Cargar datos al entrar a dashboards
  if (targetView === 'dashboard-cliente') obtenerOrdenes();
  if (targetView === 'dashboard-tecnico') obtenerOrdenesTecnico();
}
window.navTo = navTo;

// Simulación de Login para pruebas de frontend
function simularLogin(e, targetDashboard) {
  e.preventDefault();
  navTo(targetDashboard);
}
window.simularLogin = simularLogin;

// PESTAÑAS DASHBOARD CLIENTE 
function switchTabCliente(tab) {
  ['ordenes', 'dispositivos', 'datos'].forEach(t => {
    document.getElementById(`subview-cli-${t}`)?.classList.add('hidden');
    document.getElementById(`tab-cli-${t}`)?.classList.remove('bg-indigo-600/20', 'text-indigo-400', 'border', 'border-indigo-500/30');
    document.getElementById(`tab-cli-${t}`)?.classList.add('text-slate-400');
  });

  document.getElementById(`subview-cli-${tab}`)?.classList.remove('hidden');
  const activeBtn = document.getElementById(`tab-cli-${tab}`);
  activeBtn?.classList.remove('text-slate-400');
  activeBtn?.classList.add('bg-indigo-600/20', 'text-indigo-400', 'border', 'border-indigo-500/30');
}
window.switchTabCliente = switchTabCliente;

// PESTAÑAS DASHBOARD TÉCNICO 
function switchTabTecnico(tab) {
  ['ordenes', 'datos'].forEach(t => {
    document.getElementById(`subview-tec-${t}`)?.classList.add('hidden');
    document.getElementById(`tab-tec-${t}`)?.classList.remove('bg-emerald-600/20', 'text-emerald-400', 'border', 'border-emerald-500/30');
    document.getElementById(`tab-tec-${t}`)?.classList.add('text-slate-400');
  });

  document.getElementById(`subview-tec-${tab}`)?.classList.remove('hidden');
  const activeBtn = document.getElementById(`tab-tec-${tab}`);
  activeBtn?.classList.remove('text-slate-400');
  activeBtn?.classList.add('bg-emerald-600/20', 'text-emerald-400', 'border', 'border-emerald-500/30');
}
window.switchTabTecnico = switchTabTecnico;

// PETICIONES API Y FORMULARIOS 

// Guardar Cliente (Registro)
document.getElementById('client-form')?.addEventListener('submit', async (e) => {
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
      navTo('dashboard-cliente');
    }
  } catch (err) {
    console.error("Error al registrar cliente:", err);
  }
});

// Guardar Técnico (Registro)
document.getElementById('tecnico-form')?.addEventListener('submit', async (e) => {
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
      navTo('dashboard-tecnico');
    }
  } catch (err) {
    console.error("Error al registrar técnico:", err);
  }
});

// Crear Orden de Servicio
document.getElementById('orden-form')?.addEventListener('submit', async (e) => {
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
      document.getElementById('orden-form').reset();
      obtenerOrdenes();
    }
  } catch (err) {
    console.error("Error al crear orden:", err);
  }
});

// Obtener Órdenes Cliente
async function obtenerOrdenes() {
  try {
    const res = await fetch(`${API_URL}/Ordenes/`);
    if (!res.ok) return;
    const ordenes = await res.json();
    const list = document.getElementById('ordenes-list');
    if (!list) return;

    list.innerHTML = ordenes.length ? '' : '<p class="text-slate-400 text-sm">No tienes órdenes creadas.</p>';
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
    console.error(err);
  }
}

// Obtener Órdenes Vista Técnico
async function obtenerOrdenesTecnico() {
  try {
    const res = await fetch(`${API_URL}/Ordenes/`);
    if (!res.ok) return;
    const ordenes = await res.json();
    const list = document.getElementById('tecnico-ordenes-list');
    if (!list) return;

    list.innerHTML = ordenes.length ? '' : '<p class="text-slate-400 text-sm">No hay órdenes pendientes de revisión.</p>';
    ordenes.forEach(o => {
      list.innerHTML += `
        <li class="p-4 bg-slate-900/60 border border-slate-700/50 rounded-lg flex justify-between items-center">
          <div>
            <p class="font-semibold text-slate-200">Equipo: ${o.equipo}</p>
            <p class="text-xs text-slate-400 mt-0.5">Reporte del cliente: ${o.descripcion}</p>
          </div>
          <button class="text-xs px-3 py-1.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-colors">
            Diagnosticar
          </button>
        </li>`;
    });
  } catch (err) {
    console.error(err);
  }
}
window.obtenerOrdenesTecnico = obtenerOrdenesTecnico;

// Cargar vista inicial
document.addEventListener('DOMContentLoaded', () => navTo('landing'));