import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { Public } from "./auth/auth.decorators";

class HealthResponseDto {
  @ApiProperty({ example: "ok" })
  status!: string;
}

@ApiTags("Health")
@Controller()
export class AppController {
  @Public()
  @Get("/health")
  @ApiOperation({ summary: "Healthcheck da API" })
  @ApiOkResponse({ type: HealthResponseDto })
  health() {
    return { status: "ok" };
  }
}
