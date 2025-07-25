import { Player } from './player';
import { RoomId } from './roomId';
import { PlayerId } from './playerId';
import { Name } from './name';
import { TeamId } from './teamId';
import { GameRoomSetup } from './gameRoomSetup';

export class GameRoom {
  roomId: RoomId;
  players: Player[];
  state: 'started' | 'finished';
  teams: { teamA: Player[]; teamB: Player[] };
  seats: Array<PlayerId | null>;
  couchSeats: number[];
  emptySeat: number;
  currentTurn: number;

  private constructor(
    roomId: RoomId,
    players: Player[],
    teams: { teamA: Player[]; teamB: Player[] },
    seats: Array<PlayerId | null>,
    couchSeats: number[],
    emptySeat: number,
    currentTurn: number
  ) {
    this.roomId = roomId;
    this.players = players;
    this.state = 'started';
    this.teams = teams;
    this.seats = seats;
    this.couchSeats = couchSeats;
    this.emptySeat = emptySeat;
    this.currentTurn = currentTurn;
  }

  static fromSetup(setup: GameRoomSetup): GameRoom {
    // Assign teams (alternating order)
    const shuffledPlayers = [...setup.players].sort(() => Math.random() - 0.5);
    const teamA: Player[] = [];
    const teamB: Player[] = [];
    shuffledPlayers.forEach((player, idx) => {
      if (idx % 2 === 0) {
        teamA.push(player);
        player.team = new TeamId('A');
      } else {
        teamB.push(player);
        player.team = new TeamId('B');
      }
    });
    const teams = { teamA, teamB };

    // Arrange seats: alternating team pattern, one empty seat
    const totalSeats = shuffledPlayers.length + 1;
    const seats: Array<PlayerId | null> = Array(totalSeats).fill(null);
    for (let i = 0; i < shuffledPlayers.length; i++) {
      seats[i] = shuffledPlayers[i].id;
      shuffledPlayers[i].position = i;
    }
    // The empty seat remains null
    const emptySeat = shuffledPlayers.length; // Last seat is empty

    // Dynamic couch seats: (num of players)/3, rounded down, minimum 2
    const couchSize = Math.max(2, Math.floor(shuffledPlayers.length / 3));
    const couchSeats = Array.from({ length: couchSize }, (_, i) => i);

    // Secret name assignment
    const names = shuffledPlayers.map(p => p.name);
    const secretNames = [...names].sort(() => Math.random() - 0.5);
    shuffledPlayers.forEach((player, idx) => {
      player.secretName = secretNames[idx];
    });

    // Current turn: player to right of empty seat
    const currentTurn = (emptySeat + 1) % seats.length;

    return new GameRoom(
      setup.roomId,
      shuffledPlayers,
      teams,
      seats,
      couchSeats,
      emptySeat,
      currentTurn
    );
  }
}
