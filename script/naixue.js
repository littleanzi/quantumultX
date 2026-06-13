/**
* 奈雪的茶·签到脚本
* 2026-06-14 版本: 1.1.1
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

const $ = new Env('奈雪的茶签到');
const isResponse = typeof $response !== "undefined";

// ====== 配置项 ======
const CONFIG = {
    baseUrl: 'https://tm-api.pin-dao.cn',
    signUrl: '/user/sign/save',
    signKey: 'sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA'
};

// ====== SHA1 实现 ======
function sha1(msg) {
    function rotate_left(n, s) { return (n << s) | (n >>> (32 - s)); }
    function cvt_hex(val) {
        var str = "";
        for (var i = 7; i >= 0; i--) str += ((val >>> (i * 4)) & 0x0f).toString(16);
        return str;
    }
    var blockstart, i, j;
    var W = new Array(80);
    var H0 = 0x67452301, H1 = 0xEFCDAB89, H2 = 0x98BADCFE, H3 = 0x10325476, H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;
    msg = unescape(encodeURIComponent(msg));
    var msg_len = msg.length;
    var word_array = [];
    for (i = 0; i < msg_len - 3; i += 4)
        word_array.push((msg.charCodeAt(i) << 24) | (msg.charCodeAt(i + 1) << 16) | (msg.charCodeAt(i + 2) << 8) | msg.charCodeAt(i + 3));
    switch (msg_len % 4) {
        case 0: i = 0x080000000; break;
        case 1: i = (msg.charCodeAt(msg_len - 1) << 24) | 0x800000; break;
        case 2: i = (msg.charCodeAt(msg_len - 2) << 24) | (msg.charCodeAt(msg_len - 1) << 16) | 0x8000; break;
        case 3: i = (msg.charCodeAt(msg_len - 3) << 24) | (msg.charCodeAt(msg_len - 2) << 16) | (msg.charCodeAt(msg_len - 1) << 8) | 0x80; break;
    }
    word_array.push(i);
    while ((word_array.length % 16) != 14) word_array.push(0);
    word_array.push(msg_len >>> 29);
    word_array.push((msg_len << 3) & 0x0ffffffff);
    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
        for (i = 0; i < 16; i++) W[i] = word_array[blockstart + i];
        for (i = 16; i <= 79; i++) W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        A = H0; B = H1; C = H2; D = H3; E = H4;
        for (i = 0; i <= 19; i++) { temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0xFFFFFFFF; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        for (i = 20; i <= 39; i++) { temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0xFFFFFFFF; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        for (i = 40; i <= 59; i++) { temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0xFFFFFFFF; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        for (i = 60; i <= 79; i++) { temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0xFFFFFFFF; E = D; D = C; C = rotate_left(B, 30); B = A; A = temp; }
        H0 = (H0 + A) & 0xFFFFFFFF; H1 = (H1 + B) & 0xFFFFFFFF; H2 = (H2 + C) & 0xFFFFFFFF; H3 = (H3 + D) & 0xFFFFFFFF; H4 = (H4 + E) & 0xFFFFFFFF;
    }
    return cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
}

// ====== HmacSHA1 实现 ======
function hmacSha1(message, key) {
    var bs = 64;
    if (key.length > bs) key = sha1(key);
    var k = [];
    for (var i = 0; i < bs; i++) k[i] = i < key.length ? key.charCodeAt(i) : 0;
    var ipad = [], opad = [];
    for (var i = 0; i < bs; i++) {
        ipad[i] = k[i] ^ 0x36;
        opad[i] = k[i] ^ 0x5C;
    }
    var imsg = String.fromCharCode.apply(null, ipad) + message;
    var omsg = String.fromCharCode.apply(null, opad) + hexToBytes(sha1(imsg));
    return sha1(omsg);
}

function hexToBytes(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.substr(i, 2), 16));
    return String.fromCharCode.apply(null, bytes);
}

function base64Encode(str) {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;
    str = utf8Encode(str);
    while (i < str.length) {
        chr1 = str.charCodeAt(i++); chr2 = str.charCodeAt(i++); chr3 = str.charCodeAt(i++);
        enc1 = chr1 >> 2; enc2 = ((chr1 & 3) << 4) | (chr2 >> 4); enc3 = ((chr2 & 15) << 2) | (chr3 >> 6); enc4 = chr3 & 63;
        if (isNaN(chr2)) { enc3 = enc4 = 64; } else if (isNaN(chr3)) { enc4 = 64; }
        output += keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
    }
    return output;
}

function utf8Encode(str) {
    str = str.replace(/\r\n/g, "\n");
    var utftext = "";
    for (var n = 0; n < str.length; n++) {
        var c = str.charCodeAt(n);
        if (c < 128) utftext += String.fromCharCode(c);
        else if (c > 127 && c < 2048) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128); }
        else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128); }
    }
    return utftext;
}

// ====== 签名算法 ======
function generateSignature(nonce, openId, timestamp) {
    var data = "nonce=" + nonce + "&openId=" + openId + "&timestamp=" + timestamp;
    return base64Encode(hmacSha1(data, CONFIG.signKey));
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
            $.notify('奈雪的茶', '✅ 登录数据已抓取', `openId: ${openId ? '已获取' : '未获取'}\naccessToken: ${accessToken ? '已获取' : '未获取'}`);
        }
    } catch (e) {}
    $.done({});
} else {
    // 定时任务：自动签到
    const openId = $.getdata('nayuki_openId');
    const accessToken = $.getdata('nayuki_accessToken');
    
    if (!openId || !accessToken) {
        $.notify('奈雪的茶', '❌ 签到失败', '请先打开小程序触发签到以抓取数据');
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