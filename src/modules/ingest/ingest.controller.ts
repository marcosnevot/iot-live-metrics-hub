import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { IngestService } from "./ingest.service";
import { IngestRequestDto } from "./dto/ingest-request.dto";
import { ApiKeyAuthGuard } from "../auth/guards/api-key-auth.guard";

@Controller()
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @UseGuards(ApiKeyAuthGuard)
  @Post("ingest")
  async ingest(@Body() body: IngestRequestDto) {
    const stored = await this.ingestService.ingest(body);

    return {
      status: "ok",
      stored,
    };
  }
}
