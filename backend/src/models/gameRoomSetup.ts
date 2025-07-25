import { Player } from './player';
import { RoomId } from './roomId';
import { PlayerId } from './playerId';
import { Name } from './name';
import { TeamId } from './teamId';

export class GameRoomSetup {
  roomId: RoomId;
  players: Player[] = [];
  constructor(roomId: RoomId) {
    this.roomId = roomId;
  }
  addPlayer(player: Player) {
    this.players.push(player);
  }
}
