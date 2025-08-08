import { Injectable, signal, computed } from '@angular/core';
import { GameRoom, Player, SocketService } from './socket';
import { PlayerIdentityService } from './player-identity';
import { ToastService } from './toast';

@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  // Signals for reactive state management
  private currentRoom = signal<GameRoom | null>(null);
  private currentPlayer = signal<Player | null>(null);
  private isConnected = signal<boolean>(false);
  private errorMessage = signal<string | null>(null);

  // Add a persistent call history so players can see what was called
  private callHistory = signal<Array<{ 
    callerName: string; 
    calledName: string; 
    movedPlayerName?: string; 
    at: number;
  }>>([]);

  // Computed signals
  public readonly room = computed(() => this.currentRoom());
  public readonly player = computed(() => this.currentPlayer());
  public readonly connected = computed(() => this.isConnected());
  public readonly error = computed(() => this.errorMessage());

  // Expose recent calls and last call for the UI
  public readonly recentCalls = computed(() => this.callHistory());
  public readonly lastCall = computed(() => {
    const arr = this.callHistory();
    return arr.length ? arr[arr.length - 1] : null;
  });

  // Game state computed properties
  public readonly gamePhase = computed(
    () => this.currentRoom()?.gamePhase ?? 'waiting'
  );
  public readonly currentPlayerIndex = computed(
    () => this.currentRoom()?.currentPlayerIndex ?? -1
  );
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
    const totalPlayers = room.seats.filter((seat) => seat !== null).length;
    const hasEnoughPlayers = totalPlayers >= 6;

    // Check if teams are balanced (at least 3 per team for 6+ players)
    const teamASizeOk = room.teams.A.length >= 3;
    const teamBSizeOk = room.teams.B.length >= 3;

    return (
      hasEnoughPlayers &&
      teamASizeOk &&
      teamBSizeOk &&
      room.gamePhase === 'setup'
    );
  });

  constructor(
    private socketService: SocketService,
    private playerIdentityService: PlayerIdentityService,
    private toast: ToastService
  ) {
    this.initializeSubscriptions();
  }

  private initializeSubscriptions(): void {
    // Listen to connection status
    this.socketService.connectionStatus$.subscribe((status) => {
      this.isConnected.set(status);
      if (!status) {
        this.clearError();
      }
    });

    // Listen to game events
    this.socketService.gameEvents$.subscribe((event) => {
      this.handleGameEvent(event);
    });
  }

  private handleGameEvent(event: any): void {
    switch (event.type) {
      case 'playerJoined':
        this.updateRoom(event.data.room);
        // Update currentPlayer if this matches our persistent ID
        const localPlayer = this.currentPlayer();
        const persistentId = this.playerIdentityService.getOrCreatePlayerId();

        if (event.data.player && event.data.player.id === persistentId) {
          // This is our player data from the server, update our local state
          this.currentPlayer.set({
            ...event.data.player,
            id: persistentId, // Ensure we keep our persistent ID
          });
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
        // New game: clear any previous call history
        this.callHistory.set([]);
        break;

      case 'moveMade':
        this.updateRoom(event.data.room);
        break;

      case 'gameFinished':
        this.updateRoom(event.data.room);
        break;

      case 'nameCalled':
        // Record the call persistently for deduction
        this.callHistory.update((arr) => [
          ...arr,
          {
            callerName: event.data.callerName,
            calledName: event.data.calledName,
            movedPlayerName: event.data.movedPlayerName,
            at: Date.now(),
          },
        ]);
        // Pretty toast notification instead of error banner
        const moveResult = event.data.movedPlayerName ? ` - ${event.data.movedPlayerName} moved to the empty seat` : '';
        this.toast.show(`${event.data.callerName} called "${event.data.calledName}"${moveResult}`, 'info', 4000);
        break;

      case 'emojiChanged':
        this.updateRoom(event.data.room);
        break;

      case 'roomUpdate':
        this.updateRoom(event.data);
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
    // Get or create persistent player ID
    const persistentPlayerId = this.playerIdentityService.getOrCreatePlayerId();

    this.currentPlayer.set({
      id: persistentPlayerId, // Use persistent ID
      name: playerName,
      emoji: null,
      isReady: false,
    });
    this.socketService.joinRoom(roomId, playerName, persistentPlayerId);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.currentRoom.set(null);
    this.currentPlayer.set(null);
    // Clear history when leaving a room
    this.callHistory.set([]);
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
    const room = this.currentRoom();
    if (room) {
      this.socketService.startGame(room.id);
    }
  }

  makeMove(calledNameValue: string): void {
    if (!this.canCallName(calledNameValue)) {
      this.setError('Cannot call this name');
      return;
    }
    const room = this.currentRoom();
    if (!room) {
      this.setError('No room found');
      return;
    }
    this.socketService.makeMove(room.id, calledNameValue);
  }

  callPlayerName(name: string): void {
    const room = this.currentRoom();
    if (!room) {
      this.setError('No room found');
      return;
    }
    this.socketService.callPlayerName(name);
  }

  setPlayerEmoji(emoji: string): void {
    this.socketService.setEmoji(emoji);
  }

  // Player identity management
  clearPlayerIdentity(): void {
    this.playerIdentityService.clearPlayerId();
  }

  hasStoredIdentity(): boolean {
    return this.playerIdentityService.hasStoredPlayerId();
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

  private canCallName(name: string): boolean {
    const room = this.currentRoom();
    const player = this.currentPlayer();

    if (!room || !player) return false;
    if (room.gamePhase !== 'playing') return false;
    if (!this.isCurrentPlayer()) return false;

    // Check if the name is a valid secret name
    return room.secretNames?.some((sn) => sn.secretName === name) ?? false;
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
    // Clear history when disconnecting
    this.callHistory.set([]);
  }
}
