/**
* 奈雪点单·签到脚本
* 2026-06-14 版本: 1.1.8
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
    signKey: 'sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA',
    signOpenId: 'QL6ZOftGzbziPlZwfiXM'
};

// ====== SHA1 (operates on byte array) ======
function SHA1_bytes(bytes) {
    function rol(n, s) { return (n << s) | (n >>> (32 - s)); }
    var blen = bytes.length, words = [], H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    for (var i = 0; i < blen; i++) words[i >> 2] |= (bytes[i] & 0xFF) << (24 - (i % 4) * 8);
    words[i >> 2] |= 0x80 << (24 - (i % 4) * 8);
    var wlen = (((blen + 8) >> 6) + 1) * 16;
    for (var i = words.length; i < wlen; i++) words[i] = 0;
    var bitLen = blen * 8;
    words[wlen - 2] = Math.floor(bitLen / 0x100000000) || 0;
    words[wlen - 1] = (bitLen >>> 0);
    for (var block = 0; block < wlen; block += 16) {
        var W = [];
        for (var i = 0; i < 16; i++) W[i] = words[block + i];
        for (var i = 16; i < 80; i++) W[i] = rol(W[i-3] ^ W[i-8] ^ W[i-14] ^ W[i-16], 1);
        var A = H[0], B = H[1], C = H[2], D = H[3], E = H[4];
        for (var i = 0; i < 80; i++) {
            var f, k;
            if (i < 20) { f = (B & C) | ((~B) & D); k = 0x5A827999; }
            else if (i < 40) { f = B ^ C ^ D; k = 0x6ED9EBA1; }
            else if (i < 60) { f = (B & C) | (B & D) | (C & D); k = 0x8F1BBCDC; }
            else { f = B ^ C ^ D; k = 0xCA62C1D6; }
            var tmp = (rol(A, 5) + f + E + k + W[i]) | 0;
            E = D; D = C; C = rol(B, 30); B = A; A = tmp;
        }
        H[0] = (H[0] + A) | 0; H[1] = (H[1] + B) | 0; H[2] = (H[2] + C) | 0; H[3] = (H[3] + D) | 0; H[4] = (H[4] + E) | 0;
    }
    function Hex(n) { var s = ""; for (var i = 7; i >= 0; i--) { var v = (n >>> (i * 4)) & 0x0F; s += v.toString(16); } return s; }
    return Hex(H[0]) + Hex(H[1]) + Hex(H[2]) + Hex(H[3]) + Hex(H[4]);
}

// ====== string to byte array ======
function strToBytes(s) {
    var bytes = [];
    for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xFF);
    return bytes;
}

// ====== hex string to byte array ======
function hexToBytes(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    return bytes;
}

// ====== HMAC-SHA1 ======
function HmacSHA1(text, key) {
    var keyBytes = strToBytes(key);
    if (keyBytes.length > 64) {
        var hashed = SHA1_bytes(keyBytes);
        keyBytes = hexToBytes(hashed);
    }
    var paddedKey = [];
    for (var i = 0; i < 64; i++) paddedKey[i] = i < keyBytes.length ? keyBytes[i] : 0;
    var ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { ipad[i] = paddedKey[i] ^ 0x36; opad[i] = paddedKey[i] ^ 0x5C; }
    var textBytes = strToBytes(text);
    var innerInput = ipad.concat(textBytes);
    var innerHex = SHA1_bytes(innerInput);
    var innerBytes = hexToBytes(innerHex);
    var outerInput = opad.concat(innerBytes);
    return SHA1_bytes(outerInput);
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
    var openId = CONFIG.signOpenId;
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