import express from "express";
import http from "http";
import { Server } from "socket.io";
import { Request, Response } from "express";
import { Player } from "./models/player";
import { GameRoom } from "./models/gameRoom";
import { GameRoomSetup } from "./models/gameRoomSetup";
import { PlayerId } from "./models/playerId";
import { RoomId } from "./models/roomId";
import { Name } from "./models/name";
import { TeamId } from "./models/teamId";
import { makeMove } from "./models/gameLogic";

export interface ServerInstance {
  httpServer: http.Server;
  io: Server;
  app: express.Application;
  gameRoomSetups: { [roomId: string]: GameRoomSetup };
  gameRooms: { [roomId: string]: GameRoom };
}

export function createGameServer(): ServerInstance {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // In-memory game room setups and active games
  const gameRoomSetups: { [roomId: string]: GameRoomSetup } = {};
  const gameRooms: { [roomId: string]: GameRoom } = {};

  app.get("/", (req: Request, res: Response) => {
    res.send("Couch Game backend is running.");
  });

  // Track player-socket mapping
  const playerSockets: { [playerId: string]: string } = {};
  const socketPlayers: {
    [socketId: string]: { roomId: string; playerId: string };
  } = {};

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on(
      "joinRoom",
      ({ roomId, name: playerName, team, persistentPlayerId }) => {
        // Generate a random room ID if 'new' is passed
        let actualRoomId: string;
        if (roomId === "new") {
          actualRoomId = generateRandomId();
        } else {
          actualRoomId = roomId.toLowerCase().replace(/\s+/g, "-");
        }

        const roomIdObj = new RoomId(actualRoomId);

        // Generate or use provided player ID
        let playerId: string;
        if (persistentPlayerId && persistentPlayerId.trim() !== "") {
          playerId = persistentPlayerId;
        } else {
          playerId = generateRandomId();
        }

        // Check for reconnection only if we have a persistent ID
        if (persistentPlayerId && persistentPlayerId.trim() !== "") {
          const existingGameRoom = gameRooms[roomIdObj.value];
          const existingSetup = gameRoomSetups[roomIdObj.value];

          if (existingGameRoom) {
            // Player reconnecting to active game
            const existingPlayer = existingGameRoom.players.find(
              (p) => p.id.value === playerId
            );

            if (existingPlayer) {
              // This is a reconnection - update socket mapping
              const oldSocketId = playerSockets[playerId];
              if (oldSocketId && oldSocketId !== socket.id) {
                // Clean up old socket if it exists
                delete socketPlayers[oldSocketId];
              }

              playerSockets[playerId] = socket.id;
              socketPlayers[socket.id] = { roomId: actualRoomId, playerId };
              socket.join(actualRoomId);

              // Send current game state to reconnecting player
              const frontendRoom =
                convertGameRoomToFrontendFormat(existingGameRoom);
              const frontendPlayer = {
                id: playerId,
                name: existingPlayer.name.value,
                emoji: existingPlayer.emoji,
                isReady: true,
              };

              socket.emit("playerJoined", {
                room: frontendRoom,
                player: frontendPlayer,
              });

              console.log(
                `${existingPlayer.name.value} reconnected to game ${actualRoomId}`
              );
              return;
            }
          }

          if (existingSetup) {
            // Player reconnecting to setup phase
            const existingPlayer = existingSetup.players.find(
              (p) => p.id.value === playerId
            );

            if (existingPlayer) {
              // This is a reconnection - update socket mapping
              const oldSocketId = playerSockets[playerId];
              if (oldSocketId && oldSocketId !== socket.id) {
                delete socketPlayers[oldSocketId];
              }

              playerSockets[playerId] = socket.id;
              socketPlayers[socket.id] = { roomId: actualRoomId, playerId };
              socket.join(actualRoomId);

              // Send current setup state to reconnecting player
              const frontendRoom = convertSetupToFrontendFormat(existingSetup);
              const frontendPlayer = {
                id: playerId,
                name: existingPlayer.name.value,
                emoji: existingPlayer.emoji,
                isReady: false,
              };

              socket.emit("playerJoined", {
                room: frontendRoom,
                player: frontendPlayer,
              });

              console.log(
                `${existingPlayer.name.value} reconnected to setup ${actualRoomId}`
              );
              return;
            }
          }
        }

        // This is a new player joining
        // Initialize room setup if it doesn't exist
        if (!gameRoomSetups[roomIdObj.value]) {
          gameRoomSetups[roomIdObj.value] = new GameRoomSetup(roomIdObj);
        }

        // Create new player
        const player = new Player(
          new PlayerId(playerId),
          new Name(playerName),
          new TeamId("unassigned")
        );
        gameRoomSetups[roomIdObj.value].addPlayer(player);

        // Track mappings
        playerSockets[playerId] = socket.id;
        socketPlayers[socket.id] = { roomId: actualRoomId, playerId };

        socket.join(actualRoomId);

        // Convert to frontend format
        const frontendRoom = convertSetupToFrontendFormat(
          gameRoomSetups[roomIdObj.value]
        );
        const frontendPlayer = {
          id: playerId,
          name: playerName,
          emoji: null,
          isReady: false,
        };

        // Emit to the joining player
        socket.emit("playerJoined", {
          room: frontendRoom,
          player: frontendPlayer,
        });

        // Emit to other players in room
        socket.to(actualRoomId).emit("playerJoined", {
          room: frontendRoom,
          player: frontendPlayer,
        });

        // Emit room update to all players in room (including self)
        io.to(actualRoomId).emit("roomUpdate", frontendRoom);

        console.log(`${playerName} joined room ${actualRoomId}`);
      }
    );

    socket.on("startGame", ({ roomId }) => {
      const actualRoomId = roomId.toLowerCase().replace(/\s+/g, "-");
      const roomIdObj = new RoomId(actualRoomId);

      const setup = gameRoomSetups[roomIdObj.value];
      if (!setup) {
        console.log(
          `Cannot start game: Setup not found for room ${actualRoomId}`
        );
        return;
      }

      if (setup.players.length < 6) {
        console.log(
          `Cannot start game: Not enough players (${setup.players.length}/6) in room ${actualRoomId}`
        );
        return;
      }

      try {
        // Start the game
        const gameRoom = GameRoom.fromSetup(setup);

        // Move from setup to active games
        gameRooms[roomIdObj.value] = gameRoom;
        delete gameRoomSetups[roomIdObj.value];

        // Convert to frontend format and notify all players
        const frontendRoom = convertGameRoomToFrontendFormat(gameRoom);

        io.to(actualRoomId).emit("gameStarted", { room: frontendRoom });
        io.to(actualRoomId).emit("roomUpdate", frontendRoom);

        console.log(
          `Game started in room ${actualRoomId} with ${gameRoom.players.length} players`
        );
      } catch (error) {
        console.error(`Error starting game in room ${actualRoomId}:`, error);
        socket.emit("error", { message: "Failed to start game" });
      }
    });

    socket.on("makeMove", ({ roomId, calledNameValue }) => {
      const actualRoomId = roomId.toLowerCase().replace(/\s+/g, "-");
      const roomIdObj = new RoomId(actualRoomId);

      const gameRoom = gameRooms[roomIdObj.value];
      if (!gameRoom) {
        console.log(
          `Cannot make move: Game not found for room ${actualRoomId}`
        );
        return;
      }

      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) {
        console.log(
          `Cannot make move: Player not found for socket ${socket.id}`
        );
        return;
      }

      try {
        // Make the move
        const result = makeMove(gameRoom, calledNameValue);

        // Convert to frontend format and notify all players
        const frontendRoom = convertGameRoomToFrontendFormat(gameRoom);

        io.to(actualRoomId).emit("moveMade", { room: frontendRoom });
        io.to(actualRoomId).emit("roomUpdate", frontendRoom);

        // Check if game is finished
        if (result.winner) {
          io.to(actualRoomId).emit("gameFinished", { winner: result.winner });
          gameRoom.state = "finished";
        }

        console.log(
          `Move made in room ${actualRoomId}: called ${calledNameValue}`
        );
      } catch (error) {
        console.error(`Error making move in room ${actualRoomId}:`, error);
        socket.emit("error", { message: "Failed to make move" });
      }
    });

    socket.on("takeSeat", ({ seatIndex }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const setup = gameRoomSetups[playerInfo.roomId];
      if (!setup) return;

      // During setup phase, allow seat swapping
      const currentPlayerIndex = setup.players.findIndex(
        (p) => p.id.value === playerInfo.playerId
      );
      if (currentPlayerIndex === -1) return;

      // Check if target seat is available or different from current
      if (seatIndex < 0 || seatIndex > setup.players.length) return;
      if (seatIndex === currentPlayerIndex) return; // Same seat

      // Swap players at positions
      const targetPlayerIndex = seatIndex;
      if (targetPlayerIndex < setup.players.length) {
        // Swap the players in the array
        [setup.players[currentPlayerIndex], setup.players[targetPlayerIndex]] =
          [setup.players[targetPlayerIndex], setup.players[currentPlayerIndex]];
      }

      const frontendRoom = convertSetupToFrontendFormat(setup);
      io.to(playerInfo.roomId).emit("seatTaken", { room: frontendRoom });
    });

    socket.on("setEmoji", ({ emoji }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const setup = gameRoomSetups[playerInfo.roomId];
      if (!setup) return;

      // Find player and set emoji
      const player = setup.players.find(
        (p) => p.id.value === playerInfo.playerId
      );
      if (!player) return;

      player.emoji = emoji;

      const frontendRoom = convertSetupToFrontendFormat(setup);
      io.to(playerInfo.roomId).emit("emojiChanged", { room: frontendRoom });
    });

    socket.on("setPlayerName", ({ name }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const setup = gameRoomSetups[playerInfo.roomId];
      if (!setup) return;

      // Find player and set name
      const player = setup.players.find(
        (p) => p.id.value === playerInfo.playerId
      );
      if (!player) return;

      player.name = new Name(name);

      const frontendRoom = convertSetupToFrontendFormat(setup);
      io.to(playerInfo.roomId).emit("playerNameChanged", { 
        room: frontendRoom,
        playerId: playerInfo.playerId,
        name: name 
      });
    });

    socket.on("callName", ({ name }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const room = gameRooms[playerInfo.roomId];
      if (!room || room.state !== "started") return;

      // Find the calling player's name
      const callingPlayer = room.players.find(
        (p) => p.id.value === playerInfo.playerId
      );
      if (!callingPlayer) return;

      // Perform the move
      const { winner } = makeMove(room, name);

      // Broadcast the name call to all players
      io.to(playerInfo.roomId).emit("nameCalled", {
        callerName: callingPlayer.name.value,
        calledName: name,
      });

      // Broadcast updated game state
      const frontendRoom = convertGameRoomToFrontendFormat(room);
      if (winner) {
        io.to(playerInfo.roomId).emit("gameFinished", {
          room: frontendRoom,
          winner,
        });
      } else {
        io.to(playerInfo.roomId).emit("moveMade", { room: frontendRoom });
      }
    });

    socket.on("leaveRoom", () => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      // Remove player from room setup or game
      if (gameRoomSetups[playerInfo.roomId]) {
        const setup = gameRoomSetups[playerInfo.roomId];
        setup.players = setup.players.filter(
          (p) => p.id.value !== playerInfo.playerId
        );

        if (setup.players.length === 0) {
          delete gameRoomSetups[playerInfo.roomId];
        } else {
          const frontendRoom = convertSetupToFrontendFormat(setup);
          socket
            .to(playerInfo.roomId)
            .emit("playerLeft", { room: frontendRoom });
        }
      }

      socket.leave(playerInfo.roomId);
      delete playerSockets[playerInfo.playerId];
      delete socketPlayers[socket.id];
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);

      const playerInfo = socketPlayers[socket.id];
      if (playerInfo) {
        // Check if player is in an active game
        const activeGame = gameRooms[playerInfo.roomId];

        if (activeGame) {
          // Player is in active game - don't remove them, just clear socket mapping
          // They can reconnect later
          delete socketPlayers[socket.id];
          // Keep playerSockets[playerInfo.playerId] for potential reconnection
          console.log(
            `Player ${playerInfo.playerId} disconnected from active game ${playerInfo.roomId} but can reconnect`
          );
        } else if (gameRoomSetups[playerInfo.roomId]) {
          // Player is in setup phase - remove them after a delay to allow quick reconnection
          setTimeout(() => {
            // Check if they haven't reconnected
            if (
              !playerSockets[playerInfo.playerId] ||
              playerSockets[playerInfo.playerId] === socket.id
            ) {
              const setup = gameRoomSetups[playerInfo.roomId];
              if (setup) {
                setup.players = setup.players.filter(
                  (p) => p.id.value !== playerInfo.playerId
                );

                if (setup.players.length === 0) {
                  delete gameRoomSetups[playerInfo.roomId];
                } else {
                  const frontendRoom = convertSetupToFrontendFormat(setup);
                  io.to(playerInfo.roomId).emit("playerLeft", {
                    room: frontendRoom,
                  });
                }
              }
              delete playerSockets[playerInfo.playerId];
            }
          }, 10000); // 10 second grace period for reconnection

          delete socketPlayers[socket.id];
        }
      }
    });
  });

  // Helper functions
  function generateRoomId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  function generateRandomId(): string {
    return (
      Math.random().toString(36).substr(2, 9) +
      Math.random().toString(36).substr(2, 9)
    );
  }
  function convertSetupToFrontendFormat(setup: GameRoomSetup) {
    const numPlayers = setup.players.length;
    // Create seats array based on actual number of players
    const seats: any[] = Array(numPlayers).fill(null);

    // Place players in seats (for now, sequentially)
    setup.players.forEach((player, index) => {
      seats[index] = {
        id: player.id.value,
        name: player.name.value,
        emoji: player.emoji,
      };
    });

    // Auto-assign teams in alternating pattern for setup
    const teamA: string[] = [];
    const teamB: string[] = [];

    setup.players.forEach((player, index) => {
      if (index % 2 === 0) {
        teamA.push(player.id.value);
      } else {
        teamB.push(player.id.value);
      }
    });

    // Calculate couch seats for display
    const couchSize = Math.max(2, Math.floor(numPlayers / 3));
    const couchSeats = Array.from({ length: couchSize }, (_, i) => i);

    return {
      id: setup.roomId.value,
      seats,
      teams: { A: teamA, B: teamB },
      currentPlayerIndex: -1,
      gamePhase: "setup" as const,
      couchSeats,
      players: setup.players, // Add players for test compatibility
    };
  }

  function convertGameRoomToFrontendFormat(gameRoom: GameRoom) {
    // Convert seats
    const seats: any[] = gameRoom.seats.map((seat) => {
      if (seat === null) return null;

      const player = gameRoom.players.find((p) => p.id.equals(seat));
      return player
        ? {
            id: player.id.value,
            name: player.name.value,
            emoji: player.emoji,
          }
        : null;
    });

    // Convert teams
    const teams = {
      A: gameRoom.teams.teamA.map((p) => p.id.value),
      B: gameRoom.teams.teamB.map((p) => p.id.value),
    };

    return {
      id: gameRoom.roomId.value,
      seats,
      teams,
      currentPlayerIndex: gameRoom.currentTurn,
      currentTurn: gameRoom.currentTurn, // Add currentTurn for test compatibility
      gamePhase:
        gameRoom.state === "started"
          ? ("playing" as const)
          : ("finished" as const),
      state: gameRoom.state, // Add state for test compatibility
      emptySeat: gameRoom.emptySeat, // Add emptySeat for test compatibility
      couchSeats: gameRoom.couchSeats,
      secretNames: gameRoom.players.map((p) => ({
        playerId: p.id.value,
        secretName: p.secretName?.value,
      })),
      players: gameRoom.players, // Add players for test compatibility
    };
  }

  return {
    httpServer,
    io,
    app,
    gameRoomSetups,
    gameRooms,
  };
}
