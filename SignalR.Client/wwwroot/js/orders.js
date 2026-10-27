"use strict";

const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://localhost:7001/orderHub")
    .withAutomaticReconnect()
    .build();

const labels = {
    Pendiente: "Pendiente",
    EnPreparacion: "En preparación",
    Enviado: "Enviado",
    Entregado: "Entregado"
};
const flow = ["Pendiente", "EnPreparacion", "Enviado", "Entregado"];

const followButton = document.getElementById("followButton");
const advanceButton = document.getElementById("advanceButton");
const status = document.getElementById("status");
const currentStatus = document.getElementById("currentStatus");
const steps = document.getElementById("steps");
const history = document.getElementById("history");

let followedOrder = null;
let currentState = null;

function render() {
    currentStatus.textContent = currentState ? labels[currentState] : "-";

    const reached = currentState ? flow.indexOf(currentState) : -1;
    [...steps.children].forEach((li, index) => {
        li.className = index <= reached ? "text-success fw-bold" : "text-muted";
    });

    const next = reached >= 0 ? flow[reached + 1] : null;
    advanceButton.disabled = !next ||
        connection.state !== signalR.HubConnectionState.Connected;
    advanceButton.textContent = next
        ? `Avanzar a: ${labels[next]}`
        : "Pedido entregado";
}

connection.on("OrderStatusChanged", (notification) => {
    if (notification.orderId !== followedOrder) return;

    currentState = notification.status;

    const time = new Date(notification.changedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });
    const item = document.createElement("li");
    item.textContent = `[${time}] Pedido ${notification.orderId}: ${labels[notification.status]}`;
    history.appendChild(item);

    render();
});

connection.onreconnecting(() => {
    status.textContent = "Reconectando...";
    followButton.disabled = true;
    advanceButton.disabled = true;
});

// Al reconectar se pierde el grupo: hay que volver a seguir el pedido
connection.onreconnected(async () => {
    try {
        if (followedOrder !== null) {
            await connection.invoke("JoinOrder", followedOrder);
        }
        status.textContent = "Conectado";
        followButton.disabled = false;
        render();
    } catch (error) {
        status.textContent = "Error al volver al pedido";
        console.error(error);
    }
});

connection.onclose(() => {
    status.textContent = "Desconectado. Recarga la página.";
    followButton.disabled = true;
    advanceButton.disabled = true;
});

async function startConnection() {
    try {
        await connection.start();
        status.textContent = "Conectado";
        followButton.disabled = false;
    } catch (error) {
        status.textContent = "Error de conexión";
        console.error(error);
    }
}

followButton.addEventListener("click", async () => {
    const orderId = Number(document.getElementById("orderId").value);

    if (!Number.isInteger(orderId) || orderId <= 0) {
        alert("Escribe un número de pedido válido.");
        return;
    }

    try {
        if (followedOrder !== null) {
            await connection.invoke("LeaveOrder", followedOrder);
        }
        followedOrder = orderId;
        currentState = null;
        history.innerHTML = "";
        await connection.invoke("JoinOrder", orderId);
    } catch (error) {
        console.error("No se pudo seguir el pedido:", error);
    }
});

advanceButton.addEventListener("click", async () => {
    const reached = flow.indexOf(currentState);
    const next = flow[reached + 1];
    if (!next) return;

    try {
        await connection.invoke("ChangeStatus", followedOrder, next);
    } catch (error) {
        console.error("No se pudo cambiar el estado:", error);
        alert(error.message);
    }
});

startConnection();