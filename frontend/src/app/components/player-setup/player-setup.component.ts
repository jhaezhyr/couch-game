import { Component, Input, Output, EventEmitter, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-setup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-setup.component.html',
  styleUrls: ['./player-setup.component.less']
})
export class PlayerSetupComponent implements AfterViewInit {
  @Input() currentPlayerName: string = '';
  @Input() currentPlayerEmoji: string = '';
  @Input() emojiBank: string[] = [];

  @Output() nameUpdated = new EventEmitter<string>();
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() focusRequested = new EventEmitter<void>();

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  playerName = signal('');

  ngAfterViewInit() {
    // Sync the initial name
    this.playerName.set(this.currentPlayerName);
  }

  updatePlayerName(): void {
    if (this.playerName().trim() && this.playerName().trim() !== this.currentPlayerName) {
      this.nameUpdated.emit(this.playerName().trim());
    }
  }

  onNameInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.playerName.set(target.value);
  }

  onEmojiClick(emoji: string, event: Event): void {
    // Add visual feedback
    const button = event.target as HTMLButtonElement;
    button.classList.add('active');
    setTimeout(() => button.classList.remove('active'), 150);
    
    this.emojiSelected.emit(emoji);
  }

  focusNameInput(): void {
    this.focusRequested.emit();
    setTimeout(() => {
      if (this.nameInput?.nativeElement) {
        this.nameInput.nativeElement.focus();
      }
    }, 0);
  }

  isUpdateDisabled(): boolean {
    return !this.playerName().trim() || this.playerName().trim() === this.currentPlayerName;
  }

  onEnterKey(): void {
    this.updatePlayerName();
  }
}