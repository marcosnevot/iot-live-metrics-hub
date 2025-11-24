import { ApiProperty } from "@nestjs/swagger";

export class IngestResponseDto {
  @ApiProperty({
    description: "Overall ingest operation status.",
    example: "ok",
  })
  status!: string;

  @ApiProperty({
    description: "Number of metrics successfully stored.",
    example: 10,
  })
  stored!: number;
}
