// v1 2026-05-12 抓取参数: token, code, signInId
// 接口: /api/new/member/sign/signIn/fixSign

const $ = new Env('全棉时代微信小程序签到');
const DATA_KEY = 'pureh2b_data';
const LAST_SIGN_KEY = 'pureh2b_last_sign_date';
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

    // 检查今天是否已签到（本地记录）
    const lastSignDate = $.getdata(LAST_SIGN_KEY) || '';
    if (lastSignDate === signDay) {
        // 已签到，但仍然可以查询一次积分
        try {
            const points = await getPoints(token, code);
            $.msg($.name, '', `⚠️ 今天已签到，当前积分：${points}`);
        } catch (e) {
            $.msg($.name, '', '⚠️ 今天已签到');
        }
        return $.done();
    }

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
        let msg = '';
        if (res && res.memberCode !== undefined) {
            $.setdata(signDay, LAST_SIGN_KEY);
            // 签到成功，查询积分
            try {
                const points = await getPoints(token, code);
                msg = `✅ 签到成功，当前积分：${points}`;
            } catch (e) {
                msg = '✅ 签到成功';
            }
        } else if ((res.msg || '').includes('已签到') || (res.msg || '').includes('重复')) {
            // 服务器返回已签到，但本地未记录，更新记录
            $.setdata(signDay, LAST_SIGN_KEY);
            const points = await getPoints(token, code).catch(() => '?');
            msg = `⚠️ 今天已签到，当前积分：${points}`;
        } else {
            msg = '❌ 失败: ' + (res.msg || JSON.stringify(res));
        }
        $.msg($.name, '', msg);
    } catch (e) {
        $.msg($.name, '❌ 异常', e.message);
    }
    $.done();
})();

// ========== 积分查询函数 ==========
async function getPoints(token, code) {
    const headers = {
        'token': token,
        'code': code,
        'tag': 'v3.0'
    };
    const url = `${API}/api/member/get/point/list?pageNum=1&pageSize=15`;
    const res = await doGet(url, headers);
    console.log('积分接口响应: ' + JSON.stringify(res));
    // 尝试从多种可能的字段中提取总积分
    if (res && res.data) {
        return res.data.totalPoint ?? res.data.totalPoints ?? res.data.total ?? 0;
    }
    return 0;
}

// ========== 工具函数 ==========
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

function doGet(url, headers) {
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