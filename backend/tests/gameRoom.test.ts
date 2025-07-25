import { GameRoom } from '../src/models/gameRoom';
import { GameRoomSetup } from '../src/models/gameRoomSetup';
import { Player } from '../src/models/player';
import { PlayerId } from '../src/models/playerId';
import { RoomId } from '../src/models/roomId';
import { Name } from '../src/models/name';
import { TeamId } from '../src/models/teamId';

describe('GameRoom', () => {
  it('should create a valid in-game state from setup', () => {
    const setup = new GameRoomSetup(new RoomId('room1'));
    for (let i = 0; i < 12; i++) {
      setup.addPlayer(new Player(new PlayerId(`id${i}`), new Name(`Player${i}`), new TeamId(i % 2 === 0 ? 'A' : 'B')));
    }
    const gameRoom = GameRoom.fromSetup(setup);
    expect(gameRoom.seats.length).toBe(13); // 12 players + 1 empty seat
    expect(gameRoom.seats.filter(s => s === null).length).toBe(1); // Only one empty seat
    expect(gameRoom.emptySeat).toBe(12);
    expect(gameRoom.currentTurn).toBe(0);
    expect(gameRoom.couchSeats).toEqual([0, 1, 2, 3]);
    expect(gameRoom.state).toBe('started');
  });

  it('should assign teams alternately', () => {
    const setup = new GameRoomSetup(new RoomId('room2'));
    for (let i = 0; i < 12; i++) {
      setup.addPlayer(new Player(new PlayerId(`id${i}`), new Name(`Player${i}`), new TeamId('X')));
    }
    const gameRoom = GameRoom.fromSetup(setup);
    const teamA = gameRoom.teams.teamA.length;
    const teamB = gameRoom.teams.teamB.length;
    expect(teamA).toBe(6);
    expect(teamB).toBe(6);
  });

  it('should assign secret names to all players', () => {
    const setup = new GameRoomSetup(new RoomId('room3'));
    for (let i = 0; i < 12; i++) {
      setup.addPlayer(new Player(new PlayerId(`id${i}`), new Name(`Player${i}`), new TeamId('X')));
    }
    const gameRoom = GameRoom.fromSetup(setup);
    gameRoom.players.forEach(player => {
      expect(player.secretName).toBeInstanceOf(Name);
    });
  });
});
