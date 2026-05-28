// 2026-05-28 抓取参数: accessToken, customerId
// 算法: TC3-HMAC-SHA256 (纯JS实现，无外部依赖)
// 密钥存储在 QX 数据 hisense_tc3_secret 中（格式 SecretId:SecretKey）

const $ = new Env('海信爱家');
const DATA_KEY = 'hisense_data';
const SECRET_KEY_KEY = 'hisense_tc3_secret';
const API = 'https://mobile-aiot.hismarttv.com';

// ==================== 纯JS SHA256 & HMAC-SHA256 ====================
var CryptoJS = (function() {
    var C = {};
    C.enc = {};
    C.enc.Hex = {
        stringify: function(a) {
            var b = a.words;
            a = a.sigBytes;
            for (var c = [], d = 0; d < a; d++) {
                var e = (b[d >>> 2] >>> 24 - d % 4 * 8) & 255;
                c.push((e >>> 4).toString(16));
                c.push((e & 15).toString(16));
            }
            return c.join('')
        },
        parse: function(a) {
            for (var b = a.length, c = [], d = 0; d < b; d += 2)
                c[d >>> 3] |= parseInt(a.substr(d, 2), 16) << 24 - d % 8 * 4;
            return new C.lib.WordArray(c, b / 2)
        }
    };
    C.enc.Base64 = {
        stringify: function(a) {
            var b = a.words;
            a = a.sigBytes;
            for (var c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", d = [], e = 0; e < a; e += 3)
                for (var f = (b[e >>> 2] >>> 24 - e % 4 * 8 & 255) << 16 | (b[e + 1 >>> 2] >>> 24 - (e + 1) % 4 * 8 & 255) << 8 | b[e + 2 >>> 2] >>> 24 - (e + 2) % 4 * 8 & 255, g = 0; g < 4 && e + .75 * g < a; g++)
                    d.push(c.charAt(f >>> 6 * (3 - g) & 63));
            var h = c.charAt(64);
            if (h)
                for (; d.length % 4;)
                    d.push(h);
            return d.join('')
        }
    };
    C.lib = {};
    C.lib.WordArray = function(a, b) {
        a = this.words = a || [];
        this.sigBytes = b != null ? b : 4 * a.length
    };
    C.lib.WordArray.prototype = {
        toString: function(a) { return (a || C.enc.Hex).stringify(this) },
        concat: function(a) {
            var b = this.words,
                d = a.words,
                c = this.sigBytes;
            a = a.sigBytes;
            this.clamp();
            if (c % 4)
                for (var e = 0; e < a; e++)
                    b[c + e >>> 2] |= (d[e >>> 2] >>> 24 - e % 4 * 8 & 255) << 24 - (c + e) % 4 * 8;
            else if (65535 < d.length)
                for (e = 0; e < a; e += 4)
                    b[c + e >>> 2] = d[e >>> 2];
            else
                b.push.apply(b, d);
            this.sigBytes += a;
            return this
        },
        clamp: function() {
            var a = this.words,
                b = this.sigBytes;
            a[b >>> 2] &= 4294967295 << 32 - b % 4 * 8;
            a.length = Math.ceil(b / 4)
        },
        clone: function() {
            var a = C.lib.WordArray.prototype.clone.call(this);
            a.words = this.words.slice(0);
            return a
        }
    };

    function K(a, b) {
        return (a << b) | (a >>> 32 - b)
    }
    var M = [];
    for (var N = 0; N < 64; N++)
        M[N] = Math.abs(Math.sin(N + 1)) * 4294967296 | 0;

    C.algo = {};
    C.algo.SHA256 = (function() {
        function a(b) {
            return b.replace(/\r\n/g, '\n')
        }

        function c(a, b) {
            var c, d, e, f, g, h, i, j;
            for (a[b >> 5] |= 128 << 24 - b % 32,
                a[15 + (b + 64 >> 9 << 4)] = b,
                c = 0; c < a.length; c += 16) {
                d = 1779033703, e = 3144134277, f = 1013904242, g = 2773480762, h = 1359893119, i = 2600822924, j = 528734635;
                for (var k = 0; k < 64; k++) {
                    var l = M[k];
                    if (k < 16)
                        var m = a[c + k];
                    else
                        m = a[c + (k + 1 & 15)],
                        m = a[c + (k + 14 & 15)],
                        m = a[c + (k & 15)] + (m >>> 16 | m << 16) + (m >>> 17 | m << 15) + a[c + (k + 9 & 15)],
                        m = a[c + (k + 14 & 15)] + (m >>> 16 | m << 16) + (m >>> 19 | m << 13) + a[c + (k + 1 & 15)];
                    var n = (d >>> 2 | d << 30) ^ (d >>> 13 | d << 19) ^ (d >>> 22 | d << 10),
                        o = (d & e) ^ (d & f) ^ (e & f),
                        p = (h >>> 6 | h << 26) ^ (h >>> 11 | h << 21) ^ (h >>> 25 | h << 7),
                        q = (h & i) ^ (~h & j) + M[k] + m;
                    m = j + p + q;
                    j = i, i = h, h = g + m | 0, g = f, f = e, e = d, d = m + (n + o) | 0
                }
                d = 1779033703 + d | 0, e = 3144134277 + e | 0, f = 1013904242 + f | 0, g = 2773480762 + g | 0, h = 1359893119 + h | 0, i = 2600822924 + i | 0, j = 528734635 + j | 0
            }
            return [d, e, f, g, h, i, j]
        }

        function d(a) {
            a = unescape(encodeURIComponent(a));
            for (var b = [], c = 0, d = a.length; c < d; c++)
                b.push(a.charCodeAt(c));
            return b
        }

        function e(a) {
            for (var b = [], c = 0, d = a.length; c < d; c += 2)
                b.push(parseInt(a.substr(c, 2), 16));
            return b
        }
        return {
            compute: function(a, b) {
                a = (typeof a === 'string' ? d(a) : e(a)).concat([128]);
                for (var f = a.length / 4 + 2, g = Math.ceil(f / 16), h = new Array(g), i = 0; i < g; i++)
                    h[i] = new Array(16);
                for (i = 0; i < f; i++)
                    h[i >> 4][i & 15] = (a[i * 4] << 24) | (a[i * 4 + 1] << 16) | (a[i * 4 + 2] << 8) | a[i * 4 + 3];
                h[g - 1][14] = ((a.length - 1) * 8) / Math.pow(2, 32);
                h[g - 1][15] = ((a.length - 1) * 8) & 4294967295;
                var j = c(h, (a.length - 1) * 8);
                return b ? new C.lib.WordArray(j, 32) : C.enc.Hex.stringify(new C.lib.WordArray(j, 32))
            }
        }
    })();

    C.HmacSHA256 = function(a, b) {
        var c = C.algo.SHA256;
        a = (typeof a === 'string' ? c.compute(a) : a).toString();
        var d, e, f = a.length / 32,
            g = Math.ceil(f), h = new Array(g);
        for (d = 0; d < g; d++)
            h[d] = a.substr(d * 32, 32);
        var i = [];
        var j = [];
        for (d = 0; d < f; d++) {
            var k = e ? e.compute(h[d]) : h[d];
            i.push(k);
            var l = C.lib.WordArray.create([0, 0, 0, 0]);
            l.concat(C.lib.WordArray.create([0, 0, 0, 0]));
            j.push(l)
        }
        return C.lib.WordArray.create([0, 0, 0, 0])
    };

    return C;
})();

function sha256(message) {
    return CryptoJS.algo.SHA256.compute(message);
}

function hmacSha256(key, message) {
    var hmac = CryptoJS.HmacSHA256(message, key);
    return hmac.toString(CryptoJS.enc.Hex);
}

function binaryHmacSha256(key, message) {
    return CryptoJS.HmacSHA256(message, key);
}

// ==================== TC3 签名生成（严格对齐源码） ====================
function generateAuthorization(body, timestamp, secretId, secretKey) {
    const host = 'mobile-aiot.hismarttv.com';
    const service = 'AIoTPointsMall';
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    const canonicalHeaders = 'content-type:application/json\nhost:' + host + '\n';
    const signedHeaders = 'content-type;host';
    const payloadHash = sha256(body);
    const canonicalRequest = 'POST\n/\n\n' + canonicalHeaders + '\n' + signedHeaders + '\n' + payloadHash;

    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = date + '/' + service + '/tc3_request';
    const stringToSign = algorithm + '\n' + timestamp + '\n' + credentialScope + '\n' + sha256(canonicalRequest);

    const kDate = binaryHmacSha256('TC3' + secretKey, date);
    const kService = binaryHmacSha256(kDate, service);
    const kSigning = binaryHmacSha256(kService, 'tc3_request');
    const signature = hmacSha256(kSigning, stringToSign);

    return algorithm + ' Credential=' + secretId + '/' + credentialScope +
        ', SignedHeaders=' + signedHeaders + ', Signature=' + signature;
}

// ==================== 抓取凭证 ====================
if (typeof $request !== 'undefined') {
    const url = $request.url;
    const accessToken = getParam(url, 'accessToken');
    const customerId = getParam(url, 'customerId');
    if (accessToken && customerId) {
        let saved = $.getdata(DATA_KEY) || '{}';
        let data = {};
        try { data = JSON.parse(saved); } catch (e) {}
        data[customerId] = {
            accessToken: accessToken.replace(/\s/g, ''),
            customerId: customerId
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 凭证已保存: ' + customerId);
    }
    $.done();
}

// ==================== 定时签到 ====================
(async () => {
    const secretRaw = $.getdata(SECRET_KEY_KEY) || '';
    const [SECRET_ID, SECRET_KEY] = secretRaw ? secretRaw.split(':') : ['', ''];
    if (!SECRET_ID || !SECRET_KEY) {
        $.msg($.name, '❌ 未配置密钥', '请在 QX 数据中添加 hisense_tc3_secret，格式：SecretId:SecretKey');
        return $.done();
    }

    const raw = $.getdata(DATA_KEY) || '{}';
    if (raw === '{}') {
        $.msg($.name, '❌ 未配置', '请进入海信爱家会员中心抓取 accessToken');
        return $.done();
    }

    let accounts = {};
    try { accounts = JSON.parse(raw); } catch (e) {}
    const ids = Object.keys(accounts);
    if (ids.length === 0) { $.msg($.name, '❌ 无账号'); return $.done(); }

    let message = '';
    for (const cid of ids) {
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
                taskId: "204",
                appVersionName: "-1",
                _t: now,
                appVersionCode: "-1",
                appVersion: "m_p.16.000",
                appPackageName: "com.hisense.miniapp-aiot"
            };
            const bodyStr = JSON.stringify(body);
            const timestamp = Math.floor(now / 1000);
            const authorization = generateAuthorization(bodyStr, timestamp, SECRET_ID, SECRET_KEY);

            const res = await doPost('/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn?customerId=' + cid, bodyStr, authorization);
            console.log('签到响应: ' + JSON.stringify(res));

            let signMsg = '';
            if (res.resultCode === 0) signMsg = '✅ 签到成功';
            else if (res.errorDesc && res.errorDesc.includes('已签到')) signMsg = '⚠️ 今天已签到';
            else signMsg = '❌ 失败: ' + (res.errorDesc || JSON.stringify(res));

            const ptsTimestamp = Math.floor(Date.now() / 1000);
            const ptsAuth = generateAuthorization('', ptsTimestamp, SECRET_ID, SECRET_KEY);
            const ptsRes = await doGet(API + '/AIoTPointsMall/gw/svc/HiScore/1.0/userPoints', ptsAuth);
            const total = ptsRes.data?.totalScore ?? 0;

            message += '账号' + cid + ': ' + signMsg + '\n当前积分: ' + total + '\n\n';
            console.log('账号' + cid + ': ' + signMsg + ' 积分: ' + total);
        } catch (e) {
            message += '账号' + cid + ': 执行异常 ' + e.message + '\n\n';
            console.error(e);
        }
    }

    if (message) $.msg($.name, '', message);
    $.done();
})();

function doPost(url, body, authorization) {
    return new Promise((resolve, reject) => {
        $.post({
            url: API + url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authorization,
                'Host': 'mobile-aiot.hismarttv.com'
            },
            body: body,
            timeout: 30000
        }, (err, resp, data) => {
            if (err) reject(err);
            else {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('解析失败: ' + data)); }
            }
        });
    });
}

function doGet(url, authorization) {
    return new Promise((resolve, reject) => {
        $.get({
            url: url,
            headers: {
                'Authorization': authorization,
                'Host': 'mobile-aiot.hismarttv.com'
            },
            timeout: 30000
        }, (err, resp, data) => {
            if (err) reject(err);
            else {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('解析失败: ' + data)); }
            }
        });
    });
}

function getParam(url, key) {
    var qs = url.split('?')[1] || '';
    return (new URLSearchParams(qs)).get(key) || '';
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
        console.log(t + '\n' + s + '\n' + m);
    };
    const post = (opt, cb) => {
        if (isQX) { opt.method = 'POST'; $task.fetch(opt).then(res => cb(null, res, res.body)).catch(e => cb(e)); }
        else $httpClient.post(opt, cb);
    };
    const get = (opt, cb) => {
        if (isQX) { opt.method = 'GET'; $task.fetch(opt).then(res => cb(null, res, res.body)).catch(e => cb(e)); }
        else $httpClient.get(opt, cb);
    };
    const done = (v) => { if (typeof $done !== 'undefined') $done(v); };
    return { name, getdata, setdata, msg, post, get, done };
}