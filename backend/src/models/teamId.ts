export class TeamId {
  constructor(public value: string) {}
  equals(other: TeamId): boolean {
    return this.value === other.value;
  }
}
