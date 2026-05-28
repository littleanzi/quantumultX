/**
 * 海信爱家签到 - 请求回放版 (Quantumult X / Surge / Loon / Node)
 * 
 * 原理：通过重写规则抓取小程序发出的完整签到请求（含签名），
 *       定时任务回放该请求实现签到，无需自行计算签名。
 * 
 * 使用步骤：
 * 1. 添加 [MITM] hostname = mobile-aiot.hismarttv.com
 * 2. 添加重写规则：
 *    ^https:\/\/mobile-aiot\.hismarttv\.com\/AIoTPointsMall\/gw\/svc\/HiVip\/1\.0\/checkIn url script-request-header https://你的脚本地址/hisense_replay.js
 * 3. 打开海信爱家小程序，进入会员中心，点击签到按钮，QX 会弹出“🎉 签到请求已保存”通知
 * 4. 定时任务会在设定时间自动回放该请求
 * 
 * 密钥安全：本脚本不包含任何密钥，所有敏感数据存储在 QX 本地 / BoxJs 中
 */

const isQX = typeof $task !== 'undefined';
const isSurge = typeof $httpClient !== 'undefined' && !isQX;
const isNode = typeof require === 'function' && typeof module !== 'undefined';

// ========== 持久化存储读取 ==========
function readFromStore(key) {
  try {
    if (isQX) return $prefs.valueForKey(key);          // QX 推荐使用 $prefs
    if (isSurge) return $persistentStore.read(key);
    if (isNode) {
      const fs = require('fs');
      const p = require('path').join(__dirname, key + '.json');
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    }
  } catch (e) {
    console.error('readFromStore failed', e);
    return null;
  }
}

// ========== 持久化存储写入 ==========
function writeToStore(key, value) {
  try {
    if (isQX) return $prefs.setValueForKey(value, key);
    if (isSurge) return $persistentStore.write(value, key);
    if (isNode) {
      const fs = require('fs');
      const p = require('path').join(__dirname, key + '.json');
      fs.writeFileSync(p, value, 'utf8');
      return true;
    }
  } catch (e) {
    console.error('writeToStore failed', e);
    return false;
  }
}

// ========== BoxJs 远程读取 (可选) ==========
function getBoxJSValue(boxUrl, boxToken) {
  if (!boxUrl || !boxToken) return Promise.resolve(null);
  if (isQX) {
    return $task.fetch({ url: boxUrl + '/get?key=hisense_sign_data', headers: { 'Authorization': boxToken } })
      .then(r => r.body ? JSON.parse(r.body) : null);
  }
  if (isNode) {
    const fetch = require('node-fetch');
    return fetch(boxUrl + '/get?key=hisense_sign_data', { headers: { 'Authorization': boxToken } })
      .then(r => r.json()).catch(() => null);
  }
  return Promise.resolve(null);
}

// ========== 环境变量读取 (Node) ==========
function readEnv(key) {
  if (isNode && process.env) return process.env[key];
  if (typeof $environment !== 'undefined' && $environment)
    return $environment[key] || ($environment.value && $environment.value[key]) || null;
  if (typeof __ENV !== 'undefined' && __ENV) return __ENV[key] || null;
  return undefined;
}

// ========== 通用 HTTP 请求 ==========
function requestFetch(options) {
  const { url, method, headers, body } = options;
  if (isQX) return $task.fetch({ url, method, headers, body });
  if (isSurge) return new Promise((resolve, reject) => {
    $httpClient.post({ url, headers, body }, (err, resp, respBody) => {
      err ? reject(err) : resolve({ status: resp && resp.status, body: respBody });
    });
  });
  if (isNode) {
    const fetch = require('node-fetch');
    return fetch(url, { method, headers, body })
      .then(async res => ({ statusCode: res.status, body: await res.text() }));
  }
  return Promise.reject(new Error('unsupported'));
}

// ========== 重写：抓取签到请求 ==========
if (typeof $request !== 'undefined') {
  const url = $request.url;
  // 只抓取 checkIn 请求
  if (url.includes('/checkIn')) {
    const headers = $request.headers;
    const body = $request.body || '{}';
    const customerId = (url.match(/customerId=([^&]+)/) || [])[1] || '';

    const data = JSON.stringify({
      url: url,
      headers: headers,
      body: body,
      customerId: customerId,
      timestamp: Date.now()
    });

    writeToStore('hisense_sign_data', data);
    $notify('Hisense 签到', '抓取成功', '签到请求已保存，可用于定时回放');
  }
  $done({});
}

// ========== 定时签到（回放请求）==========
async function main() {
  // 1. 尝试从 BoxJs 读取
  const boxUrl = readEnv('HISENSE_BOXJS_URL');
  const boxToken = readEnv('HISENSE_BOXJS_TOKEN');
  let saved = null;
  if (boxUrl && boxToken) {
    try { saved = await getBoxJSValue(boxUrl, boxToken); } catch (e) { }
  }

  // 2. 从本地存储读取
  if (!saved) {
    const raw = readFromStore('hisense_sign_data');
    if (raw) {
      try { saved = JSON.parse(raw); } catch (e) { saved = null; }
    }
  }

  // 3. 无数据时提示
  if (!saved) {
    console.error('no saved sign data found');
    if (isQX) $notify('Hisense 签到', '失败', '未找到抓取的请求数据，请先按 README 配置 rewrite');
    return;
  }

  // 4. 构造请求
  const targetHost = saved.url || `https://mobile-aiot.hismarttv.com/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn?customerId=${saved.customerId}`;
  const reqBody = typeof saved.body === 'string' ? saved.body : JSON.stringify(saved.body);
  const reqHeaders = Object.assign(
    { 'Content-Type': 'application/json', Host: 'mobile-aiot.hismarttv.com' },
    saved.headers || {}
  );

  // 5. 发送请求
  const res = await requestFetch({ url: targetHost, method: 'POST', headers: reqHeaders, body: reqBody });
  let bodyText = res.body;
  try { bodyText = typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText); } catch (e) { }

  // 6. 判断结果并通知
  const success = bodyText && (bodyText.includes('SUCCESS') || bodyText.includes('"code":0') || bodyText.includes('"resultCode":0'));
  if (isQX) $notify('Hisense 签到', success ? '成功' : '失败', bodyText.slice(0, 300));
  if (isNode) console.log('签到返回', bodyText);
}

main().catch(e => {
  console.error(e);
  if (typeof $notify !== 'undefined') $notify('Hisense 签到', '运行异常', e.message);
});