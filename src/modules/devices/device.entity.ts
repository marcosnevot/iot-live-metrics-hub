export class Device {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly apiKey: string,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
