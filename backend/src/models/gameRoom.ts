import { Player } from './player';
import { RoomId } from './roomId';
import { PlayerId } from './playerId';
import { Name } from './name';

export class GameRoom {
  roomId: RoomId;
  players: Player[] = [];
  state: 'waiting' | 'started' | 'finished' = 'waiting';
  teams: { teamA: Player[]; teamB: Player[] } = { teamA: [], teamB: [] };
  seats: Array<PlayerId | null> = [];
  couchSeats: number[] = [];
  emptySeat: number | null = null;
  currentTurn: number | null = null;

  constructor(roomId: RoomId) {
    this.roomId = roomId;
  }

  addPlayer(player: Player) {
    this.players.push(player);
  }
}
