import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-board.component.html',
  styleUrls: ['./game-board.component.less']
})
export class GameBoardComponent {
  @Input() seats: any[] = [];
  @Input() gamePhase: string = '';
  @Input() currentPlayerId: string | null = null;
  @Input() myPlayerId: string | null = null;
  @Input() teams: { A: string[], B: string[] } = { A: [], B: [] };

  @Output() seatClicked = new EventEmitter<number>();

  getSeatTrackingId(seat: any, index: number): string {
    return seat?.id || `seat-${index}`;
  }

  getCircularPosition(seatIndex: number, totalSeats: number): { x: string; y: string } {
    if (totalSeats === 0) return { x: '50%', y: '50%' };

    const angle = (2 * Math.PI * seatIndex) / totalSeats - Math.PI / 2;
    const radius = 40;
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    return {
      x: `${x}%`,
      y: `${y}%`,
    };
  }

  isCurrentPlayerSeat(seatIndex: number): boolean {
    return this.seats[seatIndex]?.id === this.currentPlayerId;
  }

  getPlayerTeam(playerId: string | undefined): string | null {
    if (!playerId) return null;
    if (this.teams.A.includes(playerId)) return 'A';
    if (this.teams.B.includes(playerId)) return 'B';
    return null;
  }

  isMySeat(seatIndex: number): boolean {
    return this.seats[seatIndex]?.id === this.myPlayerId;
  }

  isCouchSeat(seatIndex: number): boolean {
    // Logic to determine if this is the couch seat
    // You may need to adjust this based on your game rules
    return seatIndex === 0;
  }

  onSeatClick(seatIndex: number): void {
    this.seatClicked.emit(seatIndex);
  }
}