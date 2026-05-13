// 抓取参数: access_token, kdt_id, app_id
// 接口: /wscump/checkin/checkinV2.json

const $ = new Env('松鲜鲜签到');
const DATA_KEY = 'youzan_sxx_data';
const API = 'https://h5.youzan.com';

// ========== 抓取凭证 ==========
if (typeof $request !== 'undefined') {
    const url = $request.url;
    const accessToken = getParam(url, 'access_token');
    const kdtId = getParam(url, 'kdt_id') || getParam(url, 'kdtId') || '';
    const appId = getParam(url, 'app_id') || '';

    if (accessToken && kdtId && appId) {
        const data = {
            token: accessToken,
            kdtId: kdtId,
            appId: appId
        };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 凭证已保存');
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请进入松鲜鲜小程序签到页面抓取凭证'); return $.done(); }

    let data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }

    const token = data.token || '';
    const kdtId = data.kdtId || '';
    const appId = data.appId || '';

    if (!token || !kdtId || !appId) {
        $.msg($.name, '❌ 凭证不完整', '请重新进入小程序抓取');
        return $.done();
    }

    // 尝试签到（使用有赞标准签到接口，checkinId 可以省略，服务器会根据 token 自动匹配）
    const signPath = `/wscump/checkin/checkinV2.json?app_id=${appId}&kdt_id=${kdtId}&access_token=${token}`;

    const headers = {
        'Content-Type': 'application/json',
        'Extra-Data': JSON.stringify({
            is_weapp: 1,
            version: "2.236.701",
            client: "weapp",
            bizEnv: "wsc"
        })
    };

    try {
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