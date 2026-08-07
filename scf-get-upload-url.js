/**
 * SCF 函数：生成 COS 预签名上传 URL
 * 
 * 部署到腾讯云 SCF，通过 API 网关触发
 * 前端调用此函数获取一个 30 分钟有效期的 PUT 上传链接
 * 
 * 环境变量：
 *   SECRET_ID  - 子账号 SecretId
 *   SECRET_KEY - 子账号 SecretKey
 */

const crypto = require('crypto');

// ============ COS 配置 ============
const BUCKET = 'xuecheng-quiz-1464830022';
const REGION = 'ap-guangzhou';
const EXPIRE_SECONDS = 1800; // 30 分钟有效期

/**
 * 生成 COS 预签名 URL（无需外部 SDK）
 * 算法参考：腾讯云 COS XML API 签名文档
 */
function generatePresignedUrl(secretId, secretKey, key, expireSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const expired = now + expireSeconds;
  const keyTime = now + ';' + expired;

  // 1. SignKey = HMAC-SHA1(SecretKey, KeyTime)
  const signKey = crypto
    .createHmac('sha1', secretKey)
    .update(keyTime)
    .digest('hex');

  // 2. FormatString = HttpMethod\nUriPathname\nHttpParameters\nHttpHeaders\n
  const formatString = 'put\n/' + key + '\n\n\n';

  // 3. StringToSign = sha1\nKeyTime\nSHA1(FormatString)\n
  const formatStringHash = crypto
    .createHash('sha1')
    .update(formatString)
    .digest('hex');
  const stringToSign = 'sha1\n' + keyTime + '\n' + formatStringHash + '\n';

  // 4. Signature = HMAC-SHA1(SignKey, StringToSign)
  const signature = crypto
    .createHmac('sha1', signKey)
    .update(stringToSign)
    .digest('hex');

  // 5. 拼接预签名 URL
  const baseUrl = 'https://' + BUCKET + '.cos.' + REGION + '.myqcloud.com/' + key;
  const queryString =
    'q-sign-algorithm=sha1' +
    '&q-ak=' + secretId +
    '&q-sign-time=' + keyTime +
    '&q-key-time=' + keyTime +
    '&q-header-list=' +
    '&q-url-param-list=' +
    '&q-signature=' + signature;

  return baseUrl + '?' + queryString;
}

// ============ SCF 入口函数 ============
exports.main_handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // 处理 CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const secretId = process.env.SECRET_ID;
  const secretKey = process.env.SECRET_KEY;

  if (!secretId || !secretKey) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '服务器未配置 COS 密钥' })
    };
  }

  // 生成文件名：优先用前端传入的 name，否则自动生成
  let fileName;
  if (event.queryString && event.queryString.name) {
    fileName = event.queryString.name;
  } else {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    fileName = 'notes/' + ts + '-' + rand + '.jpg';
  }

  try {
    const url = generatePresignedUrl(secretId, secretKey, fileName, EXPIRE_SECONDS);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ url: url, key: fileName })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message })
    };
  }
};
