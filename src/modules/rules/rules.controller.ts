import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { RulesRepository } from "./rules.repository";
import { Rule } from "./rule.entity";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { RuleResponseDto } from "./dto/rule-response.dto";

@ApiTags("Rules")
@Controller("rules")
export class RulesController {
  constructor(private readonly rulesRepository: RulesRepository) {}

  @Post()
  @ApiOperation({
    summary: "Create rule",
    description:
      "Creates a new rule associated with a device and a metric. The rule can be MAX, MIN or RANGE.",
  })
  @ApiCreatedResponse({
    description: "Rule created successfully.",
    type: RuleResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid rule definition or validation error.",
  })
  async createRule(@Body() body: CreateRuleDto): Promise<Rule> {
    const ruleType = body.rule_type;

    const created = await this.rulesRepository.createRule({
      deviceId: body.device_id,
      metricName: body.metric_name.toLowerCase(),
      ruleType,
      minValue: body.min_value !== undefined ? Number(body.min_value) : null,
      maxValue: body.max_value !== undefined ? Number(body.max_value) : null,
      enabled: body.enabled ?? true,
    });

    return created;
  }

  @Get(":deviceId")
  @ApiOperation({
    summary: "List rules for a device",
    description: "Returns all rules configured for a given device.",
  })
  @ApiParam({
    name: "deviceId",
    description: "Device identifier associated with the rules.",
    example: "26db826c-f573-4444-84d5-47a29d06f9e5",
  })
  @ApiOkResponse({
    description: "List of rules for the given device.",
    type: RuleResponseDto,
    isArray: true,
  })
  async getRulesForDevice(
    @Param("deviceId") deviceId: string,
  ): Promise<Rule[]> {
    return this.rulesRepository.findByDevice(deviceId);
  }
}
