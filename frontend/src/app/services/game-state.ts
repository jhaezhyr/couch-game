import { Injectable, signal, computed } from '@angular/core';
import { GameRoom, Player, SocketService } from './socket';

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  // Signals for reactive state management
  private currentRoom = signal<GameRoom | null>(null);
  private currentPlayer = signal<Player | null>(null);
  private isConnected = signal<boolean>(false);
  private errorMessage = signal<string | null>(null);

  // Computed signals
  public readonly room = computed(() => this.currentRoom());
  public readonly player = computed(() => this.currentPlayer());
  public readonly connected = computed(() => this.isConnected());
  public readonly error = computed(() => this.errorMessage());

  // Game state computed properties
  public readonly gamePhase = computed(() => this.currentRoom()?.gamePhase ?? 'waiting');
  public readonly currentPlayerIndex = computed(() => this.currentRoom()?.currentPlayerIndex ?? -1);
  public readonly isCurrentPlayer = computed(() => {
    const room = this.currentRoom();
    const player = this.currentPlayer();
    if (!room || !player) return false;

    const currentSeat = room.seats[room.currentPlayerIndex];
    return currentSeat?.id === player.id;
  });

  public readonly myTeam = computed(() => {
    const room = this.currentRoom();
    const player = this.currentPlayer();
    if (!room || !player) return null;

    if (room.teams.A.includes(player.id)) return 'A';
    if (room.teams.B.includes(player.id)) return 'B';
    return null;
  });

  public readonly canStartGame = computed(() => {
    const room = this.currentRoom();
    if (!room) return false;

    // Check if we have enough players (minimum 6)
    const totalPlayers = room.seats.filter(seat => seat !== null).length;
    const hasEnoughPlayers = totalPlayers >= 6;

    // Check if teams are balanced (at least 3 per team for 6+ players)
    const teamASizeOk = room.teams.A.length >= 3;
    const teamBSizeOk = room.teams.B.length >= 3;

    return hasEnoughPlayers && teamASizeOk && teamBSizeOk && room.gamePhase === 'setup';
  });

  constructor(private socketService: SocketService) {
    this.initializeSubscriptions();
  }

  private initializeSubscriptions(): void {
    // Listen to connection status
    this.socketService.connectionStatus$.subscribe(status => {
      this.isConnected.set(status);
      if (!status) {
        this.clearError();
      }
    });

    // Listen to game events
    this.socketService.gameEvents$.subscribe(event => {
      this.handleGameEvent(event);
    });
  }

  private handleGameEvent(event: any): void {
    switch (event.type) {
      case 'playerJoined':
        this.updateRoom(event.data.room);
        // Only update currentPlayer if this is our join response (id is empty or matches)
        const localPlayer = this.currentPlayer();
        if (event.data.player && (localPlayer?.id === '' || event.data.player.id === localPlayer?.id)) {
          this.currentPlayer.set(event.data.player);
        }
        break;

      case 'playerLeft':
        this.updateRoom(event.data.room);
        break;

      case 'seatTaken':
        this.updateRoom(event.data.room);
        break;

      case 'teamAssigned':
        this.updateRoom(event.data.room);
        break;

      case 'gameStarted':
        this.updateRoom(event.data.room);
        break;

      case 'moveMade':
        this.updateRoom(event.data.room);
        break;

      case 'gameFinished':
        this.updateRoom(event.data.room);
        break;

      case 'nameCalled':
        // Show feedback when a name is called
        this.setError(`${event.data.callerName} called "${event.data.calledName}"`);
        break;

      case 'emojiChanged':
        this.updateRoom(event.data.room);
        break;

      default:
        console.warn('Unknown game event:', event);
    }
  }

  private updateRoom(room: GameRoom): void {
    this.currentRoom.set(room);
    this.clearError();
  }

  // Public actions
  async connectToServer(): Promise<boolean> {
    try {
      await this.socketService.connect().toPromise();
      return true;
    } catch (error) {
      this.setError('Failed to connect to server');
      return false;
    }
  }

  joinRoom(roomId: string, playerName: string): void {
    this.currentPlayer.set({
      id: '', // Will be set by server response
      name: playerName,
      emoji: null,
      isReady: false
    });
    this.socketService.joinRoom(roomId, playerName);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.currentRoom.set(null);
    this.currentPlayer.set(null);
  }

  takeSeat(seatIndex: number): void {
    if (!this.canTakeSeat(seatIndex)) {
      this.setError('Cannot take this seat');
      return;
    }
    this.socketService.takeSeat(seatIndex);
  }

  assignToTeam(playerId: string, team: 'A' | 'B'): void {
    this.socketService.assignToTeam(playerId, team);
  }

  startGame(): void {
    if (!this.canStartGame()) {
      this.setError('Cannot start game yet');
      return;
    }
    this.socketService.startGame();
  }

  makeMove(fromSeat: number, toSeat: number): void {
    if (!this.canMakeMove(fromSeat, toSeat)) {
      this.setError('Invalid move');
      return;
    }
    this.socketService.makeMove(fromSeat, toSeat);
  }

  callPlayerName(name: string): void {
    this.socketService.callPlayerName(name);
  }

  setPlayerEmoji(emoji: string): void {
    this.socketService.setEmoji(emoji);
  }

  // Validation helpers
  private canTakeSeat(seatIndex: number): boolean {
    const room = this.currentRoom();
    if (!room) return false;

    // Check if seat is empty
    if (room.seats[seatIndex] === null) return false;

    // Check if game phase allows joining
    return room.gamePhase === 'waiting' || room.gamePhase === 'setup';
  }

  private canMakeMove(fromSeat: number, toSeat: number): boolean {
    const room = this.currentRoom();
    const player = this.currentPlayer();

    if (!room || !player) return false;
    if (room.gamePhase !== 'playing') return false;
    if (!this.isCurrentPlayer()) return false;

    // Check if from seat contains current player
    const fromPlayer = room.seats[fromSeat];
    if (!fromPlayer || fromPlayer.id !== player.id) return false;

    // Check if to seat is empty
    return room.seats[toSeat] === null;
  }

  // Utility methods
  private setError(message: string): void {
    this.errorMessage.set(message);
    // Clear error after 5 seconds
    setTimeout(() => this.clearError(), 5000);
  }

  private clearError(): void {
    this.errorMessage.set(null);
  }

  getSeatPlayer(seatIndex: number): Player | null {
    const room = this.currentRoom();
    return room?.seats[seatIndex] ?? null;
  }

  getPlayerTeam(playerId: string): 'A' | 'B' | null {
    const room = this.currentRoom();
    if (!room) return null;

    if (room.teams.A.includes(playerId)) return 'A';
    if (room.teams.B.includes(playerId)) return 'B';
    return null;
  }

  disconnect(): void {
    this.socketService.disconnect();
    this.currentRoom.set(null);
    this.currentPlayer.set(null);
    this.isConnected.set(false);
  }
}
