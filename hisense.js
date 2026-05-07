/**
 * 海信爱家签到 (最终安全版 - TC3 签名)
 * MITM: mobile-aiot.hismarttv.com
 * 重写: 抓取 checkIn 请求获取 customerId
 * 环境变量: hisense_customerId (多账号 @ 分隔)
 *           hisense_secret (格式: SecretId:SecretKey)
 */

const $ = new Env('海信爱家');
const CUSTOMER_KEY = 'hisense_customerId';
const SECRET_KEY = 'hisense_secret';  // 存储 SecretId:SecretKey
const API = 'https://mobile-aiot.hismarttv.com';

// ========== SHA-256 与 HMAC 完整实现 ==========
// [此处省略 SHA256 和 HMACSHA256 实现，与上一版完全相同，请直接复制]
// 为了简洁，这里只给出函数签名，实际代码必须包含完整的 SHA256/HMAC 实现
function SHA256(s) { /* ... 完整实现 ... */ }
function HMACSHA256(key, msg) { /* ... 完整实现 ... */ }
function stringToBytes(str) { /* ... */ }
function bytesToString(bytes) { /* ... */ }
function hexToBytes(hex) { /* ... */ }

// ========== 签名生成 ==========
function generateAuthorization(method, urlPath, query, body, timestamp, secretId, secretKey) {
    var host = 'mobile-aiot.hismarttv.com';
    var canonicalHeaders = 'content-type:application/json\nhost:' + host + '\n';
    var signedHeaders = 'content-type;host';
    var payloadHash = SHA256(body || '');
    var canonicalRequest = method + '\n' +
        urlPath + '\n' +
        query + '\n' +
        canonicalHeaders + '\n' +
        signedHeaders + '\n' +
        payloadHash;

    var algorithm = 'TC3-HMAC-SHA256';
    var date = new Date(timestamp).toISOString().substr(0, 10);
    var service = 'AIoTPointsMall';
    var credentialScope = date + '/' + service + '/tc3_request';
    var stringToSign = algorithm + '\n' +
        String(Math.floor(timestamp / 1000)) + '\n' +
        credentialScope + '\n' +
        SHA256(canonicalRequest);

    var kDate = HMACSHA256('TC3' + secretKey, date);
    var kService = HMACSHA256(hexToBytes(kDate).map(function(b){return String.fromCharCode(b);}).join(''), service);
    var kSigning = HMACSHA256(hexToBytes(kService).map(function(b){return String.fromCharCode(b);}).join(''), 'tc3_request');
    var signature = HMACSHA256(hexToBytes(kSigning).map(function(b){return String.fromCharCode(b);}).join(''), stringToSign);

    return algorithm + ' Credential=' + secretId + '/' + credentialScope +
        ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
}

// ========== 请求捕获模式 ==========
if (typeof $request !== 'undefined') {
    var customerId = getParam($request.url, 'customerId');
    if (customerId) {
        let saved = $.getdata(CUSTOMER_KEY) || '';
        let ids = saved ? saved.split('@') : [];
        if (!ids.includes(customerId)) {
            ids.push(customerId);
            $.setdata(ids.join('@'), CUSTOMER_KEY);
            $.msg($.name, '', '🎉 customerId 已保存：' + customerId);
        }
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const rawCustomers = $.getdata(CUSTOMER_KEY) || '';
    const rawSecret = $.getdata(SECRET_KEY) || '';
    
    if (!rawCustomers) { $.msg($.name, '❌ 未配置 customerId', '请先手动签到抓取'); $.done(); return; }
    if (!rawSecret) { $.msg($.name, '❌ 未配置密钥', '请将 SecretId:SecretKey 填入 hisense_secret'); $.done(); return; }

    const [secretId, secretKey] = rawSecret.split(':');
    if (!secretId || !secretKey) { $.msg($.name, '❌ 密钥格式错误', '应为 SecretId:SecretKey'); $.done(); return; }

    const ids = rawCustomers.split('@').filter(Boolean);
    let message = '';

    for (let i = 0; i < ids.length; i++) {
        const cid = ids[i].trim();
        console.log('\n===== 账号 ' + (i + 1) + ' (' + cid + ') =====');
        try {
            const path = '/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn';
            const query = 'customerId=' + cid;
            const url = API + path + '?' + query;
            const timestamp = Date.now();
            const authorization = generateAuthorization('GET', path, query, '', timestamp, secretId, secretKey);
            console.log('Authorization: ' + authorization);

            const signRes = await doGet(url, authorization);
            console.log('签到响应: ' + JSON.stringify(signRes));

            let signMsg = '';
            if (signRes.resultCode === 0) signMsg = '✅ 签到成功';
            else if (signRes.errorDesc && signRes.errorDesc.includes('已签到')) signMsg = '⚠️ 今天已签到';
            else signMsg = '❌ 失败: ' + (signRes.errorDesc || JSON.stringify(signRes));

            const ptsPath = '/AIoTPointsMall/gw/svc/HiScore/1.0/userPoints';
            const ptsAuth = generateAuthorization('GET', ptsPath, '', '', Date.now(), secretId, secretKey);
            const ptsRes = await doGet(API + ptsPath, ptsAuth);
            console.log('积分响应: ' + JSON.stringify(ptsRes));
            const total = ptsRes.data?.totalScore ?? 0;

            const accountMsg = '账号' + (i + 1) + ': ' + signMsg + '\n当前总积分: ' + total;
            message += accountMsg + '\n\n';
            console.log(accountMsg);
        } catch (e) {
            message += '账号' + (i + 1) + ': 执行异常 ' + e.message + '\n\n';
            console.error(e);
        }
    }

    if (message) $.msg($.name, '', message);
    $.done();
})();

function doGet(url, authorization) {
    return new Promise((resolve, reject) => {
        $.get({
            url: url,
            headers: {
                'Authorization': authorization,
                'Content-Type': 'application/json',
                'Host': 'mobile-aiot.hismarttv.com'
            }
        }, (err, resp, data) => {
            if (err) reject(err);
            else {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('解析失败: ' + data)); }
            }
        });
    });
}

function getParam(url, key) {
    var qs = url.split('?')[1] || '';
    return (new URLSearchParams(qs)).get(key) || '';
}

function Env(name) {
    const isQX = typeof $task !== 'undefined';
    const isSurge = typeof $httpClient !== 'undefined' && !isQX;
    const getdata = (key) => {
        if (isQX) return $prefs.valueForKey(key) || '';
        if (isSurge) return $persistentStore.read(key) || '';
        return '';
    };
    const setdata = (val, key) => {
        if (isQX) $prefs.setValueForKey(val, key);
        else if (isSurge) $persistentStore.write(val, key);
    };
    const msg = (t, s, m) => {
        if (isQX) $notify(t, s, m);
        else if (isSurge) $notification.post(t, s, m);
        console.log(t + '\n' + s + '\n' + m);
    };
    const get = (opt, cb) => {
        if (isQX) { opt.method = 'GET'; $task.fetch(opt).then(r => cb(null, r, r.body)).catch(e => cb(e)); }
        else $httpClient.get(opt, cb);
    };
    const done = (v) => { if (typeof $done !== 'undefined') $done(v); };
    return { name, getdata, setdata, msg, get, done };
}