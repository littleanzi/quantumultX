/**
 * 有赞小程序签到脚本 (完整版)
 * 接口: /wscump/checkin/checkinV2.json
 * 数据存储: youzan_data (自动抓取 access_token, kdt_id, app_id, checkinId)
 * MITM: h5.youzan.com
 * 重写: 抓取 checkinV2 或 check-in-info 请求获取凭证
 * 定时: 建议 0 8 * * *
 */

const $ = new Env('有赞签到');
const DATA_KEY = 'youzan_data';
const API = 'https://h5.youzan.com';

// ========== 抓取凭证 ==========
if (typeof $request !== 'undefined') {
    const url = $request.url;
    const accessToken = getParam(url, 'access_token');
    const kdtId = getParam(url, 'kdt_id') || getParam(url, 'kdtId') || '';
    const appId = getParam(url, 'app_id') || '';
    const checkinId = getParam(url, 'checkinId') || '';

    if (accessToken && kdtId && appId) {
        const data = {
            token: accessToken,
            kdtId: kdtId,
            appId: appId,
            checkinId: checkinId
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 凭证已保存');
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请进入有赞小程序签到页面抓取凭证'); return $.done(); }
    
    let data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }
    
    const token = data.token || '';
    const kdtId = data.kdtId || '';
    const appId = data.appId || '';
    const checkinId = data.checkinId || '';

    if (!token || !kdtId || !appId) {
        $.msg($.name, '❌ 凭证不完整', '请重新进入小程序抓取');
        return $.done();
    }

    // 构造签到 URL
    const signPath = `/wscump/checkin/checkinV2.json?checkinId=${checkinId}&app_id=${appId}&kdt_id=${kdtId}&access_token=${token}`;

    const headers = {
        'Content-Type': 'application/json',
        'Extra-Data': JSON.stringify({
            is_weapp: 1,
            version: "2.149.9.101",
            client: "weapp",
            bizEnv: "wsc"
        })
    };

    try {
        // 有赞签到接口可能是 GET 或 POST，这里先用 GET 尝试
        const res = await doGet(signPath, headers);
        console.log('签到响应: ' + JSON.stringify(res));
        
        let msg = '';
        if (res.code === 0 || res.success) {
            msg = '✅ 签到成功';
        } else if ((res.msg || '').includes('已签到') || (res.msg || '').includes('重复')) {
            msg = '⚠️ 今天已签到';
        } else {
            msg = '❌ 失败: ' + (res.msg || JSON.stringify(res));
        }
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 异常', e.message);
    }
    $.done();
})();

// ========== 工具函数 ==========
function doGet(path, headers) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = { url, method: 'GET', headers, timeout: 30000 };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => resolve(JSON.parse(res.body))).catch(reject);
        } else {
            $httpClient.get(opts, (err, resp, data) => {
                if (err) reject(err); else resolve(JSON.parse(data));
            });
        }
    });
}

function getParam(url, key) {
    return (new URLSearchParams(url.split('?')[1] || '')).get(key) || '';
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