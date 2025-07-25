import { PlayerId } from './playerId';
import { Name } from './name';
import { TeamId } from './teamId';

export class Player {
  id: PlayerId;
  name: Name;
  team: TeamId;
  position: number | null;
  secretName: Name | null;

  constructor(id: PlayerId, name: Name, team: TeamId) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.position = null;
    this.secretName = null;
  }
}
