"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = exports.PG_POOL = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
exports.PG_POOL = "PG_POOL";
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        providers: [
            {
                provide: exports.PG_POOL,
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const connectionString = configService.get("CONTROL_PLANE_DATABASE_URL");
                    if (!connectionString) {
                        throw new Error("CONTROL_PLANE_DATABASE_URL nao configurada.");
                    }
                    return new pg_1.Pool({ connectionString });
                }
            }
        ],
        exports: [exports.PG_POOL]
    })
], DatabaseModule);
