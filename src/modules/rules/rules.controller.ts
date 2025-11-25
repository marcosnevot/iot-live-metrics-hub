import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/roles.decorator";

@ApiTags("Rules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("rules")
export class RulesController {
  private readonly logger = new Logger(RulesController.name);

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
  @Roles("admin")
  async createRule(@Body() body: CreateRuleDto): Promise<Rule> {
    const ruleType = body.rule_type;

    this.logger.log({
      module: "rules",
      operation: "create_rule",
      deviceId: body.device_id,
      metricName: body.metric_name?.toLowerCase(),
      ruleType,
      enabled: body.enabled ?? true,
      status: "requested",
    });

    const created = await this.rulesRepository.createRule({
      deviceId: body.device_id,
      metricName: body.metric_name.toLowerCase(),
      ruleType,
      minValue: body.min_value !== undefined ? Number(body.min_value) : null,
      maxValue: body.max_value !== undefined ? Number(body.max_value) : null,
      enabled: body.enabled ?? true,
    });

    this.logger.log({
      module: "rules",
      operation: "create_rule",
      deviceId: created.deviceId,
      metricName: created.metricName,
      ruleId: created.id,
      ruleType: created.ruleType,
      enabled: created.enabled,
      status: "success",
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
  @Roles("admin")
  async getRulesForDevice(
    @Param("deviceId") deviceId: string,
  ): Promise<Rule[]> {
    this.logger.log({
      module: "rules",
      operation: "list_rules_for_device",
      deviceId,
      status: "requested",
    });

    const rules = await this.rulesRepository.findByDevice(deviceId);

    this.logger.log({
      module: "rules",
      operation: "list_rules_for_device",
      deviceId,
      rulesCount: rules.length,
      status: "success",
    });

    return rules;
  }
}
