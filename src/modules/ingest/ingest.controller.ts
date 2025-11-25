import { Body, Controller, Logger, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { IngestService } from "./ingest.service";
import { IngestRequestDto } from "./dto/ingest-request.dto";
import { ApiKeyAuthGuard } from "../auth/guards/api-key-auth.guard";
import { IngestResponseDto } from "./dto/ingest-response.dto";

@ApiTags("Ingest")
@Controller()
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(private readonly ingestService: IngestService) {}

  @UseGuards(ApiKeyAuthGuard)
  @Post("ingest")
  @ApiOperation({
    summary: "Ingest metrics via HTTP",
    description:
      "Accepts a batch of metrics in JSON format and stores them in the time-series backend. Requires a valid device API key in the Authorization: Bearer <api_key> header.",
  })
  @ApiSecurity("api-key")
  @ApiBody({
    description: "Metrics batch to be ingested.",
    type: IngestRequestDto,
  })
  @ApiOkResponse({
    description: "Metrics ingested successfully.",
    type: IngestResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid payload or validation error.",
  })
  @ApiUnauthorizedResponse({
    description: "Missing or invalid API key.",
  })
  async ingest(@Body() body: IngestRequestDto): Promise<IngestResponseDto> {
    this.logger.log({
      module: "ingest",
      operation: "http_ingest",
      channel: "http",
      deviceId: body.device_id,
      metricsCount: body.metrics.length,
      status: "received",
    });

    const stored = await this.ingestService.ingest(body);

    this.logger.log({
      module: "ingest",
      operation: "http_ingest",
      channel: "http",
      deviceId: body.device_id,
      metricsCount: stored,
      status: "success",
    });

    return {
      status: "ok",
      stored,
    };
  }
}
