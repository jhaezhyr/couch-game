import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-controls.component.html',
  styleUrls: ['./game-controls.component.less']
})
export class GameControlsComponent {
  @Input() isCurrentPlayer: boolean = false;
  @Input() mySecretName: string = '';
  @Input() currentPlayerName: string = '';
  @Input() allPlayerNames: string[] = [];

  @Output() nameCall = new EventEmitter<string>();

  onCallName(name: string): void {
    this.nameCall.emit(name);
  }

  isNameDisabled(name: string): boolean {
    return name === this.mySecretName;
  }
}