export class RoomId {
  constructor(public value: string) {}
  equals(other: RoomId): boolean {
    return this.value === other.value;
  }
}
