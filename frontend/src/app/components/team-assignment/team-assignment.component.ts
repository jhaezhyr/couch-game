import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-team-assignment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team-assignment.component.html',
  styleUrls: ['./team-assignment.component.less']
})
export class TeamAssignmentComponent {
  @Input() teams: { A: string[], B: string[] } = { A: [], B: [] };
  @Input() canStartGame: boolean = false;
  @Input() gameStartBlockerMessage: string = '';
  @Input() playerLookupFn: { getName: (id: string) => string, getEmoji: (id: string) => string | null } = {
    getName: (id) => id,
    getEmoji: () => ''
  };

  @Output() startGame = new EventEmitter<void>();

  getPlayerName(playerId: string): string {
    return this.playerLookupFn.getName(playerId);
  }

  getPlayerEmoji(playerId: string): string | null {
    return this.playerLookupFn.getEmoji(playerId);
  }

  onStartGame(): void {
    this.startGame.emit();
  }
}