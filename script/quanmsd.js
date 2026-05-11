/**
 * 脚本名称：PureH2B 签到
 * 接口：nmp.pureh2b.com
 * 数据存储：pureh2b_data (自动抓取 token, code)
 * MITM: nmp.pureh2b.com
 * 重写: 抓取 fixSign 请求获取 token, code, signInId
 * 定时: 建议 0 8 * * *
 */

const $ = new Env('PureH2B签到');
const DATA_KEY = 'pureh2b_data';
const API = 'https://nmp.pureh2b.com';

// ========== 抓取凭证 ==========
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['token'] || '';
    const code = headers['code'] || '';
    let body = {};
    try { body = JSON.parse($request.body || '{}'); } catch (e) {}
    const signInId = body.signInId || '';

    if (token && code && signInId) {
        const data = { token, code, signInId };
        $.setdata(JSON.stringify(data), DATA_KEY);
        $.msg($.name, '', '🎉 凭证已保存');
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请先进入小程序签到页面抓取凭证'); return $.done(); }

    let data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }

    const token = data.token || '';
    const code = data.code || '';
    const signInId = data.signInId || 'QD26040001';

    if (!token || !code) {
        $.msg($.name, '❌ 凭证不完整', '请重新进入小程序抓取');
        return $.done();
    }

    // 当天日期
    const today = new Date();
    const signDay = today.getFullYear() + '-' + 
                    String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(today.getDate()).padStart(2, '0');

    const signBody = {
        signInId: signInId,
        signDay: signDay
    };

    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'token': token,
        'code': code,
        'tag': 'v3.0'
    };

    try {
        const res = await doPost('/api/new/member/sign/signIn/fixSign', signBody, headers);
        console.log('签到响应: ' + JSON.stringify(res));
        let msg = '';
        if (res.code === 0 || res.success) msg = '✅ 签到成功';
        else if ((res.msg || '').includes('已签到') || (res.msg || '').includes('重复')) msg = '⚠️ 今天已签到';
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