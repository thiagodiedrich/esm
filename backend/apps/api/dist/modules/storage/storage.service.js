"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const minio_1 = require("minio");
const fs_1 = require("fs");
const path_1 = require("path");
const promises_1 = require("fs/promises");
let StorageService = class StorageService {
    constructor(configService) {
        this.configService = configService;
        this.client = null;
    }
    getConfig() {
        const type = (this.configService.get("STORAGE_TYPE") ?? "minio").toLowerCase();
        return {
            type,
            minio: {
                endpoint: this.configService.get("MINIO_ENDPOINT") ?? null,
                accessKey: this.configService.get("MINIO_ACCESS_KEY") ?? null,
                secretKey: this.configService.get("MINIO_SECRET_KEY") ?? null,
                bucket: this.configService.get("MINIO_BUCKET") ?? null,
                region: this.configService.get("MINIO_REGION") ?? null,
                useSsl: (this.configService.get("MINIO_USE_SSL") ?? "false").toLowerCase() === "true"
            },
            localPath: this.configService.get("STORAGE_LOCAL_PATH") ?? null
        };
    }
    async upload(input) {
        const config = this.getConfig();
        if (config.type === "local") {
            return this.uploadLocal(input, config);
        }
        return this.uploadMinio(input, config);
    }
    async read(input) {
        const config = this.getConfig();
        if (config.type === "local") {
            return this.readLocal(input, config);
        }
        return this.readMinio(input, config);
    }
    buildMinioClient(config) {
        if (this.client) {
            return this.client;
        }
        if (!config.minio.endpoint || !config.minio.accessKey || !config.minio.secretKey) {
            throw new Error("MinIO nao configurado.");
        }
        const endpoint = config.minio.endpoint.replace(/^https?:\/\//, "");
        const [host, portRaw] = endpoint.split(":");
        const port = config.minio.useSsl ? 443 : Number(portRaw || 9000);
        const client = new minio_1.Client({
            endPoint: host,
            port,
            useSSL: config.minio.useSsl,
            accessKey: config.minio.accessKey,
            secretKey: config.minio.secretKey
        });
        this.client = client;
        return client;
    }
    async ensureBucket(client, bucket, region) {
        const exists = await client.bucketExists(bucket);
        if (!exists) {
            await client.makeBucket(bucket, region ?? "us-east-1");
        }
    }
    async uploadMinio(input, config) {
        const bucket = input.bucket ?? config.minio.bucket ?? "";
        if (!bucket) {
            throw new Error("Bucket nao definido.");
        }
        const client = this.buildMinioClient(config);
        await this.ensureBucket(client, bucket, config.minio.region);
        const result = await client.putObject(bucket, input.key, input.body, input.body.length, { "Content-Type": input.contentType });
        return {
            key: input.key,
            contentType: input.contentType,
            size: input.body.length,
            etag: result.etag
        };
    }
    async readMinio(input, config) {
        const bucket = input.bucket ?? config.minio.bucket ?? "";
        if (!bucket) {
            throw new Error("Bucket nao definido.");
        }
        const client = this.buildMinioClient(config);
        return client.getObject(bucket, input.key);
    }
    async uploadLocal(input, config) {
        const basePath = config.localPath ?? "";
        if (!basePath) {
            throw new Error("STORAGE_LOCAL_PATH nao configurado.");
        }
        const filePath = `${basePath}/${input.key}`;
        await (0, promises_1.mkdir)((0, path_1.dirname)(filePath), { recursive: true });
        await new Promise((resolve, reject) => {
            const stream = (0, fs_1.createWriteStream)(filePath);
            stream.on("error", reject);
            stream.on("finish", () => resolve());
            stream.end(input.body);
        });
        return {
            key: input.key,
            contentType: input.contentType,
            size: input.body.length
        };
    }
    async readLocal(input, config) {
        const basePath = config.localPath ?? "";
        if (!basePath) {
            throw new Error("STORAGE_LOCAL_PATH nao configurado.");
        }
        const filePath = `${basePath}/${input.key}`;
        return (0, fs_1.createReadStream)(filePath);
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
