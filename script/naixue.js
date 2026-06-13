/**
* 奈雪点单·签到脚本
* 2026-06-14 版本: 1.1.3
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

const $ = new Env('奈雪点单签到');
const isResponse = typeof $response !== "undefined";

// ====== 配置项 ======
const CONFIG = {
    baseUrl: 'https://tm-api.pin-dao.cn',
    signUrl: '/user/sign/save',
    signKey: 'sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA'
};

// ====== SHA1 实现 ======
function sha1(msg) {
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
    function f(t, b, c, d) { if (0 <= t && t <= 19) return (b & c) | ((~b) & d); if (20 <= t && t <= 39) return (b ^ c ^ d); if (40 <= t && t <= 59) return (b & c) | (b & d) | (c & d); if (60 <= t && t <= 79) return (b ^ c ^ d); }
    function K(t) { if (0 <= t && t <= 19) return 0x5A827999; if (20 <= t && t <= 39) return 0x6ED9EBA1; if (40 <= t && t <= 59) return 0x8F1BBCDC; if (60 <= t && t <= 79) return 0xCA62C1D6; }
    function Hex(t) { var s = "", v; for (var i = 7; i >= 0; i--) { v = (t >>> (i * 4)) & 0x0F; s += v.toString(16); } return s; }
    var W = new Array(80);
    var H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;
    var A, B, C, D, E, T;
    var x = [];
    msg =unescape(encodeURIComponent(msg));
    var len = msg.length;
    var word_count = (((len + 8) >> 6) + 1) * 16;
    for (var i = 0; i < word_count; i++) x[i] = 0;
    for (i = 0; i < len; i++) x[i >> 2] |= (msg.charCodeAt(i) & 0xFF) << (8 * (3 - (i % 4)));
    x[i >> 2] |= 0x80 << (8 * (3 - (i % 4)));
    x[word_count - 2] = len << 3;
    for (var blockstart = 0; blockstart < word_count; blockstart += 16) {
        for (i = 0; i < 16; i++) W[i] = x[blockstart + i];
        for (i = 16; i <= 79; i++) W[i] = RotateLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        A = H0; B = H1; C = H2; D = H3; E = H4;
        for (i = 0; i <= 79; i++) {
            T = AddUnsigned(AddUnsigned(AddUnsigned(AddUnsigned(RotateLeft(A, 5), f(i, B, C, D)), E), W[i]), K(i));
            E = D; D = C; C = RotateLeft(B, 30); B = A; A = T;
        }
        H0 = AddUnsigned(H0, A); H1 = AddUnsigned(H1, B); H2 = AddUnsigned(H2, C); H3 = AddUnsigned(H3, D); H4 = AddUnsigned(H4, E);
    }
    return Hex(H0) + Hex(H1) + Hex(H2) + Hex(H3) + Hex(H4);
}

// ====== HmacSHA1 实现 ======
function hmac_sha1(msg, key) {
    function sha1(msg) {
        function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)); }
        function AddUnsigned(lX, lY) {
            var lX8 = (lX & 0x80000000), lY8 = (lY & 0x80000000), lX4 = (lX & 0x40000000), lY4 = (lY & 0x40000000), lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
            if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
            if (lX4 | lY4) { if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8; else return lResult ^ 0x40000000 ^ lX8 ^ lY8; }
            else return lResult ^ lX8 ^ lY8;
        }
        function f(t, b, c, d) { if (t <= 19) return (b & c) | ((~b) & d); if (t <= 39) return (b ^ c ^ d); if (t <= 59) return (b & c) | (b & d) | (c & d); return (b ^ c ^ d); }
        function K(t) { if (t <= 19) return 0x5A827999; if (t <= 39) return 0x6ED9EBA1; if (t <= 59) return 0x8F1BBCDC; return 0xCA62C1D6; }
        function Hex(t) { var s = ""; for (var i = 7; i >= 0; i--) s += ((t >>> (i * 4)) & 0x0F).toString(16); return s; }
        var W = new Array(80), H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0, A, B, C, D, E, T, x = [];
        msg = unescape(encodeURIComponent(msg)); var len = msg.length, wc = (((len + 8) >> 6) + 1) * 16;
        for (var i = 0; i < wc; i++) x[i] = 0;
        for (i = 0; i < len; i++) x[i >> 2] |= (msg.charCodeAt(i) & 0xFF) << (8 * (3 - (i % 4)));
        x[i >> 2] |= 0x80 << (8 * (3 - (i % 4))); x[wc - 2] = len << 3;
        for (var bs = 0; bs < wc; bs += 16) {
            for (i = 0; i < 16; i++) W[i] = x[bs + i];
            for (i = 16; i <= 79; i++) W[i] = RotateLeft(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
            A = H0; B = H1; C = H2; D = H3; E = H4;
            for (i = 0; i <= 79; i++) { T = AddUnsigned(AddUnsigned(AddUnsigned(AddUnsigned(RotateLeft(A, 5), f(i, B, C, D)), E), W[i]), K(i)); E = D; D = C; C = RotateLeft(B, 30); B = A; A = T; }
            H0 = AddUnsigned(H0, A); H1 = AddUnsigned(H1, B); H2 = AddUnsigned(H2, C); H3 = AddUnsigned(H3, D); H4 = AddUnsigned(H4, E);
        }
        return Hex(H0) + Hex(H1) + Hex(H2) + Hex(H3) + Hex(H4);
    }
    if (key.length > 64) key = sha1(key);
    var k = [], ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { k[i] = i < key.length ? key.charCodeAt(i) : 0; ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5C; }
    var inner = sha1(String.fromCharCode.apply(null, ipad) + msg);
    return sha1(String.fromCharCode.apply(null, opad) + String.fromCharCode.apply(null, inner.match(/.{2}/g).map(function(h){return parseInt(h,16)})));
}

// ====== Base64 ======
function hexToBytes(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    return bytes;
}

function bytesToBase64(bytes) {
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    while (i < bytes.length) {
        chr1 = bytes[i++]; chr2 = i < bytes.length ? bytes[i++] : 0; chr3 = i < bytes.length ? bytes[i++] : 0;
        enc1 = chr1 >> 2; enc2 = ((chr1 & 3) << 4) | (chr2 >> 4); enc3 = ((chr2 & 15) << 2) | (chr3 >> 6); enc4 = chr3 & 63;
        if (i - 1 > bytes.length) { enc3 = enc4 = 64; } else if (i - 2 > bytes.length) { enc4 = 64; }
        output += _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4);
    }
    return output;
}

// ====== 签名算法 ======
function generateSignature(nonce, openId, timestamp) {
    var data = "nonce=" + nonce + "&openId=" + openId + "&timestamp=" + timestamp;
    var hmacHex = HmacSHA1(data, CONFIG.signKey);
    return bytesToBase64(hexToBytes(hmacHex));
}

// ====== 请求体构建 ======
function buildRequestBody(signDate) {
    const nonce = Math.floor(Math.random() * 1000000);
    const openId = $.getdata('nayuki_openId');
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateSignature(nonce, openId, timestamp);
    
    return {
        common: {
            platform: "wxapp",
            version: "1.0.0",
            imei: "",
            osn: "iPhone",
            sv: "iOS 15.0",
            lat: "",
            lng: "",
            lang: "zh-CN",
            currency: "CNY",
            timeZone: "",
            nonce: nonce,
            openId: openId,
            timestamp: timestamp,
            signature: signature
        },
        params: {
            signDate: signDate
        }
    };
}

// ====== 签到逻辑 ======
if (isResponse) {
    // 拦截登录响应：从响应中抓取数据
    try {
        const result = JSON.parse($response.body);
        if (result.code === 0 && result.data) {
            const { accessToken, openId } = result.data;
            if (openId) $.setdata(openId, 'nayuki_openId');
            if (accessToken) $.setdata(accessToken, 'nayuki_accessToken');
            $.notify('奈雪点单', '✅ 登录数据已抓取', `openId: ${openId ? '已获取' : '未获取'}\naccessToken: ${accessToken ? '已获取' : '未获取'}`);
        }
    } catch (e) {}
    $.done({});
} else {
    // 定时任务：自动签到
    const openId = $.getdata('nayuki_openId');
    const accessToken = $.getdata('nayuki_accessToken');
    
    if (!openId || !accessToken) {
        $.notify('奈雪点单', '❌ 签到失败', '请先打开小程序触发签到以抓取数据');
        $.done({});
        return;
    }
    
    const now = new Date();
    const signDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    const requestBody = buildRequestBody(signDate);
    
    $task.fetch({
        url: CONFIG.baseUrl + CONFIG.signUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': accessToken
        },
        body: JSON.stringify(requestBody)
    }).then(response => {
        try {
            const result = JSON.parse(response.body);
            if (result.code === 0) {
                $.msg($.name, '✅ 签到成功', `日期: ${signDate}`);
            } else {
                $.msg($.name, '❌ 签到失败', result.message || '未知错误');
            }
        } catch (e) {
            $.msg($.name, '❌ 签到失败', '响应解析失败');
        }
        $.done({});
    }).catch(err => {
        $.msg($.name, '❌ 请求失败', err);
        $.done({});
    });
}

// ====== Environment Class ======
function Env(name) {
    this.name = name;
    this.msg = (title, subtitle, message) => {
        console.log(`${title}\n${subtitle}\n${message}`);
    };
    this.notify = (title, subtitle, message) => {
        $notify(title, subtitle, message);
    };
    this.getdata = (key) => {
        return $prefs.valueForKey(key);
    };
    this.setdata = (val, key) => {
        $prefs.setValueForKey(val, key);
    };
    this.done = () => {
        $done({});
    };
}