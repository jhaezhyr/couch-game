import { Injectable } from '@angular/core';
import { io, Socket as SocketIOClient } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';

// Types from backend
export interface Player {
  id: string;
  name: string;
  emoji: string | null;
  isReady: boolean;
}

export interface GameRoom {
  id: string;
  seats: (Player | null)[];
  teams: {
    A: string[];
    B: string[];
  };
  currentPlayerIndex: number;
  gamePhase: 'waiting' | 'setup' | 'playing' | 'finished';
  couchSeats?: number[];
  secretNames?: { playerId: string; secretName: string }[];
}

interface GameEvent {
  type:
    | 'playerJoined'
    | 'playerLeft'
    | 'seatTaken'
    | 'teamAssigned'
    | 'gameStarted'
    | 'moveMade'
    | 'gameFinished'
    | 'nameCalled'
    | 'emojiChanged'
    | 'roomUpdate'
    | 'error';
  data: any;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: SocketIOClient | null = null;
  private gameEventSubject = new Subject<GameEvent>();
  private connectionStatusSubject = new Subject<boolean>();

  public gameEvents$ = this.gameEventSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  private readonly SERVER_DOMAIN = environment.serverDomain;
  private readonly SERVER_PATH_PREFIX = environment.serverPathPrefix;

  connect(): Observable<boolean> {
    return new Observable((observer) => {
      if (this.socket?.connected) {
        observer.next(true);
        observer.complete();
        return;
      }

      this.socket = io(this.SERVER_DOMAIN, {
        path: this.SERVER_PATH_PREFIX + '/socket.io',
      });

      this.socket.on('connect', () => {
        console.log('Connected to server');
        this.connectionStatusSubject.next(true);
        observer.next(true);
        observer.complete();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.connectionStatusSubject.next(false);
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        this.connectionStatusSubject.next(false);
        observer.error(error);
      });

      // Game event listeners
      this.setupGameEventListeners();
    });
  }

  private setupGameEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('playerJoined', (data) => {
      this.gameEventSubject.next({ type: 'playerJoined', data });
    });

    this.socket.on('playerLeft', (data) => {
      this.gameEventSubject.next({ type: 'playerLeft', data });
    });

    this.socket.on('seatTaken', (data) => {
      this.gameEventSubject.next({ type: 'seatTaken', data });
    });

    this.socket.on('teamAssigned', (data) => {
      this.gameEventSubject.next({ type: 'teamAssigned', data });
    });

    this.socket.on('gameStarted', (data) => {
      this.gameEventSubject.next({ type: 'gameStarted', data });
    });

    this.socket.on('moveMade', (data) => {
      this.gameEventSubject.next({ type: 'moveMade', data });
    });

    this.socket.on('gameFinished', (data) => {
      this.gameEventSubject.next({ type: 'gameFinished', data });
    });

    this.socket.on('nameCalled', (data) => {
      this.gameEventSubject.next({ type: 'nameCalled', data });
    });

    this.socket.on('emojiChanged', (data) => {
      this.gameEventSubject.next({ type: 'emojiChanged', data });
    });

    this.socket.on('roomUpdate', (data) => {
      this.gameEventSubject.next({ type: 'roomUpdate', data });
    });

    this.socket.on('gameStarted', (data) => {
      this.gameEventSubject.next({ type: 'gameStarted', data });
    });

    this.socket.on('moveMade', (data) => {
      this.gameEventSubject.next({ type: 'moveMade', data });
    });

    this.socket.on('gameFinished', (data) => {
      this.gameEventSubject.next({ type: 'gameFinished', data });
    });

    this.socket.on('error', (data) => {
      this.gameEventSubject.next({ type: 'error', data });
    });
  }

  // Game actions
  joinRoom(
    roomId: string,
    playerName: string,
    persistentPlayerId?: string
  ): void {
    this.socket?.emit('joinRoom', {
      roomId,
      name: playerName,
      persistentPlayerId,
    });
  }

  leaveRoom(): void {
    this.socket?.emit('leaveRoom');
  }

  takeSeat(seatIndex: number): void {
    this.socket?.emit('takeSeat', { seatIndex });
  }

  assignToTeam(playerId: string, team: 'A' | 'B'): void {
    this.socket?.emit('assignToTeam', { playerId, team });
  }

  startGame(roomId: string): void {
    this.socket?.emit('startGame', { roomId });
  }

  makeMove(roomId: string, calledNameValue: string): void {
    this.socket?.emit('makeMove', { roomId, calledNameValue });
  }

  callPlayerName(name: string): void {
    this.socket?.emit('callName', { name });
  }

  setEmoji(emoji: string): void {
    this.socket?.emit('setEmoji', { emoji });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
