// 2026-05-12 抓取参数: token, appid

const $ = new Env('匹克签到');
const API = 'https://scrmipg.peaksport.com';

// ========== SHA1 实现 ==========
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

// ========== 签名生成 ==========
function generateSign(bodyObj, secretKey, ts) {
    const d = {};
    d.body = JSON.stringify(bodyObj);
    d.secretKey = secretKey;
    d.ts = ts;
    const pairs = [];
    for (let key in d) pairs.push(key + d[key]);
    pairs.sort();
    const signStr = pairs.join('');
    return sha1(signStr);
}

// ========== 抓取 token/appid ==========
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['token'] || '';
    const appid = headers['appid'] || 'wxb0c076d58ce4a1dd';
    if (token) {
        $.setdata(JSON.stringify({ token, appid }), 'peak_data');
        $.msg($.name, '', '🎉 凭证已保存');
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const raw = $.getdata('peak_data') || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请先进入匹克小程序抓取 token'); return $.done(); }
    let data = {};
    try { data = JSON.parse(raw); } catch (e) {}
    const token = data.token || '';
    const appid = data.appid || 'wxb0c076d58ce4a1dd';
    if (!token) { $.msg($.name, '❌ Token 缺失', '请重新抓取'); return $.done(); }

    const secretKey = 'R6WbJ830wNsEdjH9GumwKYiYxHz0K9QD';
    const today = new Date();
    const signDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    const body = {
        signDate: signDate,
        shopId: "10000182",
        activityId: "d9e2bfd6-ee3b-42d2-b513-e70b5aaa37ad"
    };
    const ts = Date.now().toString();
    const sign = generateSign(body, secretKey, ts);

    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'ts': ts,
        'startTime': ts,
        'token': token,
        'sign': sign,
        'appid': appid,
        'X-TracedId': generateUUID(),
        'Referer': 'https://servicewechat.com/' + appid + '/243/page-frame.html',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.73'
    };

    try {
        const res = await doPost('/mobile/activity/sign/sign', body, headers);
        console.log('签到响应: ' + JSON.stringify(res));
        let msg = '';
        if (res.success || res.code === '0') msg = '✅ 签到成功';
        else if ((res.msg || '').includes('重复') || (res.msg || '').includes('已签')) msg = '⚠️ 今天已签到';
        else msg = '❌ 失败: ' + (res.msg || JSON.stringify(res));
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 异常', e.message);
    }
    $.done();
})();

function doPost(path, body, headers) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = { url, method: 'POST', headers, body: JSON.stringify(body), timeout: 30000 };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => resolve(JSON.parse(res.body))).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err); else resolve(JSON.parse(data));
            });
        }
    });
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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
        console.log(t + '\n' + m);
    };
    const done = () => { if (typeof $done !== 'undefined') $done(); };
    return { name, getdata, setdata, msg, done };
}