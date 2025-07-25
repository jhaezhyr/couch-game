import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { Request, Response } from 'express';
import { Player } from './models/player';
import { GameRoom } from './models/gameRoom';
import { PlayerId } from './models/playerId';
import { RoomId } from './models/roomId';
import { Name } from './models/name';
import { TeamId } from './models/teamId';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory game rooms
const gameRooms: { [roomId: string]: GameRoom } = {};

app.get('/', (req: Request, res: Response) => {
  res.send('Couch Game backend is running.');
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', ({ roomId, name, team }) => {
    const roomIdObj = new RoomId(roomId);
    if (!gameRooms[roomIdObj.value]) {
      gameRooms[roomIdObj.value] = new GameRoom(roomIdObj);
    }
    const player = new Player(new PlayerId(socket.id), new Name(name), team);
    gameRooms[roomIdObj.value].addPlayer(player);
    socket.join(roomIdObj.value);
    io.to(roomIdObj.value).emit('room-update', gameRooms[roomIdObj.value]);
    console.log(`${name} joined room ${roomId} as ${team}`);
  });

  socket.on('start-game', ({ roomId }) => {
    const roomIdObj = new RoomId(roomId);
    const room = gameRooms[roomIdObj.value];
    if (room) {
      // Assign teams (alternating order)
      const shuffledPlayers = [...room.players].sort(() => Math.random() - 0.5);
      room.teams.teamA = [];
      room.teams.teamB = [];
      shuffledPlayers.forEach((player, idx) => {
        if (idx % 2 === 0) {
          room.teams.teamA.push(player);
          player.team = new TeamId('A');
        } else {
          room.teams.teamB.push(player);
          player.team = new TeamId('B');
        }
      });

      // Arrange seats: alternating team pattern, one empty seat
      const totalSeats = room.players.length + 1;
      room.seats = Array(totalSeats).fill(null);
      let seatIdx = 0;
      for (let i = 0; i < room.players.length; i++) {
        room.seats[seatIdx] = shuffledPlayers[i].id;
        shuffledPlayers[i].position = seatIdx;
        seatIdx++;
      }
      room.emptySeat = seatIdx; // Last seat is empty

      // Couch seats: first 4 seats
      room.couchSeats = [0, 1, 2, 3];

      // Secret name assignment
      const names = shuffledPlayers.map(p => p.name);
      const secretNames = [...names].sort(() => Math.random() - 0.5);
      shuffledPlayers.forEach((player, idx) => {
        player.secretName = secretNames[idx];
      });

      room.state = 'started';
      io.to(roomIdObj.value).emit('game-started', room);
      console.log(`Game started in room ${roomIdObj.value}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Optionally: remove player from gameRooms
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
