/**
 * 匹克签到 (Peak) - 完整版
 * 签名算法: SHA1(请求体 + startTime + token前8字符)
 * MITM: scrmipg.peaksport.com
 * 重写: 抓取 querySignInfoList 获取 token/appid/请求体
 * 定时: 建议 0 8 * * *
 */
const $ = new Env('匹克签到');
const DATA_KEY = 'peak_data';
const API = 'https://scrmipg.peaksport.com';

// ========== SHA1 ==========
function sha1(str) {
    function rotateLeft(n, s) { return (n << s) | (n >>> (32 - s)); }
    function cvtHex(val) { var str = ''; for (var i = 7; i >= 0; i--) str += ((val >>> (i * 4)) & 0x0f).toString(16); return str; }
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

// ========== 抓取 token/appid/请求体 ==========
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['token'] || '';
    const appid = headers['appid'] || 'wxb0c076d58ce4a1dd';
    const bodyStr = $request.body || '';
    if (token) {
        $.setdata(JSON.stringify({ token, appid, bodyTemplate: bodyStr }), DATA_KEY);
        $.msg($.name, '', '🎉 Token 已保存');
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请进入匹克小程序触发抓取'); return $.done(); }
    const data = JSON.parse(raw);
    const token = data.token || '';
    const appid = data.appid || 'wxb0c076d58ce4a1dd';
    const bodyTemplate = data.bodyTemplate || '{"activityId":"d9e2bfd6-ee3b-42d2-b513-e70b5aaa37ad","source":"","shopId":"10000182"}';

    const ts = Date.now();
    const startTime = ts;
    const body = JSON.parse(bodyTemplate);
    
    // 签名 = SHA1(请求体JSON字符串 + startTime + token前8字符)
    const signStr = JSON.stringify(body) + startTime + token.substring(0, 8);
    const sign = sha1(signStr);

    try {
        const res = await doPost('/mobile/activity/sign/querySignInfoList', body, {
            'Content-Type': 'application/json;charset=UTF-8',
            'ts': ts.toString(),
            'startTime': startTime.toString(),
            'token': token,
            'sign': sign,
            'appid': appid,
            'X-TracedId': generateUUID()
        });
        console.log('签到响应: ' + JSON.stringify(res));
        let msg = '';
        if (res.errcode === 0 || res.code === '0') msg = '✅ 签到成功';
        else if (res.errmsg?.includes('重复') || res.errmsg?.includes('已签')) msg = '⚠️ 今天已签到';
        else msg = '❌ 失败: ' + (res.errmsg || JSON.stringify(res));
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
            $task.fetch(opts).then(res => {
                try { resolve(JSON.parse(res.body)); } catch (e) { reject(new Error('解析失败')); }
            }).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err);
                else { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }
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

// ========== Env ==========
function Env(name) {
    const isQX = typeof $task !== 'undefined';
    const isSurge = typeof $httpClient !== 'undefined' && !isQX;
    const getdata = key => isQX ? $prefs.valueForKey(key) || '' : (isSurge ? $persistentStore.read(key) || '' : '');
    const setdata = (val, key) => { if (isQX) $prefs.setValueForKey(val, key); else if (isSurge) $persistentStore.write(val, key); };
    const msg = (t, s, m) => { if (isQX) $notify(t, s, m); else if (isSurge) $notification.post(t, s, m); console.log(t + '\n' + m); };
    const done = () => { if (typeof $done !== 'undefined') $done(); };
    return { name, getdata, setdata, msg, done };
}