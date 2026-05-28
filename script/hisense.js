// 2026-05-28 抓取参数：完整请求头 + 请求体
// 方式：请求回放（无需计算签名）

const $ = new Env('海信爱家');
const DATA_KEY = 'hisense_sign_data';
const API = 'https://mobile-aiot.hismarttv.com';

// ==================== 抓取模式 ====================
if (typeof $request !== 'undefined') {
    const url = $request.url;
    const headers = $request.headers;
    const body = $request.body || '{}';
    
    // 只抓取签到请求
    if (url.includes('/checkIn')) {
        const customerId = getParam(url, 'customerId') || '';
        const data = {
            url: url,
            headers: headers,
            body: body,
            customerId: customerId,
            timestamp: Date.now()
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 签到请求已保存');
    }
    $.done();
}

// ==================== 定时签到 ====================
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) {
        $.msg($.name, '❌ 未配置', '请先进入海信爱家会员中心点击签到按钮抓取请求');
        return $.done();
    }

    let data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }
    
    const url = data.url || '';
    const reqHeaders = data.headers || {};
    const reqBody = data.body || '{}';
    const customerId = data.customerId || '';
    
    if (!url || !customerId) {
        $.msg($.name, '❌ 数据不完整', '请重新抓取签到请求');
        return $.done();
    }

    try {
        const res = await doPost(url, reqBody, reqHeaders);
        console.log('签到响应: ' + JSON.stringify(res));
        
        let msg = '';
        if (res.resultCode === 0 || res.code === 0) {
            msg = '✅ 签到成功';
        } else if (res.errorDesc && res.errorDesc.includes('已签到')) {
            msg = '⚠️ 今天已签到';
        } else {
            msg = '❌ 失败: ' + (res.errorDesc || res.msg || JSON.stringify(res));
        }
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 异常', e.message);
    }
    $.done();
})();

function doPost(url, body, headers) {
    return new Promise((resolve, reject) => {
        $.post({
            url: url,
            headers: headers,
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
    const done = (v) => { if (typeof $done !== 'undefined') $done(v); };
    return { name, getdata, setdata, msg, post, done };
}