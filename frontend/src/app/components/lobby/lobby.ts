import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameStateService } from '../../services/game-state';

@Component({
  selector: 'app-lobby',
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.html',
  styleUrl: './lobby.less',
})
export class Lobby {
  playerName = signal('');
  roomId = signal('');

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

  constructor(public gameState: GameStateService) {}

  async connect(): Promise<void> {
    if (!this.playerName().trim()) return;

    const connected = await this.gameState.connectToServer();
    if (!connected) {
      console.error('Failed to connect to server');
    }
  }

  joinRoom(): void {
    const name = this.playerName().trim();
    const room = this.roomId().trim();

    if (!name) return;

    // If no room ID provided, server will create a new room
    this.gameState.joinRoom(room || 'new', name);
  }

  leaveRoom(): void {
    this.gameState.leaveRoom();
  }

  takeSeat(seatIndex: number): void {
    this.gameState.takeSeat(seatIndex);
  }

  startGame(): void {
    this.gameState.startGame();
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
}
