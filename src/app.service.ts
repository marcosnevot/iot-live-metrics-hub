import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getRoot(): string {
    return "IoT Live Metrics Hub backend is up";
  }
}
