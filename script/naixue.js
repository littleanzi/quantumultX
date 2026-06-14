/**
* 奈雪点单·签到脚本
* 2026-06-14 版本: 1.1.7
* 签名密钥 (HmacSHA1): sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA
* MITM 域名: tm-api.pin-dao.cn
* 重写规则 (Rewrite): ^https://tm-api\.pin-dao\.cn/passport/authenticate/wxapp/verify/grc url script-response-body naixue.js
* 算法: HmacSHA1签名
* [rewrite_local]
* https://tm-api.pin-dao.cn/passport/authenticate/wxapp/verify/grc url script-response-body naixue.js
* [task_local]
* 0 9 * * * naixue.js
* [MITM]
* hostname = tm-api.pin-dao.cn
*/

var $ = new Env('奈雪点单签到');
var isResponse = typeof $response !== "undefined";

// ====== 配置项 ======
var CONFIG = {
    baseUrl: 'https://tm-api.pin-dao.cn',
    signUrl: '/user/sign/save',
    signKey: 'sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA'
};

// ====== SHA1 ======
function SHA1(str) {
    var RotateLeft = function(n, s) { return (n << s) | (n >>> (32 - s)); };
    var Hex = function(n) { var s = "", v; for (var i = 7; i >= 0; i--) { v = (n >>> (i * 4)) & 0x0F; s += v.toString(16); } return s; };
    str = unescape(encodeURIComponent(str));
    var n = str.length, W = [], H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    var a = [];
    for (var i = 0; i < n; i++) a[i >> 2] |= str.charCodeAt(i) << (8 * (3 - (i % 4)));
    a[i >> 2] |= 0x80 << (8 * (3 - (i % 4)));
    if (i > 55) { a.push(0); a[i >> 2] |= n << 3; } else { a[(n >> 2) + 1] = n << 3; }
    for (var j = 0; j < a.length; j += 16) {
        for (var i = 0; i < 16; i++) W[i] = a[j + i] || 0;
        for (var i = 16; i < 80; i++) W[i] = RotateLeft(W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16], 1);
        var A = H[0], B = H[1], C = H[2], D = H[3], E = H[4];
        for (var i = 0; i < 80; i++) {
            var f, K;
            if (i < 20) { f = (B & C) | ((~B) & D); K = 0x5A827999; }
            else if (i < 40) { f = B ^ C ^ D; K = 0x6ED9EBA1; }
            else if (i < 60) { f = (B & C) | (B & D) | (C & D); K = 0x8F1BBCDC; }
            else { f = B ^ C ^ D; K = 0xCA62C1D6; }
            var T = (RotateLeft(A, 5) + f + E + K + W[i]) | 0;
            E = D; D = C; C = RotateLeft(B, 30); B = A; A = T;
        }
        H[0] = (H[0] + A) | 0; H[1] = (H[1] + B) | 0; H[2] = (H[2] + C) | 0; H[3] = (H[3] + D) | 0; H[4] = (H[4] + E) | 0;
    }
    return Hex(H[0]) + Hex(H[1]) + Hex(H[2]) + Hex(H[3]) + Hex(H[4]);
}

// ====== HMAC-SHA1 ======
function HmacSHA1(text, key) {
    if (key.length > 64) key = SHA1(key);
    var bKey = [], bText = [], bResult = [];
    for (var i = 0; i < 64; i++) bKey[i] = i < key.length ? key.charCodeAt(i) : 0;
    for (var i = 0; i < text.length; i++) bText[i] = text.charCodeAt(i);
    var ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { ipad[i] = bKey[i] ^ 0x36; opad[i] = bKey[i] ^ 0x5C; }
    var inner = SHA1(String.fromCharCode.apply(null, ipad) + text);
    var innerBytes = [];
    for (var i = 0; i < inner.length; i += 2) innerBytes.push(parseInt(inner.substr(i, 2), 16));
    var outer = SHA1(String.fromCharCode.apply(null, opad) + String.fromCharCode.apply(null, innerBytes));
    return outer;
}

// ====== Hex to Base64 ======
function hex2b64(hex) {
    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var s = "";
    for (var i = 0; i < hex.length; i += 2) {
        var c = parseInt(hex.substr(i, 2), 16);
        s += String.fromCharCode(c);
    }
    var result = "";
    for (var i = 0; i < s.length; i += 3) {
        var b1 = s.charCodeAt(i), b2 = i + 1 < s.length ? s.charCodeAt(i + 1) : 0, b3 = i + 2 < s.length ? s.charCodeAt(i + 2) : 0;
        result += b64.charAt(b1 >> 2);
        result += b64.charAt(((b1 & 3) << 4) | (b2 >> 4));
        result += (i + 1 < s.length) ? b64.charAt(((b2 & 15) << 2) | (b3 >> 6)) : '=';
        result += (i + 2 < s.length) ? b64.charAt(b3 & 63) : '=';
    }
    return result;
}

// ====== 签名算法 ======
function generateSignature(nonce, openId, timestamp) {
    var data = "nonce=" + nonce + "&openId=" + openId + "&timestamp=" + timestamp;
    var sign = HmacSHA1(data, CONFIG.signKey);
    return hex2b64(sign);
}

// ====== 请求体构建 ======
function buildRequestBody(signDate) {
    var nonce = Math.floor(Math.random() * 1000000);
    var openId = $.getdata('nayuki_openId');
    var timestamp = Math.floor(Date.now() / 1000);
    return {
        common: {
            platform: "wxapp", version: "1.0.0", imei: "", osn: "iPhone", sv: "iOS 15.0",
            lat: "", lng: "", lang: "zh-CN", currency: "CNY", timeZone: "",
            nonce: nonce, openId: openId, timestamp: timestamp, signature: generateSignature(nonce, openId, timestamp)
        },
        params: { signDate: signDate }
    };
}

// ====== 签到逻辑 ======
if (isResponse) {
    try {
        var result = JSON.parse($response.body);
        if (result.code === 0 && result.data) {
            if (result.data.openId) $.setdata(result.data.openId, 'nayuki_openId');
            if (result.data.accessToken) $.setdata(result.data.accessToken, 'nayuki_accessToken');
            $.notify('奈雪点单', '✅ 登录数据已抓取', 'openId: 已获取\naccessToken: 已获取');
        }
    } catch (e) {}
    $.done({});
} else {
    var openId = $.getdata('nayuki_openId');
    var accessToken = $.getdata('nayuki_accessToken');
    if (!openId || !accessToken) {
        $.notify('奈雪点单', '❌ 签到失败', '请先打开小程序触发签到以抓取数据');
        $.done({}); return;
    }
    var now = new Date();
    var signDate = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    $task.fetch({
        url: CONFIG.baseUrl + CONFIG.signUrl, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': accessToken },
        body: JSON.stringify(buildRequestBody(signDate))
    }).then(function(response) {
        try {
            var result = JSON.parse(response.body);
            $.msg($.name, result.code === 0 ? '✅ 签到成功' : '❌ 签到失败', result.code === 0 ? ('日期: ' + signDate) : (result.message || '未知错误'));
        } catch (e) { $.msg($.name, '❌ 签到失败', '响应解析失败'); }
        $.done({});
    }).catch(function(err) { $.msg($.name, '❌ 请求失败', err); $.done({}); });
}

// ====== Environment Class ======
function Env(name) {
    this.name = name;
    this.msg = function(a, b, c) { console.log(a + '\n' + b + '\n' + c); };
    this.notify = function(a, b, c) { $notify(a, b, c); };
    this.getdata = function(k) { return $prefs.valueForKey(k); };
    this.setdata = function(v, k) { $prefs.setValueForKey(v, k); };
    this.done = function() { $done({}); };
}