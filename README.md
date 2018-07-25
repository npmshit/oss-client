# oss-client

阿里云 OSS 客户端

## Install

```javascript
const OSSClient = require("@blueshit/oss-client").default;

const client = new OSSClient({
  accessKeyId: "xxxxx",
  accessKeySecret: "xxxxxxx",
  bucket: "test",
  endpoint: "oss-cn-shenzhen.aliyuncs.com",
  prefix: "test/"
});

// 通过 Buffer 上传
const data = fs.readFileSync("icon.png");
client.putObject("icon.png", data)
  .then(console.log)
  .catch(console.log);

// 通过 Stream 上传
const stream = fs.createReadStream("icon.png");
client.putObject("icon.png", stream)
  .then(console.log)
  .catch(console.log);
```
