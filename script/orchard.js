/**
 * 多多果园自动任务 (最终版 - 自动更新 tubetoken)
 * 域名: api.pinduoduo.com
 * 重写: 抓取请求中的 AccessToken、anti-token、Cookie、tubetoken
 * 数据存储: orchard_data (多账号用 @ 分隔)
 */

const $ = new Env('多多果园');
const DATA_KEY = 'orchard_data';
const API = 'https://api.pinduoduo.com';

// ========== 1. 抓取凭证 (自动更新 tubetoken) ==========
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['AccessToken'] || headers['accesstoken'] || '';
    const antiToken = headers['anti-token'] || '';
    const cookie = headers['Cookie'] || '';
    let body = {};
    try { body = JSON.parse($request.body || '{}'); } catch (e) { body = {}; }
    const tubetoken = body.tubetoken || '';

    if (token && antiToken) {
        const uidMatch = cookie.match(/api_uid=([^;]+)/);
        const uid = uidMatch ? uidMatch[1] : '';
        // 格式: token|antiToken|cookie|uid|tubetoken
        const line = `${token}|${antiToken}|${cookie}|${uid}|${tubetoken}`;
        let saved = $.getdata(DATA_KEY) || '';
        let accounts = saved ? saved.split('@') : [];
        const idx = accounts.findIndex(acc => {
            const parts = acc.split('|');
            // 按 uid 去重
            return parts[3] === uid;
        });
        if (idx !== -1) {
            // 更新旧账号（保留最新的 tubetoken）
            accounts[idx] = line;
        } else {
            accounts.push(line);
        }
        $.setdata(accounts.join('@'), DATA_KEY);
        $.msg($.name, '', `🎉 账号 ${uid} 已保存`);
    }
    $.done();
}

// ========== 2. 定时任务 ==========
(async () => {
    const raw = $.getdata(DATA_KEY) || '';
    if (!raw) {
        $.msg($.name, '❌ 未配置', '请先打开多多果园页面抓取凭证');
        $.done();
        return;
    }

    const accounts = raw.split('@').filter(Boolean);
    let totalMsg = '';

    for (let i = 0; i < accounts.length; i++) {
        const parts = accounts[i].split('|');
        const token = parts[0];
        const antiToken = parts[1];
        const cookie = parts[2];
        const uid = parts[3];
        const tubetoken = parts[4] || '';

        console.log(`\n===== 账号 ${i + 1} (${uid}) =====`);

        // 请求头 (与抓包完全一致)
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-Hans-CN;q=1',
            'AccessToken': token,
            'Content-Type': 'application/json;charset=UTF-8',
            'Cookie': cookie,
            'anti-token': antiToken,
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            'Referer': 'https://m.pinduoduo.net/cartoon_fruiter.html',
            'PDD-CONFIG': 'V4:002.080500'
        };

        try {
            // 查询水分
            const waterBody = {
                "fun_pl": 11,
                "tubetoken": tubetoken
            };
            const waterRes = await doPost(
                `/api/manor-gateway/manor/query/user/water?pdduid=${uid}`,
                waterBody,
                headers
            );
            console.log('水分查询响应: ' + JSON.stringify(waterRes));

            let waterAmount = 0;
            if (waterRes && waterRes.water_amount !== undefined) {
                waterAmount = waterRes.water_amount;
            }

            // 查询果树状态
            const treeBody = {
                "part_id_list": [102],
                "source": "",
                "fun_pl": 11,
                "tubetoken": tubetoken
            };
            const treeRes = await doPost(
                `/api/manor-query/tree/part/get?pdduid=${uid}`,
                treeBody,
                headers
            );
            const treeOk = treeRes && treeRes.error_code === null && treeRes.error_msg === null;
            console.log(`果树查询: ${treeOk ? '✅ 成功' : '❌ 失败'}`);

            let accMsg = `账号${i + 1}: 💧 水分 ${waterAmount}`;
            if (treeOk) accMsg += ` | 🌳 果树状态正常`;
            totalMsg += accMsg + '\n';
        } catch (e) {
            totalMsg += `账号${i + 1}: 异常 ${e.message}\n`;
            console.error(e);
        }

        await sleep(3000);
    }

    if (totalMsg) $.msg($.name, '', totalMsg);
    $.done();
})();

// ========== 工具函数 ==========
function doPost(path, body, headers) {
    const url = API + path;
    return new Promise((resolve, reject) => {
        const opts = {
            url, method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            timeout: 30000
        };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => {
                try { resolve(JSON.parse(res.body)); } catch (e) { reject(e); }
            }).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err);
                else { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }
            });
        }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== 环境适配 (Env) ==========
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