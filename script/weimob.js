/**
 * 微盟签到脚本 (测试版)
 * MITM: xapi.weimob.com
 * 重写: 抓取任意请求获取 X-WX-Token 和 pid
 * 定时: 建议每天早上 8:00
 */

const $ = new Env('特步签到');
const DATA_KEY = 'weimob_data';
const API = 'https://xapi.weimob.com';

// ==================== 抓取模式 ====================
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['X-WX-Token'] || headers['x-wx-token'] || '';
    const pid = headers['weimob-pid'] || headers['cloud-pid'] || '';

    if (token && pid) {
        const data = {
            token: token,
            pid: pid,
            bosId: headers['weimob-bosId'] || headers['cloud-bosId'] || pid,
            vid: (headers['X-wmsdk-vid'] || '').replace(/['"]/g, '')
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 Token 已保存');
    }
    $.done();
}

// ==================== 定时签到 ====================
(async () => {
    const rawData = $.getdata(DATA_KEY) || '';
    if (!rawData) {
        $.msg($.name, '❌ 未配置数据', '请进入小程序签到页面抓取 Token');
        $.done();
        return;
    }

    let data;
    try { data = JSON.parse(rawData); } catch (e) { data = {}; }
    const { token, pid, bosId, vid } = data;

    if (!token || !pid) {
        $.msg($.name, '❌ 数据不完整', '请重新进入小程序抓取');
        $.done();
        return;
    }

    // 构造签到请求体（使用抓包中的固定模板）
    const body = {
        pid: pid,
        tracePromotionId: "100024907",
        extendInfo: {
            youshu: { enable: true, token: "bicab31e9207524bd2" },
            quickdeliver: { enable: false },
            source: 1,
            mpScene: 1232,
            channelsource: 5,
            analysis: [
                { channelStatus: true, channelCode: "youshu", token: "bicab31e9207524bd2" }
            ],
            wxTemplateId: 8156,
            childTemplateIds: [
                { customId: 90004, version: "crm@0.1.89" },
                { customId: 90002, version: "ec@83.1" },
                { customId: 90006, version: "hudong@0.0.251" },
                { customId: 90008, version: "cms@0.0.528" },
                { customId: 90070, version: "1.0.16y" }
            ],
            refer: "onecrm-signgift",
            bosTemplateId: 1000002205
        },
        i18n: { timezone: "8", language: "zh" },
        currentTracePromotionId: "100024907",
        customInfo: { wid: 11978023832, source: 0 },
        queryParameter: { tracepromotionid: "100024907", tracePromotionId: "100024907" },
        storeId: "0",
        tracepromotionid: "100024907",
        appid: "wxb6201f95db35f963",
        basicInfo: {
            vidType: 2,
            productInstanceId: 2563229530,
            bosId: parseInt(bosId) || 4020173000530,
            vid: parseInt(vid) || 6013892423530,
            productId: 146,
            merchantId: 2000025069530,
            tcode: "weimob",
            productVersionId: "14026",
            cid: 187809530
        }
    };

    try {
        const res = await doPost('/api3/onecrm/mactivity/sign/misc/sign/activity/core/c/sign', body, token);
        console.log('签到响应: ' + JSON.stringify(res));

        let msg = '';
        if (res.errcode === 0 || res.errcode === "0") {
            signMsg = '✅ 签到成功';
        } else if (res.errmsg && (res.errmsg.includes('重复签到') || res.errmsg.includes('已经签到'))) {
            signMsg = '⚠️ 今天已签到';
        } else {
            signMsg = '❌ 失败: ' + (res.errmsg || JSON.stringify(res));
        }
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 异常', e.message);
    }
    $.done();
})();

// ==================== 工具函数 ====================
function doPost(path, body, token) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = {
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WX-Token': token,
                'X-cms-sdk-request': '1.5.139',
                'X-req-from': 'onecrm'
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