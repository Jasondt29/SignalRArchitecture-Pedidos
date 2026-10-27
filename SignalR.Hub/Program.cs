using System.Text.Json.Serialization;
using SignalR.HubServer.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("ClientPolicy", policy =>
    {
        policy
            .WithOrigins("https://localhost:7002")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// El enum viaja como texto ("Enviado") y no como número (2)
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

var app = builder.Build();

app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("ClientPolicy");

app.MapHub<ChatHub>("/chatHub");
app.MapHub<OrderHub>("/orderHub");

app.Run();