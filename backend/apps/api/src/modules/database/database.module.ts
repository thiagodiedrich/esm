import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export const PG_POOL = "PG_POOL";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>("CONTROL_PLANE_DATABASE_URL");
        if (!connectionString) {
          throw new Error("CONTROL_PLANE_DATABASE_URL nao configurada.");
        }

        return new Pool({ connectionString });
      }
    }
  ],
  exports: [PG_POOL]
})
export class DatabaseModule {}
