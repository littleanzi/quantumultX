// 2026-05-28 抓取参数: accessToken, customerId
// 算法: TC3-HMAC-SHA256 (腾讯云API 3.0签名)
// 密钥存储在 QX 数据 hisense_tc3_secret 中（格式 SecretId:SecretKey）

const $ = new Env('海信爱家');
const DATA_KEY = 'hisense_data';
const SECRET_KEY_KEY = 'hisense_tc3_secret';
const API = 'https://mobile-aiot.hismarttv.com';

// ==================== 加载 CryptoJS ====================
// 如果 QX 环境中没有 CryptoJS，则从 CDN 加载
if (typeof CryptoJS === 'undefined') {
    $.getScript('https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js');
}

function sha256(message) {
    return CryptoJS.SHA256(message).toString(CryptoJS.enc.Hex);
}

function hmacSha256(key, message) {
    return CryptoJS.HmacSHA256(message, key).toString(CryptoJS.enc.Hex);
}

function binaryHmacSha256(key, message) {
    return CryptoJS.HmacSHA256(message, key);
}

// ==================== TC3 签名生成（严格对齐源码） ====================
function generateAuthorization(body, timestamp, secretId, secretKey) {
    const host = 'mobile-aiot.hismarttv.com';
    const service = 'AIoTPointsMall';
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    // 规范请求（路径为 /，不包含 query）
    const canonicalHeaders = 'content-type:application/json\nhost:' + host + '\n';
    const signedHeaders = 'content-type;host';
    const payloadHash = sha256(body);
    const canonicalRequest = 'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

    // 待签字符串
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = date + '/' + service + '/tc3_request';
    const stringToSign = algorithm + '\n' + timestamp + '\n' + credentialScope + '\n' + sha256(canonicalRequest);

    // 派生密钥
    const kDate = binaryHmacSha256('TC3' + secretKey, date);
    const kService = binaryHmacSha256(kDate, service);
    const kSigning = binaryHmacSha256(kService, 'tc3_request');
    const signature = hmacSha256(kSigning, stringToSign);

    return algorithm + ' Credential=' + secretId + '/' + credentialScope +
        ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
}

// ==================== 抓取凭证 ====================
if (typeof $request !== 'undefined') {
    const url = $request.url;
    const accessToken = getParam(url, 'accessToken');
    const customerId = getParam(url, 'customerId');
    if (accessToken && customerId) {
        let saved = $.getdata(DATA_KEY) || '{}';
        let data = {};
        try { data = JSON.parse(saved); } catch (e) {}
        data[customerId] = {
            accessToken: accessToken.replace(/\s/g, ''),
            customerId: customerId
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 凭证已保存: ' + customerId);
    }
    $.done();
}

// ==================== 定时签到 ====================
(async () => {
    // 读取密钥
    const secretRaw = $.getdata(SECRET_KEY_KEY) || '';
    const [SECRET_ID, SECRET_KEY] = secretRaw ? secretRaw.split(':') : ['', ''];
    if (!SECRET_ID || !SECRET_KEY) {
        $.msg($.name, '❌ 未配置密钥', '请在 QX 数据中添加 hisense_tc3_secret，格式：SecretId:SecretKey');
        return $.done();
    }

    const raw = $.getdata(DATA_KEY) || '{}';
    if (raw === '{}') {
        $.msg($.name, '❌ 未配置', '请进入海信爱家会员中心抓取 accessToken');
        return $.done();
    }

    let accounts = {};
    try { accounts = JSON.parse(raw); } catch (e) {}
    const ids = Object.keys(accounts);
    if (ids.length === 0) { $.msg($.name, '❌ 无账号'); return $.done(); }

    let message = '';
    for (const cid of ids) {
        const acc = accounts[cid];
        const token = (acc.accessToken || '').replace(/\s/g, '');
        console.log('\n===== 账号 ' + cid + ' =====');
        try {
            const now = Date.now();
            const body = {
                reportToGroup: 1,
                accessToken: token,
                userType: "1",
                mobile: "J07v/v6YUgKR4pb95mGwTw==",
                deviceExt: "iPhone 11<iPhone12,1>",
                license: "1015",
                deviceId: "86100300000100100000ffffe0105019e07fcb0be548d9cbbc814f338",
                customerId: cid,
                returnCheckInStatus: false,
                userId: cid,
                requestId: "ailife_sign-" + now + "-" + Math.floor(Math.random() * 10000),
                requestTime: now.toString(),
                taskId: "204",
                appVersionName: "-1",
                _t: now,
                appVersionCode: "-1",
                appVersion: "m_p.16.000",
                appPackageName: "com.hisense.miniapp-aiot"
            };
            const bodyStr = JSON.stringify(body);
            const timestamp = Math.floor(now / 1000);
            const authorization = generateAuthorization(bodyStr, timestamp, SECRET_ID, SECRET_KEY);

            const res = await doPost('/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn?customerId=' + cid, bodyStr, authorization);
            console.log('签到响应: ' + JSON.stringify(res));

            let signMsg = '';
            if (res.resultCode === 0) signMsg = '✅ 签到成功';
            else if (res.errorDesc && res.errorDesc.includes('已签到')) signMsg = '⚠️ 今天已签到';
            else signMsg = '❌ 失败: ' + (res.errorDesc || JSON.stringify(res));

            const ptsTimestamp = Math.floor(Date.now() / 1000);
            const ptsAuth = generateAuthorization('', ptsTimestamp, SECRET_ID, SECRET_KEY);
            const ptsRes = await doGet(API + '/AIoTPointsMall/gw/svc/HiScore/1.0/userPoints', ptsAuth);
            const total = ptsRes.data?.totalScore ?? 0;

            message += '账号' + cid + ': ' + signMsg + '\n当前积分: ' + total + '\n\n';
            console.log('账号' + cid + ': ' + signMsg + ' 积分: ' + total);
        } catch (e) {
            message += '账号' + cid + ': 执行异常 ' + e.message + '\n\n';
            console.error(e);
        }
    }

    if (message) $.msg($.name, '', message);
    $.done();
})();

// ==================== 网络请求 ====================
function doPost(url, body, authorization) {
    return new Promise((resolve, reject) => {
        $.post({
            url: API + url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization,
                'Host': 'mobile-aiot.hismarttv.com'
            },
            body: body,
            timeout: 30000
        }, (err, resp, data) => {
            if (err) reject(err);
            else {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('解析失败: ' + data)); }
            }
        });
    });
}

function doGet(url, authorization) {
    return new Promise((resolve, reject) => {
        $.get({
            url: url,
            headers: {
                'Authorization': authorization,
                'Host': 'mobile-aiot.hismarttv.com'
            },
            timeout: 30000
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
    const getdata = key => {
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
    const post = (opt, cb) => {
        if (isQX) { opt.method = 'POST'; $task.fetch(opt).then(res => cb(null, res, res.body)).catch(e => cb(e)); }
        else $httpClient.post(opt, cb);
    };
    const get = (opt, cb) => {
        if (isQX) { opt.method = 'GET'; $task.fetch(opt).then(res => cb(null, res, res.body)).catch(e => cb(e)); }
        else $httpClient.get(opt, cb);
    };
    const done = (v) => { if (typeof $done !== 'undefined') $done(v); };
    return { name, getdata, setdata, msg, post, get, done };
}