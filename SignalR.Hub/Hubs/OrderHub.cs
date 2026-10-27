using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using SignalR.Shared.Contracts;

namespace SignalR.HubServer.Hubs;

public sealed class OrderHub : Microsoft.AspNetCore.SignalR.Hub
{
    // Estado de cada pedido en memoria (sin base de datos en esta versión)
    private static readonly ConcurrentDictionary<int, OrderStatus> Orders = new();

    public async Task JoinOrder(int orderId)
    {
        ValidateOrderId(orderId);

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(orderId));

        // Le informa al que se une cuál es el estado actual
        var current = Orders.GetOrAdd(orderId, OrderStatus.Pendiente);
        await Clients.Caller.SendAsync("OrderStatusChanged",
            new OrderNotification(orderId, current, DateTimeOffset.UtcNow));
    }

    public async Task LeaveOrder(int orderId)
    {
        ValidateOrderId(orderId);
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(orderId));
    }

    public async Task ChangeStatus(int orderId, OrderStatus status)
    {
        ValidateOrderId(orderId);

        if (!Enum.IsDefined(status))
        {
            throw new HubException("Estado no válido.");
        }

        var current = Orders.GetOrAdd(orderId, OrderStatus.Pendiente);

        // Solo se puede avanzar al siguiente estado, sin saltos ni retrocesos
        if ((int)status != (int)current + 1)
        {
            throw new HubException($"Transición no válida: {current} a {status}.");
        }

        // TryUpdate evita que dos cambios simultáneos se pisen
        if (!Orders.TryUpdate(orderId, status, current))
        {
            throw new HubException("El pedido cambió mientras lo actualizabas. Intenta de nuevo.");
        }

        await Clients.Group(GroupName(orderId)).SendAsync("OrderStatusChanged",
            new OrderNotification(orderId, status, DateTimeOffset.UtcNow));
    }

    private static string GroupName(int orderId) => $"order-{orderId}";

    private static void ValidateOrderId(int orderId)
    {
        if (orderId <= 0)
        {
            throw new HubException("El número de pedido no es válido.");
        }
    }
}