import { GameRoom } from "./gameRoom";
import { Name } from "./name";

function validateGameRoom(room: GameRoom) {
  const emptySeats = room.seats.filter((s) => s === null).length;
  if (emptySeats !== 1) {
    throw new Error(
      `Invalid game state: expected 1 empty seat, found ${emptySeats}`
    );
  }
}

export function makeMove(
  room: GameRoom,
  calledNameValue: string
): { winner: string | null } {
  // Find the player holding the called name
  const calledName = new Name(calledNameValue);
  const mover = room.players.find(
    (p) => p.secretName && p.secretName.equals(calledName)
  );
  if (!mover) return { winner: null };

  // Find the empty seat and the player to the right of it
  const emptySeatIdx = room.emptySeat;
  if (emptySeatIdx === null) return { winner: null };
  const rightOfEmpty = (emptySeatIdx + 1) % room.seats.length;
  const caller = room.players.find((p) => p.position === rightOfEmpty);
  if (!caller) return { winner: null };

  // Move the player holding the called name to the empty seat
  if (mover.position === null) return { winner: null };
  const oldMoverPosition = mover.position;
  // Only set the previous position to null if it is not already the empty seat
  if (mover.position !== emptySeatIdx) {
    room.seats[mover.position] = null;
  }
  room.seats[emptySeatIdx] = mover.id;
  mover.position = emptySeatIdx;

  // Update empty seat to where the mover came from
  room.emptySeat = oldMoverPosition;

  // Update turn: next player to right of new empty seat
  room.currentTurn = (room.emptySeat + 1) % room.seats.length;

  // Validate game state
  validateGameRoom(room);

  // Check win condition: all couch seats occupied by one team
  const couchTeamIds = room.couchSeats.map((idx) => {
    const pid = room.seats[idx];
    const player = room.players.find((p) => pid && p.id.equals(pid));
    return player?.team.value;
  });
  const allA =
    couchTeamIds.length > 0 && couchTeamIds.every((tid) => tid === "A");
  const allB =
    couchTeamIds.length > 0 && couchTeamIds.every((tid) => tid === "B");
  let winner: string | null = null;
  if (allA) winner = "A";
  if (allB) winner = "B";

  if (winner) {
    room.state = "finished";
  }

  return { winner };
}
