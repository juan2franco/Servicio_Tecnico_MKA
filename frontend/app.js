const BASE_URL = "http://127.0.0.1:8000";

// Click
function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

    document.getElementById(`tab-${tabName}`).classList.add("active");
    event.currentTarget.classList.add("active");

    // ERE
    if (tabName === 'clientes') fetchClients();
    if (tabName === 'tecnicos') fetchTechs();
    if (tabName === 'ordenes') fetchOrders();
}

document.addEventListener("DOMContentLoaded", () => {
    fetchClients();
});

// CLIENTES
function fetchClients() {
    fetch(`${BASE_URL}/Clientes/`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById("clients-table-body");
            tbody.innerHTML = "";
            data.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td>${c.id}</td>
                        <td>${c.full_name}</td>
                        <td>${c.document_type}: ${c.document_id}</td>
                        <td>${c.phone}</td>
                        <td>${c.email || 'N/A'}</td>
                    </tr>`;
            });
        });
}

document.getElementById("client-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const newClient = {
        full_name: document.getElementById("client_name").value,
        document_type: document.getElementById("client_doc_type").value,
        document_id: document.getElementById("client_doc_id").value,
        phone: document.getElementById("client_phone").value,
        email: document.getElementById("client_email").value || null
    };

    fetch(`${BASE_URL}/Clientes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient)
    }).then(() => {
        alert("Cliente guardado!");
        document.getElementById("client-form").reset();
        fetchClients();
    });
});

// TÉCNICOS 
function fetchTechs() {
    fetch(`${BASE_URL}/Tecnicos/`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById("techs-table-body");
            tbody.innerHTML = "";
            data.forEach(t => {
                tbody.innerHTML += `
                    <tr>
                        <td>${t.id}</td>
                        <td>${t.full_name}</td>
                        <td>${t.document_type}: ${t.document_id}</td>
                        <td>${t.especiality}</td>
                        <td>${t.phone}</td>
                        <td>${t.email || 'N/A'}</td>
                    </tr>`;
            });
        })
        .catch(err => console.error("Error al cargar técnicos:", err));
}

document.getElementById("tech-form").addEventListener("submit", (e) => {
    e.preventDefault();
    
    const newTech = {
        full_name: document.getElementById("tech_name").value,
        document_type: document.getElementById("tech_doc_type").value,
        document_id: document.getElementById("tech_doc_id").value,
        especiality: document.getElementById("tech_specialty").value,
        phone: document.getElementById("tech_phone").value,
        email: document.getElementById("tech_email").value || null
    };

    fetch(`${BASE_URL}/Tecnicos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTech)
    })
    .then(res => {
        if (!res.ok) throw new Error("Error guardando técnico");
        return res.json();
    })
    .then(() => {
        alert("Técnico guardado correctamente!");
        document.getElementById("tech-form").reset();
        fetchTechs();
    })
    .catch(err => console.error("Error:", err));
});
// ÓRDENES
function fetchOrders() {
    fetch(`${BASE_URL}/Ordenes/`)
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById("orders-table-body");
            tbody.innerHTML = "";
            data.forEach(o => {
                tbody.innerHTML += `
                    <tr>
                        <td>${o.id}</td>
                        <td>${o.client_id}</td>
                        <td>${o.tecnico_id}</td>
                        <td>${o.device}</td>
                        <td>${o.description}</td>
                        <td><strong>${o.status || 'PENDIENTE'}</strong></td>
                    </tr>`;
            });
        });
}

document.getElementById("order-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const newOrder = {
        client_id: parseInt(document.getElementById("order_client_id").value),
        tecnico_id: parseInt(document.getElementById("order_tech_id").value),
        device: document.getElementById("order_device").value,
        description: document.getElementById("order_description").value
    };

    fetch(`${BASE_URL}/Ordenes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrder)
    }).then(() => {
        alert("Orden creada!");
        document.getElementById("order-form").reset();
        fetchOrders();
    });
});