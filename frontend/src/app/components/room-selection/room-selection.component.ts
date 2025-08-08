import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GameSession {
  roomId: string;
  roomName: string;
  playerName: string;
  emoji?: string;
  gamePhase: string;
  playerCount: number;
}

@Component({
  selector: 'app-room-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room-selection.component.html',
  styleUrls: ['./room-selection.component.less']
})
export class RoomSelectionComponent {
  @Input() loadingSessions = signal(false);
  @Input() activeSessions = signal<GameSession[]>([]);
  
  @Output() joinRoom = new EventEmitter<string>();
  @Output() rejoinSession = new EventEmitter<GameSession>();

  roomId = signal('');

  onJoinRoom(): void {
    this.joinRoom.emit(this.roomId());
  }

  onRejoinSession(session: GameSession): void {
    this.rejoinSession.emit(session);
  }

  updateRoomId(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.roomId.set(target.value);
  }

  onEnterKey(): void {
    this.onJoinRoom();
  }
}