import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "minio";
import { createWriteStream, createReadStream } from "fs";
import { dirname } from "path";
import { mkdir } from "fs/promises";
import { StorageObject, StorageReadInput, StorageUploadInput } from "./storage.types";

export interface StorageConfig {
  type: string;
  minio: {
    endpoint: string | null;
    accessKey: string | null;
    secretKey: string | null;
    bucket: string | null;
    region: string | null;
    useSsl: boolean;
  };
  localPath: string | null;
}

@Injectable()
export class StorageService {
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  getConfig(): StorageConfig {
    const type = (this.configService.get<string>("STORAGE_TYPE") ?? "minio").toLowerCase();
    return {
      type,
      minio: {
        endpoint: this.configService.get<string>("MINIO_ENDPOINT") ?? null,
        accessKey: this.configService.get<string>("MINIO_ACCESS_KEY") ?? null,
        secretKey: this.configService.get<string>("MINIO_SECRET_KEY") ?? null,
        bucket: this.configService.get<string>("MINIO_BUCKET") ?? null,
        region: this.configService.get<string>("MINIO_REGION") ?? null,
        useSsl:
          (this.configService.get<string>("MINIO_USE_SSL") ?? "false").toLowerCase() === "true"
      },
      localPath: this.configService.get<string>("STORAGE_LOCAL_PATH") ?? null
    };
  }

  async upload(input: StorageUploadInput): Promise<StorageObject> {
    const config = this.getConfig();
    if (config.type === "local") {
      return this.uploadLocal(input, config);
    }
    return this.uploadMinio(input, config);
  }

  async read(input: StorageReadInput): Promise<NodeJS.ReadableStream> {
    const config = this.getConfig();
    if (config.type === "local") {
      return this.readLocal(input, config);
    }
    return this.readMinio(input, config);
  }

  private buildMinioClient(config: StorageConfig): Client {
    if (this.client) {
      return this.client;
    }
    if (!config.minio.endpoint || !config.minio.accessKey || !config.minio.secretKey) {
      throw new Error("MinIO nao configurado.");
    }
    const endpoint = config.minio.endpoint.replace(/^https?:\/\//, "");
    const [host, portRaw] = endpoint.split(":");
    const port = config.minio.useSsl ? 443 : Number(portRaw || 9000);

    const client = new Client({
      endPoint: host,
      port,
      useSSL: config.minio.useSsl,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey
    });
    this.client = client;
    return client;
  }

  private async ensureBucket(client: Client, bucket: string, region?: string | null) {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, region ?? "us-east-1");
    }
  }

  private async uploadMinio(input: StorageUploadInput, config: StorageConfig) {
    const bucket = input.bucket ?? config.minio.bucket ?? "";
    if (!bucket) {
      throw new Error("Bucket nao definido.");
    }
    const client = this.buildMinioClient(config);
    await this.ensureBucket(client, bucket, config.minio.region);
    const result = await client.putObject(
      bucket,
      input.key,
      input.body,
      input.body.length,
      { "Content-Type": input.contentType }
    );

    return {
      key: input.key,
      contentType: input.contentType,
      size: input.body.length,
      etag: result.etag
    };
  }

  private async readMinio(input: StorageReadInput, config: StorageConfig) {
    const bucket = input.bucket ?? config.minio.bucket ?? "";
    if (!bucket) {
      throw new Error("Bucket nao definido.");
    }
    const client = this.buildMinioClient(config);
    return client.getObject(bucket, input.key);
  }

  private async uploadLocal(input: StorageUploadInput, config: StorageConfig): Promise<StorageObject> {
    const basePath = config.localPath ?? "";
    if (!basePath) {
      throw new Error("STORAGE_LOCAL_PATH nao configurado.");
    }
    const filePath = `${basePath}/${input.key}`;
    await mkdir(dirname(filePath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(filePath);
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

  private async readLocal(input: StorageReadInput, config: StorageConfig) {
    const basePath = config.localPath ?? "";
    if (!basePath) {
      throw new Error("STORAGE_LOCAL_PATH nao configurado.");
    }
    const filePath = `${basePath}/${input.key}`;
    return createReadStream(filePath);
  }
}
