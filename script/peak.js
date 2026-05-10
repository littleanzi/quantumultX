/**
 * 匹克签到 - 修复跨站请求 + 签名
 * MITM: scrmipg.peaksport.com
 * 重写: 抓取 querySignInfoList 获取 token/appid
 * 定时: 建议每天早上 8:00
 */
const $ = new Env('匹克签到');
const DATA_KEY = 'peak_data';
const API = 'https://scrmipg.peaksport.com';

// ========== SHA1 ==========
function sha1(str) { /* ... 完整 SHA1 实现 ... */ }
// （这里使用和上一版相同的 SHA1 函数，为节省篇幅不再重复，请复制上一版中的 sha1 函数体）

// ========== 抓取 token/appid ==========
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['token'] || '';
    const appid = headers['appid'] || 'wxb0c076d58ce4a1dd';
    const bodyStr = $request.body || '';
    if (token) {
        $.setdata(JSON.stringify({ token, appid, bodyTemplate: bodyStr }), DATA_KEY);
        $.msg($.name, '', '🎉 Token 已保存');
    }
    $.done();
}

// ========== 定时签到 ==========
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) { $.msg($.name, '❌ 未配置', '请进入匹克小程序触发抓取'); return $.done(); }
    const data = JSON.parse(raw);
    const token = data.token || '';
    const appid = data.appid || 'wxb0c076d58ce4a1dd';
    const bodyTemplate = data.bodyTemplate || '{"activityId":"d9e2bfd6-ee3b-42d2-b513-e70b5aaa37ad","source":"","shopId":"10000182"}';

    const startTime = Date.now().toString();
    const body = JSON.parse(bodyTemplate);
    const signStr = JSON.stringify(body) + startTime + token.substring(0, 8);
    const sign = sha1(signStr);

    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'ts': startTime,
        'startTime': startTime,
        'token': token,
        'sign': sign,
        'appid': appid,
        'X-TracedId': generateUUID(),
        'Referer': `https://servicewechat.com/${appid}/243/page-frame.html`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.73',
        'Host': 'scrmipg.peaksport.com'
    };

    try {
        const res = await doPost('/mobile/activity/sign/querySignInfoList', body, headers);
        console.log('响应: ' + JSON.stringify(res));
        let msg = '';
        if (res.code === '0' || res.errcode === 0) msg = '✅ 签到成功';
        else if (res.msg?.includes('重复') || res.msg?.includes('已签')) msg = '⚠️ 今天已签到';
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
            $task.fetch(opts).then(res => {
                try { resolve(JSON.parse(res.body)); } catch (e) { reject(new Error('解析失败')); }
            }).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err);
                else { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }
            });
        }
    });
}

function generateUUID() { /* ... 同上 ... */ }

function Env(name) { /* ... 同上 ... */ }

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ========== Env ==========
function Env(name) {
    const isQX = typeof $task !== 'undefined';
    const isSurge = typeof $httpClient !== 'undefined' && !isQX;
    const getdata = key => isQX ? $prefs.valueForKey(key) || '' : (isSurge ? $persistentStore.read(key) || '' : '');
    const setdata = (val, key) => { if (isQX) $prefs.setValueForKey(val, key); else if (isSurge) $persistentStore.write(val, key); };
    const msg = (t, s, m) => { if (isQX) $notify(t, s, m); else if (isSurge) $notification.post(t, s, m); console.log(t + '\n' + m); };
    const done = () => { if (typeof $done !== 'undefined') $done(); };
    return { name, getdata, setdata, msg, done };
}