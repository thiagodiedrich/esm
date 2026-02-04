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
        const direct = configService.get<string>("CONTROL_PLANE_DATABASE_URL");
        const connectionString =
          direct ??
          buildConnectionString({
            host: configService.get<string>("POSTGRES_HOST"),
            port: configService.get<string>("POSTGRES_PORT"),
            user: configService.get<string>("POSTGRES_USER"),
            password: configService.get<string>("POSTGRES_PASSWORD"),
            database: configService.get<string>("POSTGRES_DB")
          });

        if (!connectionString) {
          throw new Error("CONTROL_PLANE_DATABASE_URL ou POSTGRES_* nao configurados.");
        }

        return new Pool({ connectionString });
      }
    }
  ],
  exports: [PG_POOL]
})
export class DatabaseModule {}

function buildConnectionString(params: {
  host?: string | null;
  port?: string | null;
  user?: string | null;
  password?: string | null;
  database?: string | null;
}) {
  const host = params.host ?? "";
  const user = params.user ?? "";
  const password = params.password ?? "";
  const database = params.database ?? "";
  if (!host || !user || !database) {
    return null;
  }
  const port = params.port ?? "5432";
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}
