import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Request, Response } from 'express';
import { Player } from './models/player';
import { GameRoom } from './models/gameRoom';
import { GameRoomSetup } from './models/gameRoomSetup';
import { PlayerId } from './models/playerId';
import { RoomId } from './models/roomId';
import { Name } from './models/name';
import { TeamId } from './models/teamId';
import { makeMove } from './models/gameLogic';

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
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // In-memory game room setups and active games
  const gameRoomSetups: { [roomId: string]: GameRoomSetup } = {};
  const gameRooms: { [roomId: string]: GameRoom } = {};

  app.get('/', (req: Request, res: Response) => {
    res.send('Couch Game backend is running.');
  });

  // Track player-socket mapping
  const playerSockets: { [playerId: string]: string } = {};
  const socketPlayers: { [socketId: string]: { roomId: string; playerId: string } } = {};

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinRoom', ({ roomId, playerName }) => {
      const actualRoomId = roomId === 'new' ? generateRoomId() : roomId;
      const roomIdObj = new RoomId(actualRoomId);
      
      // Initialize room setup if it doesn't exist
      if (!gameRoomSetups[roomIdObj.value]) {
        gameRoomSetups[roomIdObj.value] = new GameRoomSetup(roomIdObj);
      }

      // Create player (team will be assigned when game starts)
      const playerId = socket.id;
      const player = new Player(new PlayerId(playerId), new Name(playerName), new TeamId('unassigned'));
      gameRoomSetups[roomIdObj.value].addPlayer(player);
      
      // Track mappings
      playerSockets[playerId] = socket.id;
      socketPlayers[socket.id] = { roomId: actualRoomId, playerId };
      
      socket.join(actualRoomId);

      // Convert to frontend format
      const frontendRoom = convertSetupToFrontendFormat(gameRoomSetups[roomIdObj.value]);
      const frontendPlayer = { id: playerId, name: playerName, isReady: false };

      // Emit to the joining player
      socket.emit('playerJoined', { 
        room: frontendRoom, 
        player: frontendPlayer 
      });

      // Emit to other players in room
      socket.to(actualRoomId).emit('playerJoined', { 
        room: frontendRoom, 
        player: frontendPlayer 
      });

      console.log(`${playerName} joined room ${actualRoomId}`);
    });

    socket.on('takeSeat', ({ seatIndex }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const setup = gameRoomSetups[playerInfo.roomId];
      if (!setup) return;

      // During setup phase, allow seat swapping
      const currentPlayerIndex = setup.players.findIndex(p => p.id.value === playerInfo.playerId);
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
      io.to(playerInfo.roomId).emit('seatTaken', { room: frontendRoom });
    });

    socket.on('startGame', () => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const setup = gameRoomSetups[playerInfo.roomId];
      if (!setup || setup.players.length < 6) { // Minimum 6 players for a good game
        socket.emit('error', 'Need at least 6 players to start game');
        return;
      }

      // Create game room
      const gameRoom = GameRoom.fromSetup(setup);
      gameRooms[playerInfo.roomId] = gameRoom;
      
      // Delete setup as game has started
      delete gameRoomSetups[playerInfo.roomId];

      // Convert to frontend format
      const frontendRoom = convertGameRoomToFrontendFormat(gameRoom);
      
      io.to(playerInfo.roomId).emit('gameStarted', { room: frontendRoom });
      console.log(`Game started in room ${playerInfo.roomId}`);
    });

    socket.on('makeMove', ({ fromSeat, toSeat }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const room = gameRooms[playerInfo.roomId];
      if (!room || room.state !== 'started') return;

      // For now, this is a placeholder - actual move logic needs frontend calling names
      // Will be implemented when we add the name-calling interface
      const frontendRoom = convertGameRoomToFrontendFormat(room);
      io.to(playerInfo.roomId).emit('moveMade', { room: frontendRoom });
    });

    socket.on('callName', ({ name }) => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      const room = gameRooms[playerInfo.roomId];
      if (!room || room.state !== 'started') return;

      // Find the calling player's name
      const callingPlayer = room.players.find(p => p.id.value === playerInfo.playerId);
      if (!callingPlayer) return;

      // Perform the move
      const { winner } = makeMove(room, name);

      // Broadcast the name call to all players
      io.to(playerInfo.roomId).emit('nameCalled', { 
        callerName: callingPlayer.name.value, 
        calledName: name 
      });

      // Broadcast updated game state
      const frontendRoom = convertGameRoomToFrontendFormat(room);
      if (winner) {
        io.to(playerInfo.roomId).emit('gameFinished', { room: frontendRoom, winner });
      } else {
        io.to(playerInfo.roomId).emit('moveMade', { room: frontendRoom });
      }
    });

    socket.on('leaveRoom', () => {
      const playerInfo = socketPlayers[socket.id];
      if (!playerInfo) return;

      // Remove player from room setup or game
      if (gameRoomSetups[playerInfo.roomId]) {
        const setup = gameRoomSetups[playerInfo.roomId];
        setup.players = setup.players.filter(p => p.id.value !== playerInfo.playerId);
        
        if (setup.players.length === 0) {
          delete gameRoomSetups[playerInfo.roomId];
        } else {
          const frontendRoom = convertSetupToFrontendFormat(setup);
          socket.to(playerInfo.roomId).emit('playerLeft', { room: frontendRoom });
        }
      }

      socket.leave(playerInfo.roomId);
      delete playerSockets[playerInfo.playerId];
      delete socketPlayers[socket.id];
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      const playerInfo = socketPlayers[socket.id];
      if (playerInfo) {
        // Same logic as leaveRoom
        if (gameRoomSetups[playerInfo.roomId]) {
          const setup = gameRoomSetups[playerInfo.roomId];
          setup.players = setup.players.filter(p => p.id.value !== playerInfo.playerId);
          
          if (setup.players.length === 0) {
            delete gameRoomSetups[playerInfo.roomId];
          } else {
            const frontendRoom = convertSetupToFrontendFormat(setup);
            socket.to(playerInfo.roomId).emit('playerLeft', { room: frontendRoom });
          }
        }

        delete playerSockets[playerInfo.playerId];
        delete socketPlayers[socket.id];
      }
    });
  });

  // Helper functions
  function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function convertSetupToFrontendFormat(setup: GameRoomSetup) {
    const numPlayers = setup.players.length;
    // Create seats array based on actual number of players
    const seats: any[] = Array(numPlayers).fill(null);
    
    // Place players in seats (for now, sequentially)
    setup.players.forEach((player, index) => {
      seats[index] = {
        id: player.id.value,
        name: player.name.value
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
      gamePhase: 'setup' as const,
      couchSeats
    };
  }

  function convertGameRoomToFrontendFormat(gameRoom: GameRoom) {
    // Convert seats
    const seats: any[] = gameRoom.seats.map(seat => {
      if (seat === null) return null;
      
      const player = gameRoom.players.find(p => p.id.equals(seat));
      return player ? {
        id: player.id.value,
        name: player.name.value
      } : null;
    });

    // Convert teams
    const teams = {
      A: gameRoom.teams.teamA.map(p => p.id.value),
      B: gameRoom.teams.teamB.map(p => p.id.value)
    };

    return {
      id: gameRoom.roomId.value,
      seats,
      teams,
      currentPlayerIndex: gameRoom.currentTurn,
      gamePhase: gameRoom.state === 'started' ? 'playing' as const : 'finished' as const,
      couchSeats: gameRoom.couchSeats,
      secretNames: gameRoom.players.map(p => ({ 
        playerId: p.id.value, 
        secretName: p.secretName?.value 
      }))
    };
  }

  return {
    httpServer,
    io,
    app,
    gameRoomSetups,
    gameRooms
  };
}
