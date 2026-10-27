namespace SignalR.Shared.Contracts;

public sealed record OrderNotification(
    int OrderId,
    OrderStatus Status,
    DateTimeOffset ChangedAt);