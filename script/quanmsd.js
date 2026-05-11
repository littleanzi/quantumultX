// 2026-05-11 23:59:59 抓取参数: token, code, signInId

const $ = new Env('全棉时代微信小程序签到');
const DATA_KEY = 'pureh2b_data';
const API = 'https://nmp.pureh2b.com';

if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['token'] || '';
    const code = headers['code'] || '';
    let body = {};
    try { body = JSON.parse($request.body || '{}'); } catch (e) { }
    const signInId = body.signInId || '';

    if (token && code && signInId) {
        $.setdata(JSON.stringify({ token, code, signInId }), DATA_KEY);
        $.msg($.name, '', '🎉 凭证已保存');
    }
    $.done();
}

(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请先手动签到一次抓取凭证，或手动填入 pureh2b_data'); return $.done(); }

    let data = {};
    try { data = JSON.parse(raw); } catch (e) { data = {}; }
    const token = data.token || '';
    const code = data.code || '';
    const signInId = data.signInId || 'QD26040001';

    if (!token || !code) {
        $.msg($.name, '❌ 凭证不完整', '请重新抓取或检查 pureh2b_data');
        return $.done();
    }

    const today = new Date();
    const signDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const signBody = { signInId, signDay };
    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'token': token,
        'code': code,
        'tag': 'v3.0'
    };

    try {
        const res = await doPost('/api/new/member/sign/signIn/fixSign', signBody, headers);
        console.log('签到响应: ' + JSON.stringify(res));
        // 在成功签到后存储日期
        if (res && res.memberCode !== undefined) {
            const lastSignDate = $.getdata('pureh2b_last_sign_date') || '';
            const todayStr = signDay;
            if (lastSignDate === todayStr) {
                msg = '⚠️ 今天已签到';
            } else {
                $.setdata(todayStr, 'pureh2b_last_sign_date');
                msg = '✅ 签到成功';
            }
        }
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