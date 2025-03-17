const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { db, auth } = require("./firebase");
const { Player } = require("./entities/entity");
const Filter = require("bad-words");

// Helper function to get the opposite direction
function getOppositeDirection(direction) {
  const opposites = {
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up",
  };
  return opposites[direction] || "somewhere";
}

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

// Game world data
const world = {
  rooms: {
    "town-square": {
      name: "Town Square",
      description:
        "The central square of a small town. Streets lead in all directions.",
      exits: {
        north: "north-street",
        east: "market",
        south: "south-street",
        west: "tavern",
      },
    },
    "north-street": {
      name: "North Street",
      description: "A quiet street leading north from the town square.",
      exits: {
        south: "town-square",
      },
    },
    market: {
      name: "Market",
      description: "A bustling market with various stalls and shops.",
      exits: {
        west: "town-square",
      },
    },
    "south-street": {
      name: "South Street",
      description: "A street heading south toward the town gate.",
      exits: {
        north: "town-square",
      },
    },
    tavern: {
      name: "Tavern",
      description: "A cozy tavern with a warm fireplace and the smell of ale.",
      exits: {
        east: "town-square",
      },
    },
  },
};

// Player data
const players = {};

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("A user connected");

  // Initialize player in limbo
  players[socket.id] = {
    id: socket.id,
    name: null,
    currentRoom: "limbo",
  };

  // Send welcome message
  socket.emit("message", "Welcome to the MUD! Please register or log in.");

  socket.on("register", async ({ idToken, characterName, clan }) => {
    try {
      // Verify the ID token using Firebase Admin SDK
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Validate the clan input
      const validClans = [
        "Yellow Dog",
        "Red Bird",
        "Green Frog",
        "Blue Flower",
      ];
      if (!validClans.includes(clan)) {
        throw new Error("Invalid Clan");
      }

      const filter = new Filter();
      if (filter.isProfane(characterName)) {
        throw new Error("Character name contains inappropriate language");
      }

      const player = new Player(characterName, "A new adventurer", clan);
      await db.collection("characters").doc(uid).set({
        name: player.name,
        attributes: player.attributes,
        inventory: player.inventory,
        clan: player.clan,
      });

      players[socket.id].name = characterName;
      socket.emit(
        "message",
        "Registration successful! You can now enter the game."
      );
    } catch (error) {
      socket.emit("message", `Registration failed: ${error.message}`);
    }
  });

  socket.on("login", async (idToken) => {
    try {
      // Verify the ID token using Firebase Admin SDK
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Check if the player is already connected
      const isAlreadyConnected = Object.values(players).some(
        (player) => player.uid === uid
      );
      if (isAlreadyConnected) {
        socket.emit(
          "message",
          "You are already logged in from another session."
        );
        return;
      }
      // Retrieve the character document from Firestore
      const characterDoc = await db.collection("characters").doc(uid).get();
      if (characterDoc.exists) {
        const characterData = characterDoc.data();
        players[socket.id].name = characterData.name;
        players[socket.id].uid = uid; // Store the uid to track connections
        players[socket.id].currentRoom = "town-square"; // Move player to starting room
        const townSquare = world.rooms["town-square"];
        socket.emit(
          "message",
          `Welcome back, ${characterData.name}! You are now in the town square.`
        );
        socket.emit("message", townSquare.description);
      } else {
        socket.emit("message", "Character not found.");
      }
    } catch (error) {
      socket.emit("message", `Login failed: ${error.message}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    delete players[socket.id];
  });

  socket.on("command", (command) => {
    const player = players[socket.id];
    // Check if the player is logged in
    if (!player.name) {
      socket.emit("message", "You must be logged in to perform commands.");
      return;
    }
    const [cmd, ...args] = command.split(" ");

    switch (cmd.toLowerCase()) {
      case "say":
        if (args.length > 0) {
          const message = args.join(" ");
          // Send message to all players in the same room
          Object.values(players).forEach((p) => {
            if (p.currentRoom === player.currentRoom) {
              io.to(p.id).emit("message", `${player.name} says: ${message}`);
            }
          });
        } else {
          socket.emit("message", "You say nothing. What do you want to say?");
        }
        break;
      case "who":
        // List all players in the current room
        const playersInRoom = Object.values(players).filter(
          (p) => p.currentRoom === player.currentRoom
        );
        if (playersInRoom.length === 1) {
          socket.emit("message", "You are alone here.");
        } else {
          const otherPlayers = playersInRoom.filter((p) => p.id !== socket.id);
          socket.emit(
            "message",
            "Players here: " + otherPlayers.map((p) => p.name).join(", ")
          );
        }
        break;
      case "look":
        const room = world.rooms[player.currentRoom];
        socket.emit("message", `${room.name}`);
        socket.emit("message", room.description);

        // Add player information to the look command
        const otherPlayersInRoom = Object.values(players).filter(
          (p) => p.currentRoom === player.currentRoom && p.id !== socket.id
        );
        if (otherPlayersInRoom.length > 0) {
          socket.emit(
            "message",
            `Also here: ${otherPlayersInRoom.map((p) => p.name).join(", ")}`
          );
        }

        const availableExits = Object.keys(room.exits).join(", ");
        socket.emit("message", `Exits: ${availableExits}`);
        break;
      case "go":
      case "move":
      case "north":
      case "south":
      case "east":
      case "west":
        let direction = cmd.toLowerCase();
        if (direction === "go" || direction === "move") {
          direction = args[0]?.toLowerCase();
        }
        const currentRoom = world.rooms[player.currentRoom];
        if (currentRoom.exits[direction]) {
          // Notify other players in the current room that this player is leaving
          Object.values(players).forEach((p) => {
            if (p.id !== socket.id && p.currentRoom === player.currentRoom) {
              io.to(p.id).emit(
                "message",
                `${player.name} leaves to the ${direction}.`
              );
            }
          });
          const oldRoom = player.currentRoom;
          player.currentRoom = currentRoom.exits[direction];
          const newRoom = world.rooms[player.currentRoom];
          // Notify other players in the new room that this player is arriving
          Object.values(players).forEach((p) => {
            if (p.id !== socket.id && p.currentRoom === player.currentRoom) {
              io.to(p.id).emit(
                "message",
                `${player.name} arrives from the ${getOppositeDirection(
                  direction
                )}.`
              );
            }
          });
          socket.emit("message", `You move ${direction} to ${newRoom.name}.`);
          socket.emit("message", newRoom.description);
          const exits = Object.keys(newRoom.exits).join(", ");
          socket.emit("message", `Exits: ${exits}`);
        } else {
          socket.emit("message", `You cannot go ${direction} from here.`);
        }
        break;
      default:
        socket.emit(
          "message",
          "Unknown command. Try: say, look, go, north, south, east, west, who"
        );
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
