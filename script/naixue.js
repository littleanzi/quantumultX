/**
* 奈雪的茶·签到脚本
* 2026-06-14 版本: 1.0.2
* 签名密钥 (HmacSHA1): sArMTldQ9tqU19XIRDMWz7BO5WaeBnrezA
* MITM 域名: tm-api.pin-dao.cn
* 重写规则 (Rewrite): ^https://tm-api\.pin-dao\.cn/user/sign/save url script-request-body naixue.js
* 算法: HmacSHA1签名
* [rewrite_local]
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
    const body = JSON.parse($request.body);
    const signDate = body.params?.signDate || new Date().toISOString().slice(0, 10);
    const openId = body.common?.openId;
    const accessToken = $request.headers['Authorization'] || '';
    
    // 保存抓取到的数据
    if (openId) {
        $.setdata(openId, 'nayuki_openId');
    }
    if (accessToken) {
        $.setdata(accessToken, 'nayuki_accessToken');
    }
    
    // 显示抓取通知
    $.notify('奈雪的茶', '✅ 抓取成功', `openId: ${openId ? '已获取' : '未获取'}\naccessToken: ${accessToken ? '已获取' : '未获取'}`);
    
    const requestBody = buildRequestBody(signDate);
    
    $task.fetch({
        url: CONFIG.baseUrl + CONFIG.signUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': $request.headers['Authorization'] || ''
        },
        body: JSON.stringify(requestBody)
    }).then(response => {
        const result = JSON.parse(response.body);
        if (result.code === 0) {
            $.msg($.name, '✅ 签到成功', `日期: ${signDate}`);
        } else {
            $.msg($.name, '❌ 签到失败', result.message || '未知错误');
        }
        $.done({ response });
    }).catch(err => {
        $.msg($.name, '❌ 请求失败', err);
        $.done({});
    });
} else {
    $.done({});
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
        return $.persistentStore.get(key);
    };
    this.setdata = (val, key) => {
        $.persistentStore.set(val, key);
    };
    this.done = () => {
        $.done();
    };
    this.HmacSHA1 = (message, key) => {
        const CryptoJS = require('crypto');
        return CryptoJS.createHmac('sha1', key).update(message);
    };
    this.enc = {
        Base64: 'base64'
    };
}