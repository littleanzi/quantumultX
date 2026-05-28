/**
 * 海信爱家 全自动签到 (Quantumult X) + 积分查询
 * 签名算法: Base64(MD5(请求体 JSON + 密钥))
 * 密钥: hisense_sign_key = "MORZRbkuiWxjp+SM4vR_GxY4pZxLZ6rn" (存储在BoxJs或QX数据中)
 * 用户数据: hisense_data (自动抓取 accessToken 和 customerId)
 * MITM: mobile-aiot.hismarttv.com
 * 重写: 抓取 getCustomerProfile 获取凭证
 */

const $ = new Env('海信爱家');
const DATA_KEY = 'hisense_data';
const SIGN_KEY_KEY = 'hisense_sign_key';
const API = 'https://mobile-aiot.hismarttv.com';

// ==================== MD5 返回 16 字节数组 ====================
function md5Binary(string) {
    function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
    function AddUnsigned(lX, lY) {
        var lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
        if (lX4 | lY4) { if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8; else return lResult ^ 0x40000000 ^ lX8 ^ lY8; }
        else return lResult ^ lX8 ^ lY8;
    }
    function F(x, y, z) { return (x & y) | ((~x) & z); }
    function G(x, y, z) { return (x & z) | (y & (~z)); }
    function H(x, y, z) { return (x ^ y ^ z); }
    function I(x, y, z) { return (y ^ (x | (~z))); }
    function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b); }
    function ConvertToWordArray(string) {
        var lMessageLength = string.length;
        var lNumberOfWords_temp1 = lMessageLength + 8;
        var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        var lWordArray = Array(lNumberOfWords - 1);
        var lBytePosition = 0, lByteCount = 0;
        while (lByteCount < lMessageLength) {
            var lWordCount = (lByteCount - (lByteCount % 4)) / 4;
            lBytePosition = (lByteCount % 4) * 8;
            lWordArray[lWordCount] |= (string.charCodeAt(lByteCount) << lBytePosition);
            lByteCount++;
        }
        var lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lWordArray[lWordCount] |= 0x80 << ((lByteCount % 4) * 8);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function Utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) utftext += String.fromCharCode(c);
            else if ((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); }
            else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); }
        }
        return utftext;
    }
    var x = ConvertToWordArray(Utf8Encode(string));
    var a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
    var k, AA, BB, CC, DD;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = AddUnsigned(a, AA); b = AddUnsigned(b, BB); c = AddUnsigned(c, CC); d = AddUnsigned(d, DD);
    }
    var bytes = [];
    [a, b, c, d].forEach(function (word) {
        bytes.push((word >> 0) & 0xFF); bytes.push((word >> 8) & 0xFF);
        bytes.push((word >> 16) & 0xFF); bytes.push((word >> 24) & 0xFF);
    });
    return bytes;
}

// ==================== Base64 编码字节数组 ====================
function base64FromBytes(bytes) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    var i = 0;
    while (i < bytes.length) {
        var chr1 = bytes[i++], chr2 = i < bytes.length ? bytes[i++] : NaN, chr3 = i < bytes.length ? bytes[i++] : NaN;
        var enc1 = chr1 >> 2, enc2 = ((chr1 & 3) << 4) | (chr2 >> 4), enc3 = ((chr2 & 15) << 2) | (chr3 >> 6), enc4 = chr3 & 63;
        if (isNaN(chr2)) { enc3 = enc4 = 64; } else if (isNaN(chr3)) { enc4 = 64; }
        output += chars.charAt(enc1) + chars.charAt(enc2) + chars.charAt(enc3) + chars.charAt(enc4);
    }
    return output;
}

// ==================== 签名生成 ====================
function generateSign(body, secret) {
    var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    var toSign = bodyStr + secret;
    var md5Bytes = md5Binary(toSign);
    return base64FromBytes(md5Bytes);
}

// ==================== 重写：抓取 accessToken 和 customerId ====================
if (typeof $request !== 'undefined') {
    const url = $request.url;
    const accessToken = getParam(url, 'accessToken');
    const customerId = getParam(url, 'customerId');
    if (accessToken && customerId) {
        let saved = $.getdata(DATA_KEY) || '{}';
        let data = {};
        try { data = JSON.parse(saved); } catch (e) { }
        data[customerId] = {
            accessToken: accessToken.replace(/\s/g, ''),
            customerId: customerId
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 账号已保存: ' + customerId);
    }
    $.done();
}

// ==================== 积分查询函数 ====================
async function getPoints(customerId, accessToken, signKey) {
    const body = {
        mobile: "J07v/v6YUgKR4pb95mGwTw==",
        accessToken: accessToken,
        customerId: customerId,
        appType: "105",
        _t: Date.now()
    };
    const sign = generateSign(body, signKey);
    try {
        const res = await doPost('/AIoTPointsMall/gw/svc/HiScore/1.0/userPoints', body, sign);
        console.log('积分查询响应: ' + JSON.stringify(res));
        if (res.resultCode === 0 && res.data && res.data.totalScore !== undefined) {
            return res.data.totalScore;
        }
        if (res.errorDesc) {
            console.log('积分查询错误: ' + res.errorDesc);
        }
        return 0;
    } catch (e) {
        console.log('积分查询失败: ' + e.message);
        return 0;
    }
}
// ==================== 定时签到 ====================
(async () => {
    const rawData = $.getdata(DATA_KEY) || '{}';
    const signKey = $.getdata(SIGN_KEY_KEY) || 'MORZRbkuiWxjp+SM4vR_GxY4pZxLZ6rn';

    let accounts = {};
    try { accounts = JSON.parse(rawData); } catch (e) { }

    if (Object.keys(accounts).length === 0) {
        $.msg($.name, '❌ 未配置数据', '请进入海信爱家会员中心抓取 accessToken');
        $.done();
        return;
    }

    let message = '';
    for (const cid of Object.keys(accounts)) {
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
                taskId: "202",
                appVersionName: "-1",
                t: now,
                appVersionCode: "-1",
                appVersion: "m_p.16.000",
                appPackageName: "com.hisense.miniapp-aiot"
            };

            const sign = generateSign(body, signKey);
            console.log('签名: ' + sign);

            const res = await doPost(
                '/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn?customerId=' + cid,
                body,
                sign
            );
            console.log('签到响应: ' + JSON.stringify(res));

            // 判断签到结果
            let signMsg = '';
            if (res.resultCode === 0) {
                signMsg = '✅ 签到成功';
            } else if (res.message && res.message.includes('已经签到')) {
                signMsg = '⚠️ 今天已签到';
            } else {
                signMsg = '❌ 失败: ' + (res.message || JSON.stringify(res));
            }

            // 查询积分
            const totalPoints = await getPoints(cid, token, signKey);
            signMsg += ` | 积分: ${totalPoints}`;

            message += '账号' + cid + ': ' + signMsg + '\n';
        } catch (e) {
            message += '账号' + cid + ': 异常 ' + e.message + '\n';
            console.error(e);
        }
    }

    if (message) $.msg($.name, '', message);
    $.done();
})();

// ==================== 工具函数 ====================
function doPost(path, body, sign) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Sign-For': sign,
                'appKey': 'commonweb'
            },
            body: JSON.stringify(body),
            timeout: 30000
        };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => {
                try { resolve(JSON.parse(res.body)); } catch (e) { reject(new Error('解析失败')); }
            }).catch(err => reject(err));
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err);
                else { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }
            });
        }
    });
}

function getParam(url, key) {
    var qs = url.split('?')[1] || '';
    return (new URLSearchParams(qs)).get(key) || '';
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