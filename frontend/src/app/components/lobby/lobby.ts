import { Component, signal, effect, ViewChild, ElementRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameStateService } from '../../services/game-state';
import { ToastService } from '../../services/toast';
import { PlayerIdentityService } from '../../services/player-identity';

export interface GameSession {
  roomId: string;
  roomName: string;
  playerName: string;
  emoji: string | null;
  gamePhase: 'setup' | 'playing' | 'finished';
  playerCount: number;
  lastActivity: string;
}

@Component({
  selector: 'app-lobby',
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.html',
  styleUrl: './lobby.less',
})
export class Lobby {
  playerName = signal('');
  roomId = signal('');
  activeSessions = signal<GameSession[]>([]);
  loadingSessions = signal(false);

  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

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
    // Auto-populate name field when player joins a room
    effect(() => {
      const player = this.gameState.player();
      if (player && player.name && !this.playerName()) {
        this.playerName.set(player.name);
      }
    });
    
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

  joinRoom(): void {
    const room = this.roomId().trim();
    // Join room without a name initially - name will be set during setup
    this.gameState.joinRoom(room || 'new');
  }

  updatePlayerName(): void {
    const name = this.playerName().trim();
    if (!name) return;
    this.gameState.setPlayerName(name);
    // Clear the input briefly to show it was updated
    this.playerName.set('');
    setTimeout(() => this.playerName.set(name), 100);
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

  setEmoji(emoji: string, event?: Event): void {
    // Add visual feedback - add active class to the clicked button briefly
    if (event && event.target) {
      const button = event.target as HTMLElement;
      button.classList.add('active');
      setTimeout(() => button.classList.remove('active'), 150);
    }
    
    this.gameState.setPlayerEmoji(emoji);
  }

  getCircularPosition(
    seatIndex: number,
    totalSeats: number
  ): { x: string; y: string } {
    if (totalSeats === 0) return { x: '50%', y: '50%' };

    // Calculate angle for this seat (starting from top, going clockwise)
    const angle = (2 * Math.PI * seatIndex) / totalSeats - Math.PI / 2;

    // Radius as percentage of container (adjust for responsive design)
    const radius = 40; // 40% of container

    // Calculate position
    const x = 50 + radius * Math.cos(angle); // Center (50%) + offset
    const y = 50 + radius * Math.sin(angle); // Center (50%) + offset

    return {
      x: `${x}%`,
      y: `${y}%`,
    };
  }

  // Helper methods for recent calls display
  getDisplayedRecentCalls() {
    const allCalls = this.gameState.recentCalls();
    return allCalls.slice(-3); // Show only last 3 calls
  }

  getHiddenCallsCount(): number {
    const allCalls = this.gameState.recentCalls();
    return Math.max(0, allCalls.length - 3);
  }

  focusNameInput(): void {
    const nameInput = document.querySelector('input[placeholder="Enter your name for this game"]') as HTMLInputElement;
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }
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
    this.roomId.set(session.roomId);
    this.joinRoom();
  }
}
