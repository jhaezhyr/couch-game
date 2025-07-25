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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', ({ roomId, name, team }) => {
    const roomIdObj = new RoomId(roomId);
    if (!gameRoomSetups[roomIdObj.value]) {
      gameRoomSetups[roomIdObj.value] = new GameRoomSetup(roomIdObj);
    }
    const player = new Player(new PlayerId(socket.id), new Name(name), new TeamId(team));
    gameRoomSetups[roomIdObj.value].addPlayer(player);
    socket.join(roomIdObj.value);
    io.to(roomIdObj.value).emit('room-update', gameRoomSetups[roomIdObj.value]);
    console.log(`${name} joined room ${roomId} as ${team}`);
  });

  socket.on('start-game', ({ roomId }) => {
    const roomIdObj = new RoomId(roomId);
    const setup = gameRoomSetups[roomIdObj.value];
    if (setup) {
      const gameRoom = GameRoom.fromSetup(setup);
      gameRooms[roomIdObj.value] = gameRoom;
      io.to(roomIdObj.value).emit('game-started', gameRoom);
      console.log(`Game started in room ${roomIdObj.value}`);
    }
  });

  socket.on('make-move', ({ roomId, calledNameValue }) => {
    const roomIdObj = new RoomId(roomId);
    const room = gameRooms[roomIdObj.value];
    if (!room || room.state !== 'started') return;

    // Find the player holding the called name
    const calledName = new Name(calledNameValue);
    const mover = room.players.find(p => p.secretName && p.secretName.equals(calledName));
    if (!mover) return;

    // Find the empty seat and the player to the right of it
    const emptySeatIdx = room.emptySeat;
    if (emptySeatIdx === null) return;
    const rightOfEmpty = (emptySeatIdx + 1) % room.seats.length;
    const caller = room.players.find(p => p.position === rightOfEmpty);
    if (!caller) return;

    // Move the player holding the called name to the empty seat
    if (mover.position === null) return;
    room.seats[emptySeatIdx] = mover.id;
    room.seats[mover.position] = null;
    mover.position = emptySeatIdx;

    // Switch secret names between caller and mover
    const tempSecret = caller.secretName;
    caller.secretName = mover.secretName;
    mover.secretName = tempSecret;

    // Update empty seat
    room.emptySeat = mover.position;

    // Update turn: next player to right of new empty seat
    room.currentTurn = (room.emptySeat! + 1) % room.seats.length;

    // Check win condition: all couch seats occupied by one team
    const couchTeamIds = room.couchSeats.map(idx => {
      const pid = room.seats[idx];
      const player = room.players.find(p => pid && p.id.equals(pid));
      return player?.team.value;
    });
    const allA = couchTeamIds.every(tid => tid === 'A');
    const allB = couchTeamIds.every(tid => tid === 'B');
    let winner: string | null = null;
    if (allA) winner = 'A';
    if (allB) winner = 'B';

    io.to(roomIdObj.value).emit('move-made', room);
    if (winner) {
      room.state = 'finished';
      io.to(roomIdObj.value).emit('game-finished', { winner });
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
