/**
* 奈雪的茶·签到脚本
* 2026-06-14 版本: 1.0.8
* 签名密钥 (HmacSHA1): sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA
* MITM 域名: tm-api.pin-dao.cn
* 重写规则 (Rewrite): ^https://tm-api\.pin-dao\.cn/user/(base-userinfo|sign/save) url script-request-body naixue.js
* 算法: HmacSHA1签名
* [rewrite_local]
* https://tm-api.pin-dao.cn/user/base-userinfo url script-request-body naixue.js
* https://tm-api.pin-dao.cn/user/sign/save url script-request-body naixue.js
* [task_local]
* 0 9 * * * naixue.js
* [MITM]
* hostname = tm-api.pin-dao.cn
*/

const $ = new Env('奈雪的茶签到');
const isRequest = typeof $request !== "undefined";

// ====== 配置项 ======
const CONFIG = {
    baseUrl: 'https://tm-api.pin-dao.cn',
    signUrl: '/user/sign/save',
    signKey: 'sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA'
};

// ====== 签名算法 ======
function generateSignature(nonce, openId, timestamp) {
    const data = `nonce=${nonce}&openId=${openId}&timestamp=${timestamp}`;
    return $.HmacSHA1(data, CONFIG.signKey).toString($.enc.Base64);
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
if (isRequest) {
    const url = $request.url;
    let body;
    try {
        body = JSON.parse($request.body);
    } catch (e) {
        body = {};
    }
    
    // 拦截任意API请求：只抓取数据，原样放行
    const openId = body.common?.openId;
    const accessToken = $request.headers['Authorization'] || '';
    
    if (openId && accessToken) {
        $.setdata(openId, 'nayuki_openId');
        $.setdata(accessToken, 'nayuki_accessToken');
        $.notify('奈雪的茶', '✅ 数据已抓取', `openId: 已获取\naccessToken: 已获取`);
    }
    
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
    this.HmacSHA1 = (message, key) => {
        const CryptoJS = require('crypto');
        return CryptoJS.createHmac('sha1', key).update(message);
    };
    this.enc = {
        Base64: 'base64'
    };
}