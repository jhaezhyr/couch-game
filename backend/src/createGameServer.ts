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

      const { winner } = makeMove(room, calledNameValue);

      io.to(roomIdObj.value).emit('move-made', room);
      if (winner) {
        io.to(roomIdObj.value).emit('game-finished', { winner });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Optionally: remove player from gameRooms
    });
  });

  return {
    httpServer,
    io,
    app,
    gameRoomSetups,
    gameRooms
  };
}
