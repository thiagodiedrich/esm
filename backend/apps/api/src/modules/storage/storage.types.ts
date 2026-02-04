export interface StorageObject {
  key: string;
  contentType: string;
  size: number;
  etag?: string;
  url?: string;
}

export interface StorageUploadInput {
  bucket?: string;
  key: string;
  contentType: string;
  body: Buffer;
}

export interface StorageReadInput {
  bucket?: string;
  key: string;
}
