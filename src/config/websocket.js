const WebSocket = require("ws");

const clients = new Map();

function initWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  console.log("✅ WebSocket server started");

  wss.on("connection", (ws) => {
    console.log("🔌 Client connected");

    // Khi client gửi dữ liệu lên (thường để xác định userId)
    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);
        if (data.type === "register") {
          // Lưu userId vào map
          clients.set(String(data.userId), ws);
          ws.userId = data.userId;
          console.log(`✅ User ${data.userId} registered WebSocket`);
        }
        ư;
      } catch (err) {
        console.error("❌ Invalid message format:", msg);
      }
    });
    ws.on("close", () => {
      console.log(`❌ Client disconnected: ${ws.userId}`);
      clients.delete(ws.userId);
    });
  });
}
function sendToUser(userId, data) {
  const client = clients.get(String(userId));
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}
module.exports = { initWebSocket, sendToUser };
