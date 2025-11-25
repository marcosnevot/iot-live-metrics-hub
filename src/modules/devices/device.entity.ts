export class Device {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly apiKeyHash: string,
    public readonly active: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
