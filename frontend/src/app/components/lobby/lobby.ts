import { Component, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameStateService } from '../../services/game-state';
import { ToastService } from '../../services/toast';
import { PlayerIdentityService } from '../../services/player-identity';
import { RoomSelectionComponent, type GameSession } from '../room-selection/room-selection.component';
import { PlayerSetupComponent } from '../player-setup/player-setup.component';
import { GameBoardComponent } from '../game-board/game-board.component';
import { GameControlsComponent } from '../game-controls/game-controls.component';
import { CallHistoryComponent } from '../call-history/call-history.component';
import { TeamAssignmentComponent } from '../team-assignment/team-assignment.component';

@Component({
  selector: 'app-lobby',
  imports: [
    CommonModule, 
    FormsModule, 
    RoomSelectionComponent,
    PlayerSetupComponent,
    GameBoardComponent,
    GameControlsComponent,
    CallHistoryComponent,
    TeamAssignmentComponent
  ],
  templateUrl: './lobby.html',
  styleUrl: './lobby.less',
})
export class Lobby {
  activeSessions = signal<GameSession[]>([]);
  loadingSessions = signal(false);
  roomId = signal(''); // Still needed for rejoinSession

  // Expose toasts for template via a getter to avoid init order errors
  get toasts() {
    return this.toast.toasts;
  }

  // Cute emoji bank for player avatars
  readonly emojiBank = [
    '🐱',
    '🐶',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐸',
    '🐵',
    '🐥',
    '🦄',
    '🐢',
    '🐙',
    '🦀',
    '🐝',
    '🦋',
    '🐌',
    '🐛',
    '🌸',
    '🌺',
    '🌻',
    '🌼',
    '🌷',
    '🌹',
    '🌟',
    '⭐',
    '🍄',
    '🍓',
    '🍊',
    '🍋',
    '🍒',
    '🥝',
    '🍇',
    '🥥',
  ];

  constructor(
    public gameState: GameStateService,
    private toast: ToastService,
    private playerIdentityService: PlayerIdentityService
  ) {
    // Auto-connect on component init
    this.connect();

    // Focus the name input when setup phase appears
    effect(() => {
      if (this.gameState.gamePhase() === 'setup') {
        // Try multiple times with increasing delays
        setTimeout(() => this.focusNameInput(), 50);
        setTimeout(() => this.focusNameInput(), 200);
        setTimeout(() => this.focusNameInput(), 500);
      }
    });

    // Load active sessions when connected but not in a room
    effect(() => {
      if (this.gameState.connected() && !this.gameState.room()) {
        this.loadActiveSessions();
      }
    });
  }

  async connect(): Promise<void> {
    const connected = await this.gameState.connectToServer();
    if (!connected) {
      console.error('Failed to connect to server');
    }
  }

  joinRoom(roomId: string): void {
    const room = roomId.trim();
    // Join room without a name initially - name will be set during setup
    this.gameState.joinRoom(room || 'new');
  }

  updatePlayerName(name: string): void {
    if (!name.trim()) return;
    this.gameState.setPlayerName(name.trim());
  }

  leaveRoom(): void {
    this.gameState.leaveRoom();
  }

  takeSeat(seatIndex: number): void {
    this.gameState.takeSeat(seatIndex);
  }

  startGame(): void {
    if (this.canStartGame()) {
      this.gameState.startGame();
    }
  }

  // Helper methods for template
  isCurrentPlayerSeat(seatIndex: number): boolean {
    const room = this.gameState.room();
    return (
      room?.currentPlayerIndex === seatIndex &&
      this.gameState.gamePhase() === 'playing'
    );
  }

  getPlayerTeam(playerId: string | undefined): 'A' | 'B' | null {
    if (!playerId) return null;
    return this.gameState.getPlayerTeam(playerId);
  }

  getPlayerName(playerId: string): string {
    const room = this.gameState.room();
    if (!room) return '';

    const player = room.seats.find((seat) => seat?.id === playerId);
    return player?.name || 'Unknown';
  }

  getPlayerEmoji(playerId: string): string | null {
    const room = this.gameState.room();
    if (!room) return null;

    const player = room.seats.find((seat) => seat?.id === playerId);
    return player?.emoji || null;
  }

  getCurrentPlayerName(): string {
    const room = this.gameState.room();
    if (!room) return '';

    const currentPlayer = room.seats[room.currentPlayerIndex];
    return currentPlayer?.name || 'Unknown';
  }

  // New methods for improved UX
  isCouchSeat(seatIndex: number): boolean {
    const room = this.gameState.room();
    return room?.couchSeats?.includes(seatIndex) || false;
  }

  getMySecretName(): string {
    const room = this.gameState.room();
    const player = this.gameState.player();
    if (!room || !player || !room.secretNames) return '';

    const secretInfo = room.secretNames.find((s) => s.playerId === player.id);
    return secretInfo?.secretName || '';
  }

  getAllPlayerNames(): string[] {
    const room = this.gameState.room();
    if (!room || !room.secretNames) return [];

    return room.secretNames.map((s) => s.secretName).filter((name) => name);
  }

  callName(name: string): void {
    this.gameState.callPlayerName(name);
  }

  setEmoji(emoji: string): void {
    this.gameState.setPlayerEmoji(emoji);
  }

  getPlayerLookup() {
    return {
      getName: (playerId: string) => this.getPlayerName(playerId),
      getEmoji: (playerId: string) => this.getPlayerEmoji(playerId)
    };
  }

  getCurrentPlayerId(): string | null {
    const room = this.gameState.room();
    if (!room || room.currentPlayerIndex === undefined) return null;
    return room.seats[room.currentPlayerIndex]?.id || null;
  }



  focusNameInput(): void {
    // This is now handled by the PlayerSetup component
  }

  // Game start validation helpers
  canStartGame(): boolean {
    const room = this.gameState.room();
    if (!room) return false;

    // Check if we have enough players (minimum 6)
    const totalPlayers = room.seats.filter((seat) => seat !== null).length;
    const hasEnoughPlayers = totalPlayers >= 6;

    // Check if teams are balanced (at least 3 per team for 6+ players)
    const teamASizeOk = room.teams.A.length >= 3;
    const teamBSizeOk = room.teams.B.length >= 3;

    // Check if all players have names and avatars
    const allPlayersReady = room.seats.every(seat => 
      seat === null || (seat.name && seat.name.trim() && seat.emoji)
    );

    return (
      hasEnoughPlayers &&
      teamASizeOk &&
      teamBSizeOk &&
      allPlayersReady &&
      room.gamePhase === 'setup'
    );
  }

  getGameStartBlockerMessage(): string {
    const room = this.gameState.room();
    if (!room) return 'No room found';

    const totalPlayers = room.seats.filter((seat) => seat !== null).length;
    const teamASizeOk = room.teams.A.length >= 3;
    const teamBSizeOk = room.teams.B.length >= 3;

    // Check for missing names or avatars
    const playersWithoutNames = room.seats.filter(seat => 
      seat !== null && (!seat.name || !seat.name.trim())
    );
    const playersWithoutAvatars = room.seats.filter(seat => 
      seat !== null && !seat.emoji
    );

    if (playersWithoutNames.length > 0) {
      const playerNames = playersWithoutNames.map(p => p?.name || 'Player without name').join(', ');
      return `Waiting for players to set their names: ${playerNames}`;
    }

    if (playersWithoutAvatars.length > 0) {
      const playerNames = playersWithoutAvatars.map(p => p?.name || 'Player without avatar').join(', ');
      return `Waiting for players to choose avatars: ${playerNames}`;
    }

    if (totalPlayers < 6) {
      return `Need at least 6 players to start (currently ${totalPlayers})`;
    }

    if (!teamASizeOk || !teamBSizeOk) {
      return `Teams need to be balanced (at least 3 players each). Team A: ${room.teams.A.length}, Team B: ${room.teams.B.length}`;
    }

    return 'All requirements met!';
  }

  // Session management methods
  async loadActiveSessions(): Promise<void> {
    const playerId = this.playerIdentityService.getOrCreatePlayerId();
    this.loadingSessions.set(true);
    
    try {
      const sessions = await this.gameState.getActiveSessions(playerId);
      this.activeSessions.set(sessions);
      this.loadingSessions.set(false);
    } catch (error) {
      console.error('Failed to load active sessions:', error);
      this.activeSessions.set([]);
      this.loadingSessions.set(false);
    }
  }

  rejoinSession(session: GameSession): void {
    this.joinRoom(session.roomId);
  }
}
