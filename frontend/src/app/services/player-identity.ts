import { Injectable } from '@angular/core';
import Cookies from 'js-cookie';

@Injectable({
  providedIn: 'root'
})
export class PlayerIdentityService {
  private readonly PLAYER_ID_COOKIE = 'couch-game-player-id';
  private readonly COOKIE_EXPIRY_DAYS = 30;

  getOrCreatePlayerId(): string {
    // Try to get existing player ID from cookie
    let playerId = Cookies.get(this.PLAYER_ID_COOKIE);
    
    if (!playerId) {
      // Generate new unique player ID
      playerId = this.generatePlayerId();
      this.setPlayerId(playerId);
    }
    
    return playerId;
  }

  setPlayerId(playerId: string): void {
    Cookies.set(this.PLAYER_ID_COOKIE, playerId, { 
      expires: this.COOKIE_EXPIRY_DAYS,
      sameSite: 'strict'
    });
  }

  clearPlayerId(): void {
    Cookies.remove(this.PLAYER_ID_COOKIE);
  }

  hasStoredPlayerId(): boolean {
    return !!Cookies.get(this.PLAYER_ID_COOKIE);
  }

  private generatePlayerId(): string {
    // Generate a unique ID using timestamp + random string
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `player_${timestamp}_${randomStr}`;
  }
}
