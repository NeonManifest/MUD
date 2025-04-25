const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { db, auth } = require("./firebase");
const { Player } = require("./entities/entity").default;
const {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} = require("obscenity");

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

//Helper function to escape HTML characters to prevent XSS attacks
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

  let tempUserData = {};

  // Initialize player in limbo
  players[socket.id] = {
    id: socket.id,
    name: null,
    currentRoom: "limbo",
  };

  // Send welcome message
  socket.emit("message", "Welcome to the MUD! Please register or log in.");

  socket.on("initiate_registration", async (userData) => {
    try {
      // Validate username and clan
      if (matcher.getAllMatches(userData.characterName).length > 0) {
        throw new Error("Character name contains inappropriate language");
      }
      const validClans = [
        "Yellow Dog",
        "Red Bird",
        "Green Frog",
        "Blue Flower",
      ];
      if (!validClans.includes(userData.clan)) {
        throw new Error("Invalid clan");
      }
      // Store the validated data temporarily
      tempUserData[socket.id] = {
        characterName: userData.characterName,
        clan: userData.clan,
      };
      // If validation passes, tell client to create user
      socket.emit("create_user", { message: "Proceed with user creation" });
    } catch (error) {
      socket.emit("registration_error", { message: error.message });
    }
  });

  socket.on("complete_registration", async ({ idToken }) => {
    try {
      // Verify the ID token
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Retrieve the temporary user data
      const userData = tempUserData[socket.id];
      if (!userData) {
        throw new Error("Registration data not found");
      }

      // Sanitize the user input
      const sanitizedCharacterName = escapeHtml(userData.characterName);
      const sanitizedClan = escapeHtml(userData.clan);

      // Create the character document in Firestore with sanitized data
      await db.collection("characters").doc(uid).set({
        name: sanitizedCharacterName,
        clan: sanitizedClan,
      });

      // Clear the temporary data
      delete tempUserData[socket.id];

      socket.emit("registration_complete", {
        message: "Registration successful",
      });
    } catch (error) {
      console.error("Error completing registration:", error);
      socket.emit("registration_error", {
        message: "Failed to complete registration: " + error.message,
      });
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
        socket.emit("message", `Login successful.`);
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
          // Check for obscenity and profanity
          if (matcher.getAllMatches(message).length > 0) {
            socket.emit(
              "message",
              "You consider washing your mouth with soap."
            );
            return;
          }
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
