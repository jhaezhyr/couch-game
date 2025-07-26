export class Name {
  constructor(public value: string) {}
  equals(other: Name): boolean {
    return this.value === other.value;
  }
}
