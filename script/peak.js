/**
 * 匹克签到 (Peak) - 完整调试版
 * 接口: /mobile/activity/sign/querySignInfoList (或真实签到接口)
 * 签名算法: SHA1(请求体JSON + startTime + token前8字符)  可调整
 * MITM: scrmipg.peaksport.com
 * 重写: 抓取 querySignInfoList 获取 token / appid / 请求体
 * 定时: 0 8 * * *
 */

const $ = new Env('匹克签到');
const DATA_KEY = 'peak_data';
const API = 'https://scrmipg.peaksport.com';

// 如果你抓到了真正的签到接口路径，请修改这里
const SIGN_PATH = '/mobile/activity/sign/querySignInfoList';

// ==================== SHA1 ====================
function sha1(str) {
    function rotateLeft(n, s) { return (n << s) | (n >>> (32 - s)); }
    function cvtHex(val) {
        var s = '';
        for (var i = 7; i >= 0; i--) s += ((val >>> (i * 4)) & 0x0f).toString(16);
        return s;
    }
    var blockstart, i, j;
    var W = new Array(80);
    var H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;
    var msg = unescape(encodeURIComponent(str));
    var msgLen = msg.length;
    var wordArray = [];
    for (i = 0; i < msgLen - 3; i += 4) {
        j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 | msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
        wordArray.push(j);
    }
    switch (msgLen % 4) {
        case 0: j = 0x080000000; break;
        case 1: j = msg.charCodeAt(msgLen - 1) << 24 | 0x0800000; break;
        case 2: j = msg.charCodeAt(msgLen - 2) << 24 | msg.charCodeAt(msgLen - 1) << 16 | 0x08000; break;
        case 3: j = msg.charCodeAt(msgLen - 3) << 24 | msg.charCodeAt(msgLen - 2) << 16 | msg.charCodeAt(msgLen - 1) << 8 | 0x80; break;
    }
    wordArray.push(j);
    while ((wordArray.length % 16) != 14) wordArray.push(0);
    wordArray.push(msgLen >>> 29);
    wordArray.push((msgLen << 3) & 0xFFFFFFFF);
    for (blockstart = 0; blockstart < wordArray.length; blockstart += 16) {
        for (i = 0; i < 16; i++) W[i] = wordArray[blockstart + i];
        for (i = 16; i <= 79; i++) W[i] = rotateLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        var A = H0, B = H1, C = H2, D = H3, E = H4;
        for (i = 0; i <= 19; i++) {
            var temp = (rotateLeft(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0xFFFFFFFF;
            E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
        }
        for (i = 20; i <= 39; i++) {
            temp = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0xFFFFFFFF;
            E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
        }
        for (i = 40; i <= 59; i++) {
            temp = (rotateLeft(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0xFFFFFFFF;
            E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
        }
        for (i = 60; i <= 79; i++) {
            temp = (rotateLeft(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0xFFFFFFFF;
            E = D; D = C; C = rotateLeft(B, 30); B = A; A = temp;
        }
        H0 = (H0 + A) & 0xFFFFFFFF;
        H1 = (H1 + B) & 0xFFFFFFFF;
        H2 = (H2 + C) & 0xFFFFFFFF;
        H3 = (H3 + D) & 0xFFFFFFFF;
        H4 = (H4 + E) & 0xFFFFFFFF;
    }
    return (cvtHex(H0) + cvtHex(H1) + cvtHex(H2) + cvtHex(H3) + cvtHex(H4)).toLowerCase();
}

// ==================== 抓取 token/appid/请求体 ====================
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['token'] || '';
    const appid = headers['appid'] || 'wxb0c076d58ce4a1dd';
    const bodyStr = $request.body || '';
    if (token && bodyStr) {
        let saved = $.getdata(DATA_KEY) || '{}';
        let data = {};
        try { data = JSON.parse(saved); } catch (e) { data = {}; }
        data.token = token;
        data.appid = appid;
        data.bodyTemplate = bodyStr;
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 Token 和请求体已保存');
    }
    $.done();
}

// ==================== 定时签到 ====================
(async () => {
    const raw = $.getdata(DATA_KEY) || '{}';
    let data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }

    const token = data.token || '';
    const appid = data.appid || 'wxb0c076d58ce4a1dd';
    let bodyTemplate = data.bodyTemplate || '{"activityId":"d9e2bfd6-ee3b-42d2-b513-e70b5aaa37ad","source":"","shopId":"10000182"}';

    if (!token) {
        $.msg($.name, '❌ Token 缺失', '请重新进入匹克小程序抓取');
        $.done();
        return;
    }

    let body = {};
    try { body = JSON.parse(bodyTemplate); } catch (e) { body = {}; }

    // 补全必要字段，防止 null
    if (!body.activityId) body.activityId = 'd9e2bfd6-ee3b-42d2-b513-e70b5aaa37ad';
    if (body.source === undefined || body.source === null) body.source = '';
    if (!body.shopId) body.shopId = '10000182';

    const startTime = Date.now().toString();
    const signStr = JSON.stringify(body) + startTime + token.substring(0, 8);
    const sign = sha1(signStr);

    console.log('=== 签到请求详情 ===');
    console.log('URL: ' + API + SIGN_PATH);
    console.log('请求体: ' + JSON.stringify(body));
    console.log('startTime: ' + startTime);
    console.log('token 前8位: ' + token.substring(0, 8));
    console.log('签名字符串: ' + signStr);
    console.log('签名: ' + sign);

    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'ts': startTime,
        'startTime': startTime,
        'token': token,
        'sign': sign,
        'appid': appid,
        'X-TracedId': generateUUID(),
        'Referer': 'https://servicewechat.com/' + appid + '/243/page-frame.html',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.73',
        'Host': 'scrmipg.peaksport.com'
    };

    try {
        const res = await doPost(SIGN_PATH, body, headers);
        console.log('响应: ' + JSON.stringify(res));
        let msg = '';
        if (res.code === '0' || res.errcode === 0) msg = '✅ 签到成功';
        else if ((res.msg || '').includes('重复') || (res.msg || '').includes('已签')) msg = '⚠️ 今天已签到';
        else msg = '❌ 失败: ' + (res.msg || JSON.stringify(res));
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 网络异常', e.message);
    }
    $.done();
})();

// ==================== 工具函数 ====================
function doPost(path, body, headers) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = {
            url,
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            timeout: 30000
        };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => {
                try { resolve(JSON.parse(res.body)); } catch (e) { reject(new Error('解析失败')); }
            }).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err);
                else {
                    try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('解析失败')); }
                }
            });
        }
    });
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ==================== 环境适配 ====================
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
    const done = (v) => { if (typeof $done !== 'undefined') $done(v); };
    return { name, getdata, setdata, msg, done };
}