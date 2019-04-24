/**
 * @file OSS Client
 * @author Yourtion Guo <yourtion@gmail.com>
 */

import assert from "assert";
import crypto from "crypto";
import http, { Agent } from "http";
import { Readable } from "stream";
import { extname } from "path";
import { getType } from "mime";

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
  /** 自定义访问地址 */
  cdn?: string;
  /** HTTP Agent */
  agent?: Agent;
}

export interface IPutOption {
  /** contentType */
  type?: string;
  /** 文件名（用于计算contentType） */
  name?: string;
  /** 文件md5 */
  md5?: string;
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
  private endpoint?: string;
  private prefix?: string;
  private cdn: string;
  private agent?: Agent;

  constructor(options: IOption) {
    assert(typeof options.accessKeyId === "string", "请配置 AccessKeyId");
    assert(typeof options.accessKeySecret === "string", "请配置 AccessKeySecret");
    assert(typeof options.bucket === "string", "请配置 bucket");
    if (options.endpoint) {
      assert(
        /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/.test(options.endpoint),
        "endpoint只能配置域名"
      );
    }
    if (options.cdn) {
      assert(
        /^((^https?:)?(?:\/\/)?)([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/.test(options.cdn),
        "cdn必须配置url(最后不需要 `/`)"
      );
    }
    this.accessKeyId = options.accessKeyId;
    this.accessKeySecret = options.accessKeySecret;
    this.bucket = options.bucket;
    this.endpoint = options.endpoint || "oss-cn-hangzhou.aliyuncs.com";
    this.prefix = options.prefix;
    this.cdn = options.cdn || `http://${this.bucket}.${this.endpoint}`;
    this.agent = options.agent;
  }

  private getHash(data: string) {
    return crypto
      .createHmac("sha1", this.accessKeySecret)
      .update(data)
      .digest("base64");
  }

  private getFileKey(key: string) {
    const res = this.prefix ? this.prefix + key : key;
    return res.replace(/^\/+/, "");
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

  signUrl(name: string, expires: number) {
    const signString = ["GET", "", "", expires, `/${this.bucket}/${name}`].join("\n");
    return encodeURIComponent(this.getHash(signString));
  }

  private requestObject(method: METHOD, key: string, data?: Buffer | Readable, raw = false, options: IPutOption = {}) {
    const date = new Date().toUTCString();
    const filekey = this.getFileKey(key);
    const ext = extname(options.name || filekey);
    const type = (method === "POST" || method === "PUT") && ext ? getType(ext.replace(".", "")) : options.type || "";
    const sign = this.sign(method, options.md5 || "", type || "", date, filekey);
    const option = {
      hostname: `${this.bucket}.${this.endpoint}`,
      path: `/${filekey}`,
      method: method,
      headers: {
        Date: date,
        Authorization: sign,
        "Content-Type": type || ""
      },
      agent: this.agent,
    };
    return this.request(option, data, raw);
  }

  putObject(key: string, data: Buffer | Readable, options?: IPutOption) {
    return this.requestObject("PUT", key, data, false, options);
  }

  getObject(key: string) {
    return this.requestObject("GET", key, undefined, true);
  }

  deleteObject(key: string) {
    return this.requestObject("DELETE", key);
  }

  objectMeta(key: string) {
    return this.requestObject("HEAD", key + "?objectMeta");
  }

  headObject(key: string) {
    return this.requestObject("HEAD", key);
  }

  getSignUrl(key: string, ttl = 60) {
    const expires = parseInt(String(new Date().getTime() / 1000 + ttl), 10);
    const fielkey = this.getFileKey(key);
    const query = [
      `OSSAccessKeyId=${this.accessKeyId}`,
      `Signature=${this.signUrl(fielkey, expires)}`,
      `Expires=${expires}`
    ];
    return `${this.cdn}/${fielkey}?${query.join("&")}`;
  }
}
