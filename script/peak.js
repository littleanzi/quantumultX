// 抓取参数: token, appid

const $ = new Env('匹克签到');
const API = 'https://scrmipg.peaksport.com';

(async () => {
    const rawData = $.getdata('peak_data') || '';
    let token = '', appid = 'wxb0c076d58ce4a1dd';
    try {
        const d = JSON.parse(rawData);
        token = d.token || '';
        appid = d.appid || appid;
    } catch (e) {}

    if (!token) {
        $.msg($.name, '❌ 未配置 token', '请先进入匹克小程序抓取 token');
        return $.done();
    }

    let signature = '';
    let bodyStr = '';
    try {
        signature = $.getdata('@iCloud.peak_sign') || '';
        bodyStr = $.getdata('@iCloud.peak_body') || '';
    } catch (e) {}
    if (!signature) {
        signature = $.getdata('peak_sign_cache') || '';
        bodyStr = $.getdata('peak_body_cache') || '';
    }

    if (!signature || !bodyStr) {
        $.msg($.name, '❌ 无签名数据', '请确保电脑端 auto_sign_daily.js 已运行并同步到 iCloud');
        return $.done();
    }

    let body = {};
    try { body = JSON.parse(bodyStr); } catch (e) {
        $.msg($.name, '❌ 请求体格式错误', '请检查 peak_body.json');
        return $.done();
    }

    const now = Date.now().toString();
    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'ts': now,
        'startTime': now,
        'token': token,
        'sign': signature,
        'appid': appid,
        'X-TracedId': generateUUID(),
        'Referer': 'https://servicewechat.com/' + appid + '/243/page-frame.html',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.73'
    };

    try {
        const res = await doPost('/mobile/activity/sign/sign', body, headers);
        console.log('签到响应: ' + JSON.stringify(res));
        let msg = '';
        if (res.success || res.code === '0') msg = '✅ 签到成功';
        else if ((res.msg || '').includes('重复') || (res.msg || '').includes('已签')) msg = '⚠️ 今天已签到';
        else msg = '❌ 失败: ' + (res.msg || JSON.stringify(res));
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 异常', e.message);
    }
    $.done();
})();

function doPost(path, body, headers) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = { url, method: 'POST', headers, body: JSON.stringify(body), timeout: 30000 };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => resolve(JSON.parse(res.body))).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err); else resolve(JSON.parse(data));
            });
        }
    });
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
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
        console.log(t + '\n' + m);
    };
    const done = () => { if (typeof $done !== 'undefined') $done(); };
    return { name, getdata, setdata, msg, done };
}