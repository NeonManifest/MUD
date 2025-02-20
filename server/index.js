const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors"); // You'll need to install this: npm install cors

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // In production, replace with your GitHub Pages URL
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// API routes
app.get("/api/example", (req, res) => {
  res.json({ message: "This is an example API route" });
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("command", (command) => {
    const [cmd, ...args] = command.split(" ");

    switch (cmd.toLowerCase()) {
      case "say":
        if (args.length > 0) {
          const message = args.join(" ");
          io.emit("message", `${socket.id} says: ${message}`);
        } else {
          socket.emit("message", "What do you want to say?");
        }
        break;
      default:
        socket.emit("message", "Unknown command");
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
