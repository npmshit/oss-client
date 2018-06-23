/**
 * @file OSS Client
 * @author Yourtion Guo <yourtion@gmail.com>
 */

import assert from "assert";
import crypto from "crypto";
import http from "http";
import { Readable } from "stream";

export interface IOption {
  /** 秘钥ID */
  accessKeyId: string;
  /** 秘钥Key */
  accessKeySecret: string;
  /** Bucket */
  bucket: string;
  /** 地址 */
  endpoint: string;
  /** 前缀 */
  prefix?: string;
}

export type METHOD = "PUT" | "GET" | "POST" | "HEAD" | "DELETE";

export interface IHeader {
  [header: string]: number | string | string[] | undefined;
}

export interface IReply {
  code: number;
  headers: IHeader;
  buffer?: Buffer;
  body?: string;
}

export default class OSSClient {
  private accessKeyId: string;
  private accessKeySecret: string;
  private bucket: string;
  private endpoint: string;
  private prefix?: string;

  constructor(options: IOption) {
    assert(typeof options.accessKeyId === "string", "请配置 AccessKeyId");
    assert(typeof options.accessKeySecret === "string", "请配置 AccessKeySecret");
    assert(typeof options.bucket === "string", "请配置 bucket");
    this.accessKeyId = options.accessKeyId;
    this.accessKeySecret = options.accessKeySecret;
    this.bucket = options.bucket;
    this.endpoint = options.endpoint || "oss-cn-hangzhou.aliyuncs.com";
    this.prefix = options.prefix;
  }

  private getHash(data: string) {
    return crypto
      .createHmac("sha1", this.accessKeySecret)
      .update(data)
      .digest("base64");
  }

  private request(params: any, data?: Buffer | Readable, raw = false): Promise<IReply> {
    return new Promise((resolve, reject) => {
      const req = http.request(params, response => {
        const buffers: any[] = [];
        response.on("data", chunk => buffers.push(chunk));
        response.on("end", () => {
          const buf = Buffer.concat(buffers);
          return resolve({
            code: response.statusCode || -1,
            headers: response.headers,
            buffer: buf,
            body: raw ? "" : buf.toString("utf8")
          });
        });
        response.on("error", err => reject(err));
      });
      req.on("error", err => reject(err));
      if (Buffer.isBuffer(data)) {
        req.end(data);
      } else if (data && typeof data.pipe === "function") {
        data.pipe(req);
      } else {
        req.end();
      }
    });
  }

  sign(method: METHOD, md5: string, contentType: string, date: string, name: string) {
    const signString = [method, md5, contentType, date, `/${this.bucket}/${name}`].join("\n");
    return `OSS ${this.accessKeyId}:${this.getHash(signString)}`;
  }

  private requestObject(method: METHOD, key: string, data?: Buffer | Readable, raw = false) {
    const date = new Date().toUTCString();
    const fielkey = this.prefix ? this.prefix + key : key;
    const sign = this.sign(method, "", "", date, fielkey);
    const option = {
      hostname: `${this.bucket}.${this.endpoint}`,
      path: `/${fielkey}`,
      method: method,
      headers: {
        Date: date,
        Authorization: sign
      }
    };
    return this.request(option, data, raw);
  }

  putObject(key: string, data: Buffer | Readable) {
    return this.requestObject("PUT", key, data);
  }

  getObject(key: string) {
    return this.requestObject("GET", key, undefined, true);
  }

  deleteObject(key: string) {
    return this.requestObject("DELETE", key + "?objectMeta");
  }

  objectMeta(key: string) {
    return this.requestObject("GET", key + "?objectMeta");
  }
}
