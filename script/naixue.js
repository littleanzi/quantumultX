/**
* 奈雪点单·签到脚本
* 2026-06-14 版本: 1.1.4
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
function SHA1(text) {
    function L(k, d) { return (k << d) | (k >>> (32 - d)); }
    function K(G, k, I, w, J, x) {
        K = (G & k) | ((~G) & I);
        if (w == 0) K = (G & k) | ((~G) & I);
        if (w == 1) K = G ^ k ^ I;
        if (w == 2) K = (G & k) | (G & I) | (k & I);
        if (w == 3) K = G ^ k ^ I;
        return (K + x + J + L(G, 5)) | 0;
    }
    function I(G, k, I, w, J, x) {
        k = L(k, 30);
        return "0x" + (((G + K(k, I, w, J, x)) >>> 0).toString(16));
    }
    function w(G, k, I) {
        G = (G & 65535) + (k & 65535);
        return (((G >> 16) + I + (G << 16)) >>> 0);
    }
    text = unescape(encodeURIComponent(text));
    var S = text.length, O = [], V, X, H = 0x67452301, L1 = 0xEFCDAB89, J = 0x98BADCFE, x = 0x10325476, C = 0xC3D2E1F0;
    var A = 0, B = S * 8;
    while (A % 56 != 56) { O[A] = 0; A++; }
    O[A >> 2] |= 0x80 << (A * 8) % 32;
    O[(A + 8 >> 2) - 1] = B;
    for (var m = 0; m < O.length; m += 16) {
        var T = [], n = H, t = L1, u = J, e = x, r = C;
        for (var l = 0; l < 80; l++) {
            T[l] = l < 16 ? O[m + l] : L(T[l - 3] ^ T[l - 8] ^ T[l - 14] ^ T[l - 16], 1);
            var q = w(L(H, 5), K(l, L1, J, x, C, T[l]));
            C = x; x = J; J = L(L1, 30); L1 = H; H = q;
        }
        H = w(H, n); L1 = w(L1, t); J = w(J, u); x = w(x, e); C = w(C, r);
    }
    return ((H >> 24) & 255).toString(16) + ((H >> 16) & 255).toString(16) + ((H >> 8) & 255).toString(16) + (H & 255).toString(16) +
        ((L1 >> 24) & 255).toString(16) + ((L1 >> 16) & 255).toString(16) + ((L1 >> 8) & 255).toString(16) + (L1 & 255).toString(16) +
        ((J >> 24) & 255).toString(16) + ((J >> 16) & 255).toString(16) + ((J >> 8) & 255).toString(16) + (J & 255).toString(16) +
        ((x >> 24) & 255).toString(16) + ((x >> 16) & 255).toString(16) + ((x >> 8) & 255).toString(16) + (x & 255).toString(16) +
        ((C >> 24) & 255).toString(16) + ((C >> 16) & 255).toString(16) + ((C >> 8) & 255).toString(16) + (C & 255).toString(16);
}

// ====== HmacSHA1 ======
function HmacSHA1(message, key) {
    var bKey = [], bMsg = [];
    for (var i = 0; i < 64; i++) { bKey[i] = i < key.length ? key.charCodeAt(i) : 0; }
    for (var i = 0; i < message.length; i++) { bMsg[i] = message.charCodeAt(i); }
    var oKey = [], iKey = [];
    for (var i = 0; i < 64; i++) { oKey[i] = bKey[i] ^ 0x5C; iKey[i] = bKey[i] ^ 0x36; }
    var iHash = SHA1(String.fromCharCode.apply(null, iKey) + message);
    var iHashBytes = [];
    for (var i = 0; i < iHash.length; i += 2) { iHashBytes.push(parseInt(iHash.substr(i, 2), 16)); }
    return SHA1(String.fromCharCode.apply(null, oKey) + String.fromCharCode.apply(null, iHashBytes));
}

// ====== Base64编码（输入为hex字符串）======
function hexToBase64(hex) {
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) { bytes.push(parseInt(hex.substr(i, 2), 16)); }
    var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    for (var i = 0; i < bytes.length; i += 3) {
        chr1 = bytes[i]; chr2 = i + 1 < bytes.length ? bytes[i + 1] : 0; chr3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
        enc1 = chr1 >> 2; enc2 = ((chr1 & 3) << 4) | (chr2 >> 4); enc3 = ((chr2 & 15) << 2) | (chr3 >> 6); enc4 = chr3 & 63;
        if (i + 1 >= bytes.length) { enc3 = 64; enc4 = 64; }
        else if (i + 2 >= bytes.length) { enc4 = 64; }
        output += _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + (enc3 == 64 ? '=' : _keyStr.charAt(enc3)) + (enc4 == 64 ? '=' : _keyStr.charAt(enc4));
    }
    return output;
}

// ====== 签名算法 ======
function generateSignature(nonce, openId, timestamp) {
    var data = "nonce=" + nonce + "&openId=" + openId + "&timestamp=" + timestamp;
    var hmacHex = HmacSHA1(data, CONFIG.signKey);
    return hexToBase64(hmacHex);
}

// ====== 请求体构建 ======
function buildRequestBody(signDate) {
    var nonce = Math.floor(Math.random() * 1000000);
    var openId = $.getdata('nayuki_openId');
    var timestamp = Math.floor(Date.now() / 1000);
    var signature = generateSignature(nonce, openId, timestamp);
    
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
    try {
        var result = JSON.parse($response.body);
        if (result.code === 0 && result.data) {
            var accessToken = result.data.accessToken;
            var openId = result.data.openId;
            if (openId) $.setdata(openId, 'nayuki_openId');
            if (accessToken) $.setdata(accessToken, 'nayuki_accessToken');
            $.notify('奈雪点单', '✅ 登录数据已抓取', 'openId: 已获取\naccessToken: 已获取');
        }
    } catch (e) {}
    $.done({});
} else {
    var openId = $.getdata('nayuki_openId');
    var accessToken = $.getdata('nayuki_accessToken');
    
    if (!openId || !accessToken) {
        $.notify('奈雪点单', '❌ 签到失败', '请先打开小程序触发签到以抓取数据');
        $.done({});
        return;
    }
    
    var now = new Date();
    var signDate = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    var requestBody = buildRequestBody(signDate);
    
    $task.fetch({
        url: CONFIG.baseUrl + CONFIG.signUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': accessToken
        },
        body: JSON.stringify(requestBody)
    }).then(function(response) {
        try {
            var result = JSON.parse(response.body);
            if (result.code === 0) {
                $.msg($.name, '✅ 签到成功', '日期: ' + signDate);
            } else {
                $.msg($.name, '❌ 签到失败', result.message || '未知错误');
            }
        } catch (e) {
            $.msg($.name, '❌ 签到失败', '响应解析失败');
        }
        $.done({});
    }).catch(function(err) {
        $.msg($.name, '❌ 请求失败', err);
        $.done({});
    });
}

// ====== Environment Class ======
function Env(name) {
    this.name = name;
    this.msg = function(title, subtitle, message) {
        console.log(title + '\n' + subtitle + '\n' + message);
    };
    this.notify = function(title, subtitle, message) {
        $notify(title, subtitle, message);
    };
    this.getdata = function(key) {
        return $prefs.valueForKey(key);
    };
    this.setdata = function(val, key) {
        $prefs.setValueForKey(val, key);
    };
    this.done = function() {
        $done({});
    };
}