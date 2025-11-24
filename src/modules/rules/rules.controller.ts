import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { RulesRepository } from "./rules.repository";
import { Rule, RuleType } from "./rule.entity";
import { CreateRuleDto } from "./dto/create-rule.dto";

@Controller("rules")
export class RulesController {
  constructor(private readonly rulesRepository: RulesRepository) {}

  @Post()
  async createRule(@Body() body: CreateRuleDto): Promise<Rule> {
    const ruleType = body.rule_type as RuleType;

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
  async getRulesForDevice(
    @Param("deviceId") deviceId: string,
  ): Promise<Rule[]> {
    return this.rulesRepository.findByDevice(deviceId);
  }
}
