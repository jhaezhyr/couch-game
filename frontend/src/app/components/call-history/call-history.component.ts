import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface GameCall {
  callerName: string;
  calledName: string;
  movedPlayerName?: string;
  at: number;
}

@Component({
  selector: 'app-call-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call-history.component.html',
  styleUrls: ['./call-history.component.less']
})
export class CallHistoryComponent {
  @Input() recentCalls: GameCall[] = [];
  @Input() maxDisplayedCalls: number = 3;

  getDisplayedRecentCalls(): GameCall[] {
    return this.recentCalls.slice(-this.maxDisplayedCalls);
  }

  getHiddenCallsCount(): number {
    return Math.max(0, this.recentCalls.length - this.maxDisplayedCalls);
  }
}