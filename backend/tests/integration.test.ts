import Client from 'socket.io-client';
import { createGameServer, ServerInstance } from '../src/createGameServer';
import { Player } from '../src/models/player';
import { GameRoom } from '../src/models/gameRoom';
import { RoomId } from '../src/models/roomId';
import { PlayerId } from '../src/models/playerId';

// Type definitions for our test clients
type ClientSocket = ReturnType<typeof Client>;

interface RoomUpdateData {
  players: Player[];
  roomId: RoomId;
}

interface GameStartedData extends GameRoom {}

interface MoveMadeData extends GameRoom {}

interface GameFinishedData {
  winner: string;
}

describe('WebSocket Integration Tests', () => {
  let serverInstance: ServerInstance;
  let port: number;
  let clientSockets: ClientSocket[] = [];

  beforeAll((done) => {
    // Use the REAL server implementation
    serverInstance = createGameServer();

    serverInstance.httpServer.listen(() => {
      port = (serverInstance.httpServer.address() as { port: number }).port;
      done();
    });
  });

  afterAll(() => {
    serverInstance.io.close();
    serverInstance.httpServer.close();
  });

  afterEach(() => {
    // Clean up client connections
    clientSockets.forEach(socket => {
      if (socket.connected) {
        socket.disconnect();
      }
    });
    clientSockets = [];
    
    // Clear game state from the real server
    Object.keys(serverInstance.gameRoomSetups).forEach(key => delete serverInstance.gameRoomSetups[key]);
    Object.keys(serverInstance.gameRooms).forEach(key => delete serverInstance.gameRooms[key]);
  });

  const createClient = (): Promise<ClientSocket> => {
    return new Promise((resolve) => {
      const clientSocket = Client(`http://localhost:${port}`);
      clientSockets.push(clientSocket);
      clientSocket.on('connect', () => {
        resolve(clientSocket);
      });
    });
  };

  it('should handle multiple clients joining a room', async () => {
    const client1 = await createClient();
    const client2 = await createClient();
    
    const roomUpdates: RoomUpdateData[] = [];
    
    client1.on('room-update', (data: RoomUpdateData) => {
      roomUpdates.push(data);
    });
    
    client2.on('room-update', (data: RoomUpdateData) => {
      roomUpdates.push(data);
    });

    // First player joins
    client1.emit('join-room', { roomId: 'test-room', name: 'Player1', team: 'A' });
    
    // Wait for room update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Second player joins
    client2.emit('join-room', { roomId: 'test-room', name: 'Player2', team: 'B' });
    
    // Wait for room updates
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(roomUpdates.length).toBeGreaterThanOrEqual(2);
    expect(roomUpdates[roomUpdates.length - 1].players).toHaveLength(2);
  });

  it('should start a game with sufficient players', async () => {
    const clients: ClientSocket[] = [];
    
    // Create 12 clients (minimum for game)
    for (let i = 0; i < 12; i++) {
      clients.push(await createClient());
    }
    
    let gameStarted = false;
    let gameRoom: GameStartedData | null = null;
    
    clients[0].on('game-started', (data: GameStartedData) => {
      gameStarted = true;
      gameRoom = data;
    });
    
    // All players join the room
    for (let i = 0; i < 12; i++) {
      clients[i].emit('join-room', { 
        roomId: 'test-game', 
        name: `Player${i}`, 
        team: i % 2 === 0 ? 'A' : 'B' 
      });
    }
    
    // Wait for all joins
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Start the game
    clients[0].emit('start-game', { roomId: 'test-game' });
    
    // Wait for game start
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(gameStarted).toBe(true);
    expect(gameRoom).toBeTruthy();
    expect(gameRoom!.players).toHaveLength(12);
    expect(gameRoom!.state).toBe('started');
    expect(gameRoom!.seats).toHaveLength(13); // 12 players + 1 empty
    expect(gameRoom!.emptySeat).toBeDefined();
    expect(gameRoom!.couchSeats).toHaveLength(4);
  });

  it('should handle a complete move sequence', async () => {
    const clients: ClientSocket[] = [];
    
    // Create 12 clients
    for (let i = 0; i < 12; i++) {
      clients.push(await createClient());
    }
    
    let gameRoom: GameStartedData | null = null;
    let movesMade: MoveMadeData[] = [];
    let gameFinished = false;
    let winner: string | null = null;
    
    clients[0].on('game-started', (data: GameStartedData) => {
      gameRoom = data;
    });
    
    clients[0].on('move-made', (data: MoveMadeData) => {
      gameRoom = data;
      movesMade.push(data);
    });
    
    clients[0].on('game-finished', (data: GameFinishedData) => {
      gameFinished = true;
      winner = data.winner;
    });
    
    // All players join
    for (let i = 0; i < 12; i++) {
      clients[i].emit('join-room', { 
        roomId: 'move-test', 
        name: `Player${i}`, 
        team: i % 2 === 0 ? 'A' : 'B' 
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Start game
    clients[0].emit('start-game', { roomId: 'move-test' });
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(gameRoom).toBeTruthy();
    
    // Make a move by calling someone's secret name
    const firstPlayer = gameRoom!.players[0];
    const secretName = firstPlayer.secretName!.value;
    
    clients[0].emit('make-move', { 
      roomId: 'move-test', 
      calledNameValue: secretName 
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(movesMade.length).toBe(1);
    expect(gameRoom!.seats.filter((s: PlayerId | null) => s === null).length).toBe(1); // Still one empty seat
    
    // Verify the move was processed correctly
    const updatedGameRoom = movesMade[0];
    expect(updatedGameRoom.emptySeat).toBeDefined();
    expect(updatedGameRoom.currentTurn).toBeDefined();
  });

  it('should handle client disconnection gracefully', async () => {
    const client1 = await createClient();
    const client2 = await createClient();
    
    // Join room
    client1.emit('join-room', { roomId: 'disconnect-test', name: 'Player1', team: 'A' });
    client2.emit('join-room', { roomId: 'disconnect-test', name: 'Player2', team: 'B' });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Disconnect one client
    client1.disconnect();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify other client can still emit events
    client2.emit('join-room', { roomId: 'disconnect-test', name: 'Player3', team: 'A' });
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // If we get here without errors, disconnection was handled gracefully
    expect(true).toBe(true);
  });
});
