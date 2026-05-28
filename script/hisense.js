/*
  Quantumult X scheduled sign script for Hisense
  - reads stored request headers/body saved by the capture script
  - replays the POST to the checkIn endpoint using stored headers/body
  - compatible with Quantumult X, Surge, Loon and Node
  - does NOT include any secret in the repo; reads from persistent store or BoxJS
*/

const isQX = typeof $task !== 'undefined';
const isSurge = typeof $httpClient !== 'undefined' && !isQX;
const isNode = typeof require === 'function' && typeof module !== 'undefined';

function readFromStore(key) {
  try {
    if (isQX) return $persistentStore.read(key);
    if (isSurge) return $persistentStore.read(key);
    if (isNode) {
      const fs = require('fs');
      const p = require('path').join(__dirname, key + '.json');
      return fs.existsSync(p) ? fs.readFileSync(p).toString() : null;
    }
  } catch (e) {
    console.error('readFromStore failed', e);
    return null;
  }
}

function getBoxJSValue(boxUrl, boxToken) {
  if (!boxUrl || !boxToken) return Promise.resolve(null);
  if (isQX) {
    return $task.fetch({ url: boxUrl + '/get?key=hisense_sign_data', headers: { 'Authorization': boxToken } }).then(r => r.body ? JSON.parse(r.body) : null);
  }
  if (isNode) {
    const fetch = require('node-fetch');
    return fetch(boxUrl + '/get?key=hisense_sign_data', { headers: { 'Authorization': boxToken } }).then(r => r.json()).catch(() => null);
  }
  return Promise.resolve(null);
}

function readEnv(key) {
  if (isNode && process.env) return process.env[key];
  if (typeof $environment !== 'undefined' && $environment) return $environment[key] || ($environment.value && $environment.value[key]) || null;
  if (typeof __ENV !== 'undefined' && __ENV) return __ENV[key] || null;
  return undefined;
}

function requestFetch(options) {
  const { url, method, headers, body } = options;
  if (isQX) return $task.fetch({ url, method, headers, body });
  if (isSurge) return new Promise((resolve, reject) => $httpClient.post({ url, headers, body }, (err, resp, respBody) => err ? reject(err) : resolve({ status: resp && resp.status, body: respBody })));
  if (isNode) {
    const fetch = require('node-fetch');
    return fetch(url, { method, headers, body }).then(async res => ({ statusCode: res.status, body: await res.text() }));
  }
  return Promise.reject(new Error('unsupported'));
}

async function main() {
  const boxUrl = readEnv('HISENSE_BOXJS_URL');
  const boxToken = readEnv('HISENSE_BOXJS_TOKEN');

  // try BoxJS first
  let saved = null;
  if (boxUrl && boxToken) {
    try {
      saved = await getBoxJSValue(boxUrl, boxToken);
    } catch (e) { saved = null; }
  }

  if (!saved) {
    const picked = readFromStore('hisense_sign_picked');
    const headers = readFromStore('hisense_sign_headers');
    const body = readFromStore('hisense_sign_body');
    if (picked) saved = JSON.parse(picked);
    else if (headers || body) saved = { headers: headers ? JSON.parse(headers) : {}, picked: body ? JSON.parse(body) : {} };
  }

  if (!saved) {
    console.error('no saved sign data found');
    if (isQX) $notify('Hisense 签到', '失败', '未找到抓取的请求数据，请先按 README 配置 rewrite');
    return;
  }

  // reconstruct request
  const targetHost = saved.picked && saved.picked.customerId ? `https://mobile-aiot.hismarttv.com/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn?customerId=${saved.picked.customerId}` : (readEnv('HISENSE_URL') || 'https://mobile-aiot.hismarttv.com/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn');
  const reqBody = saved.picked && saved.picked.rawBody ? (typeof saved.picked.rawBody === 'string' ? saved.picked.rawBody : JSON.stringify(saved.picked.rawBody)) : (saved.picked && saved.picked.rawBody ? JSON.stringify(saved.picked.rawBody) : (readFromStore('hisense_sign_body') || '{}'));
  const reqHeaders = (saved.headers && typeof saved.headers === 'object') ? saved.headers : (saved.headers ? JSON.parse(saved.headers) : {});

  // ensure minimal headers
  const headers = Object.assign({ 'Content-Type': 'application/json', Host: 'mobile-aiot.hismarttv.com' }, reqHeaders);

  const res = await requestFetch({ url: targetHost, method: 'POST', headers, body: typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody) });

  let bodyText = res.body || (res.body && typeof res.body === 'string' ? res.body : JSON.stringify(res));
  try { bodyText = typeof bodyText === 'string' ? bodyText : JSON.stringify(bodyText); } catch (e) {}

  const success = bodyText && (bodyText.includes('SUCCESS') || bodyText.includes('success') || bodyText.includes('"code":0'));
  if (isQX) $notify('Hisense 签到', success ? '成功' : '失败', bodyText.slice(0, 300));
  if (isNode) console.log('签到返回', bodyText);
}

main().catch(e => { console.error(e); if (typeof $notify !== 'undefined') $notify('Hisense 签到', '运行异常', e.message); });
