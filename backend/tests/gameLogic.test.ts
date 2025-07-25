import { GameRoom } from '../src/models/gameRoom';
import { GameRoomSetup } from '../src/models/gameRoomSetup';
import { Player } from '../src/models/player';
import { PlayerId } from '../src/models/playerId';
import { RoomId } from '../src/models/roomId';
import { Name } from '../src/models/name';
import { TeamId } from '../src/models/teamId';
import { makeMove } from '../src/models/gameLogic';

describe('makeMove', () => {
  it('should move the correct player and update the empty seat', () => {
    const setup = new GameRoomSetup(new RoomId('room1'));
    for (let i = 0; i < 12; i++) {
      setup.addPlayer(new Player(new PlayerId(`id${i}`), new Name(`Player${i}`), new TeamId(i % 2 === 0 ? 'A' : 'B')));
    }
    const gameRoom = GameRoom.fromSetup(setup);
    // Ensure only one empty seat
    // Assign all player seats except one empty seat
    for (let i = 0; i < gameRoom.players.length; i++) {
      gameRoom.seats[i] = gameRoom.players[i].id;
      gameRoom.players[i].position = i;
    }
    // Set the last seat as empty
    const emptyIdx = gameRoom.players.length;
    gameRoom.seats[emptyIdx] = null;
    gameRoom.emptySeat = emptyIdx;
    // Remove position from any player who might have been assigned to the empty seat
    gameRoom.players.forEach(p => {
      if (p.position === emptyIdx) p.position = null;
    });
    // Find a calledIdx that is not the empty seat or the caller
    const callerIdx = (emptyIdx + 1) % gameRoom.seats.length;
    let calledIdx = 0;
    while (calledIdx === callerIdx || calledIdx === emptyIdx) {
      calledIdx++;
    }
    const calledName = gameRoom.players[calledIdx].secretName!.value;
    const actualMover = gameRoom.players.find(p => p.secretName && p.secretName.value === calledName);
    const oldEmptySeat = gameRoom.emptySeat;
    const result = makeMove(gameRoom, calledName);
    expect(gameRoom.seats[oldEmptySeat]).toEqual(actualMover?.id);
    expect(gameRoom.seats.filter(s => s === null).length).toBe(1);
    expect(gameRoom.emptySeat).not.toBe(oldEmptySeat);
    expect(result.winner).toBeNull();
  });

  it('should finish the game if all couch seats are occupied by one team', () => {
    const setup = new GameRoomSetup(new RoomId('room2'));
    for (let i = 0; i < 12; i++) {
      setup.addPlayer(new Player(new PlayerId(`id${i}`), new Name(`Player${i}`), new TeamId(i < 4 ? 'A' : 'B')));
    }
    const gameRoom = GameRoom.fromSetup(setup);
    // Set all seats to team A players except one empty seat
    // Assign all player seats except one empty seat
    for (let i = 0; i < gameRoom.players.length; i++) {
      gameRoom.seats[i] = gameRoom.players[i].id;
      gameRoom.players[i].position = i;
      // Set couch seat players to team A
      if (gameRoom.couchSeats.includes(i)) {
        gameRoom.players[i].team = new TeamId('A');
      }
    }
    // Set the last seat as empty
    const emptyIdx = gameRoom.players.length;
    gameRoom.seats[emptyIdx] = null;
    gameRoom.emptySeat = emptyIdx;
    // Remove position from any player who might have been assigned to the empty seat
    gameRoom.players.forEach(p => {
      if (p.position === emptyIdx) p.position = null;
    });
    // Call a name for a player whose move will not affect couch seats
    let calledIdx = gameRoom.couchSeats.length; // pick a non-couch player
    const calledName = gameRoom.players[calledIdx].secretName!.value;
    const result = makeMove(gameRoom, calledName);
    const couchTeamIds = gameRoom.couchSeats.map(idx => {
      const pid = gameRoom.seats[idx];
      const player = gameRoom.players.find(p => pid && p.id.equals(pid));
      return player?.team.value;
    });
    expect(couchTeamIds.every(tid => tid === 'A')).toBe(true);
    expect(result.winner).toBe('A');
    expect(gameRoom.state).toBe('finished');
  });
});
