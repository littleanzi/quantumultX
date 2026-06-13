/**
* 奈雪点单·签到脚本
* 2026-06-14 版本: 1.1.6
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

// ====== SHA1（参考erke.js可靠实现）======
function SHA1(msg) {
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
    function f(t, b, c, d) { if (t <= 19) return (b & c) | ((~b) & d); if (t <= 39) return (b ^ c ^ d); if (t <= 59) return (b & c) | (b & d) | (c & d); return (b ^ c ^ d); }
    function K(t) { if (t <= 19) return 0x5A827999; if (t <= 39) return 0x6ED9EBA1; if (t <= 59) return 0x8F1BBCDC; return 0xCA62C1D6; }
    function Hex(t) { var s = ""; for (var i = 7; i >= 0; i--) s += ((t >>> (i * 4)) & 0x0F).toString(16); return s; }
    function ConvertToWordArray(string) {
        var lWordCount, lMessageLength = string.length, lNumberOfWords_temp1 = lMessageLength + 8;
        var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16, lWordArray = [], lBytePosition = 0, lByteCount = 0;
        while (lByteCount < lMessageLength) { lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8; lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)); lByteCount++; }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4; lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3; lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
    }
    function Utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n"); var utftext = "";
        for (var n = 0; n < string.length; n++) {
            var c = string.charCodeAt(n);
            if (c < 128) utftext += String.fromCharCode(c);
            else if ((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); }
            else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); }
        }
        return utftext;
    }
    msg = Utf8Encode(msg);
    var W = [], H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0, A, B, C, D, E, T;
    var x = ConvertToWordArray(msg);
    for (var k = 0; k < x.length; k += 16) {
        for (var i = 0; i < 16; i++) W[i] = x[k + i];
        for (i = 16; i <= 79; i++) W[i] = RotateLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        A = H0; B = H1; C = H2; D = H3; E = H4;
        for (i = 0; i <= 19; i++) { T = AddUnsigned(AddUnsigned(AddUnsigned(AddUnsigned(RotateLeft(A, 5), f(i, B, C, D)), E), W[i]), K(i)); E = D; D = C; C = RotateLeft(B, 30); B = A; A = T; }
        for (i = 20; i <= 39; i++) { T = AddUnsigned(AddUnsigned(AddUnsigned(AddUnsigned(RotateLeft(A, 5), f(i, B, C, D)), E), W[i]), K(i)); E = D; D = C; C = RotateLeft(B, 30); B = A; A = T; }
        for (i = 40; i <= 59; i++) { T = AddUnsigned(AddUnsigned(AddUnsigned(AddUnsigned(RotateLeft(A, 5), f(i, B, C, D)), E), W[i]), K(i)); E = D; D = C; C = RotateLeft(B, 30); B = A; A = T; }
        for (i = 60; i <= 79; i++) { T = AddUnsigned(AddUnsigned(AddUnsigned(AddUnsigned(RotateLeft(A, 5), f(i, B, C, D)), E), W[i]), K(i)); E = D; D = C; C = RotateLeft(B, 30); B = A; A = T; }
        H0 = AddUnsigned(H0, A); H1 = AddUnsigned(H1, B); H2 = AddUnsigned(H2, C); H3 = AddUnsigned(H3, D); H4 = AddUnsigned(H4, E);
    }
    return Hex(H0) + Hex(H1) + Hex(H2) + Hex(H3) + Hex(H4);
}

// ====== HmacSHA1 ======
function HmacSHA1(message, key) {
    var bs = 64;
    if (key.length > bs) key = SHA1(key);
    var k = [], ipad = [], opad = [];
    for (var i = 0; i < bs; i++) { k[i] = i < key.length ? key.charCodeAt(i) : 0; ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5C; }
    var inner = SHA1(String.fromCharCode.apply(null, ipad) + message);
    var iHashBytes = [];
    for (var i = 0; i < inner.length; i += 2) { iHashBytes.push(parseInt(inner.substr(i, 2), 16)); }
    return SHA1(String.fromCharCode.apply(null, opad) + String.fromCharCode.apply(null, iHashBytes));
}

// ====== Hex转Base64 ======
function hexToBase64(hex) {
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) { bytes.push(parseInt(hex.substr(i, 2), 16)); }
    var output = "";
    for (var i = 0; i < bytes.length; i += 3) {
        var chr1 = bytes[i], chr2 = i + 1 < bytes.length ? bytes[i + 1] : 0, chr3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        var enc1 = chr1 >> 2, enc2 = ((chr1 & 3) << 4) | (chr2 >> 4), enc3 = ((chr2 & 15) << 2) | (chr3 >> 6), enc4 = chr3 & 63;
        if (i + 1 >= bytes.length) { enc3 = 64; enc4 = 64; }
        else if (i + 2 >= bytes.length) { enc4 = 64; }
        output += _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + (enc3 == 64 ? '=' : _keyStr.charAt(enc3)) + (enc4 == 64 ? '=' : _keyStr.charAt(enc4));
    }
    return output;
}

// ====== 签名算法 ======
function generateSignature(nonce, openId, timestamp) {
    var data = "nonce=" + nonce + "&openId=" + openId + "&timestamp=" + timestamp;
    return hexToBase64(HmacSHA1(data, CONFIG.signKey));
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