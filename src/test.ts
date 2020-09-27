import OSSClient from "./index";
import http from "http";

const client = new OSSClient({
  accessKeyId: process.env.TEST_OSS_ID!,
  accessKeySecret: process.env.TEST_OSS_KEY!,
  bucket: process.env.TEST_OSS_BUCKET!,
  endpoint: process.env.TEST_OSS_ENDPOINT!,
  prefix: process.env.TEST_OSS_PREFEX!,
});

const clientWithAgent = new OSSClient({
  accessKeyId: process.env.TEST_OSS_ID!,
  accessKeySecret: process.env.TEST_OSS_KEY!,
  bucket: process.env.TEST_OSS_BUCKET!,
  endpoint: process.env.TEST_OSS_ENDPOINT!,
  prefix: process.env.TEST_OSS_PREFEX!,
  agent: new http.Agent({ keepAlive: true, keepAliveMsecs: 10000 }),
});

const TEST_KEY = "OSSClient.data";
const TEST_DATA = Date.now() + "";
const TEST_URL = "http://mat1.gtimg.com/pingjs/ext2020/qqindex2018/dist/img/qq_logo_2x.png";

function getFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    return http.get(url, res => {
      const buffers: any[] = [];
      res.on("data", chunk => buffers.push(chunk));
      res.on("end", () => resolve(Buffer.concat(buffers)));
      res.on("error", err => reject(err));
    });
  });
}

describe("OSSClient", function() {
  const SHARE: any = {};

  beforeAll(async () => {
    await client.deleteObject(TEST_KEY);
  });

  test("putObject", async () => {
    const ret = await client.putObject(TEST_KEY, Buffer.from(TEST_DATA));
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toBeDefined();
    expect(ret.headers["x-oss-hash-crc64ecma"]).toBeDefined();
    expect(ret.headers["content-md5"]).toBeDefined();
    SHARE.headers = ret.headers;
    SHARE.md5 = ret.headers["content-md5"];
  });

  test("objectMeta", async () => {
    const ret = await client.objectMeta(TEST_KEY);
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toEqual(SHARE.headers.etag);
    expect(ret.headers["x-oss-hash-crc64ecma"]).toEqual(SHARE.headers["x-oss-hash-crc64ecma"]);
    SHARE.headers = ret.headers;
  });

  test("objectMeta With Agent", async () => {
    const ret = await clientWithAgent.objectMeta(TEST_KEY);
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toEqual(SHARE.headers.etag);
    expect(ret.headers["x-oss-hash-crc64ecma"]).toEqual(SHARE.headers["x-oss-hash-crc64ecma"]);
    SHARE.headers = ret.headers;
  });

  test("headObject", async () => {
    const ret = await client.headObject(TEST_KEY);
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toEqual(SHARE.headers.etag);
    expect(ret.headers["last-modified"]).toEqual(SHARE.headers["last-modified"]);
    expect(ret.headers["x-oss-hash-crc64ecma"]).toEqual(SHARE.headers["x-oss-hash-crc64ecma"]);
    expect(ret.headers["content-md5"]).toEqual(SHARE.md5);
    SHARE.headers = ret.headers;
  });

  test("getObject", async () => {
    const ret = await client.getObject(TEST_KEY);
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toEqual(SHARE.headers.etag);
    expect(ret.headers["last-modified"]).toEqual(SHARE.headers["last-modified"]);
    expect(ret.headers["x-oss-hash-crc64ecma"]).toEqual(SHARE.headers["x-oss-hash-crc64ecma"]);
    expect(ret.headers["content-md5"]).toEqual(SHARE.md5);
    expect(ret.buffer!.toString()).toEqual(TEST_DATA);
  });

  test("getObject With Agent", async () => {
    const ret = await clientWithAgent.getObject(TEST_KEY);
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toEqual(SHARE.headers.etag);
    expect(ret.headers["last-modified"]).toEqual(SHARE.headers["last-modified"]);
    expect(ret.headers["x-oss-hash-crc64ecma"]).toEqual(SHARE.headers["x-oss-hash-crc64ecma"]);
    expect(ret.headers["content-md5"]).toEqual(SHARE.md5);
    expect(ret.buffer!.toString()).toEqual(TEST_DATA);
  });

  test("getSignUrl", async () => {
    const url = client.getSignUrl(TEST_KEY);
    const ret = await getFile(url);
    expect(ret.toString()).toEqual(TEST_DATA);
  });

  test("deleteObject", async () => {
    const ret = await client.deleteObject(TEST_KEY);
    expect(ret.code).toBe(204);
    const ret2 = await client.headObject(TEST_KEY);
    expect(ret2.code).toBe(404);
  });

  test("putObjectWithUrl", async () => {
    const url = await client.putObjectWithUrl(TEST_KEY, TEST_URL);
    const org = await getFile(url);
    const dis = await getFile(TEST_URL);
    expect(dis).toEqual(org);
  });
});

describe("fix", function() {
  test("fix: get key with multi-///", () => {
    (client as any).prefix = undefined;
    const key = (client as any).getFileKey("//aa/a");
    expect(key).toEqual("aa/a");
    (client as any).prefix = process.env.TEST_OSS_PREFEX;
  });

  test("fix: key with space", async () => {
    const KEY = "OSS Client.data";
    const ret = await client.putObject(KEY, Buffer.from(TEST_DATA));
    expect(ret.code).toBe(200);
    expect(ret.headers.etag).toBeDefined();
    expect(ret.headers["x-oss-hash-crc64ecma"]).toBeDefined();
    expect(ret.headers["content-md5"]).toBeDefined();
    const ret2 = await client.deleteObject(KEY);
    expect(ret2.code).toBe(204);
    const ret3 = await client.headObject(KEY);
    expect(ret3.code).toBe(404);
  });
});
