export class PlayerId {
  constructor(public value: string) {}
  equals(other: PlayerId): boolean {
    return this.value === other.value;
  }
}
