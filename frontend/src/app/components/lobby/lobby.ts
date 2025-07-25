import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameStateService } from '../../services/game-state';

@Component({
  selector: 'app-lobby',
  imports: [CommonModule, FormsModule],
  templateUrl: './lobby.html',
  styleUrl: './lobby.less'
})
export class Lobby {
  playerName = signal('');
  roomId = signal('');

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
    return room?.currentPlayerIndex === seatIndex && this.gameState.gamePhase() === 'playing';
  }

  getPlayerTeam(playerId: string | undefined): 'A' | 'B' | null {
    if (!playerId) return null;
    return this.gameState.getPlayerTeam(playerId);
  }

  getPlayerName(playerId: string): string {
    const room = this.gameState.room();
    if (!room) return '';

    const player = room.seats.find(seat => seat?.id === playerId);
    return player?.name || 'Unknown';
  }

  getCurrentPlayerName(): string {
    const room = this.gameState.room();
    if (!room) return '';

    const currentPlayer = room.seats[room.currentPlayerIndex];
    return currentPlayer?.name || 'Unknown';
  }
}
