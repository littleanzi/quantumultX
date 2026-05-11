/**
 * 多多果园自动任务 (修复版 - 补全请求体参数)
 */
const $ = new Env('多多果园');
const DATA_KEY = 'orchard_data';
const API = 'https://api.pinduoduo.com';

// ========== 1. 抓取凭证 ==========
if (typeof $request !== 'undefined') {
    const headers = $request.headers;
    const token = headers['AccessToken'] || headers['accesstoken'] || '';
    const antiToken = headers['anti-token'] || '';
    const cookie = headers['Cookie'] || '';

    if (token && antiToken) {
        const uidMatch = cookie.match(/api_uid=([^;]+)/);
        const uid = uidMatch ? uidMatch[1] : '';
        const line = `${token}|${antiToken}|${cookie}|${uid}`;
        let saved = $.getdata(DATA_KEY) || '';
        let accounts = saved ? saved.split('@') : [];
        const idx = accounts.findIndex(acc => {
            const parts = acc.split('|');
            return parts[3] === uid;
        });
        if (idx !== -1) {
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

        console.log(`\n===== 账号 ${i + 1} (${uid}) =====`);

        // 请求头 (与你的截图一致)
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
            // 查询水分 (补全请求体)
            const waterBody = {
                "fun_pl": 11,
                "tubetoken": "G%2FnqHzajeywRPN8qQiQGteKMGYvIoE%2FBX0zhOiSk3z51%2BzFJQ5q7ZMfBXsvwfPPbo5wv1CXtnLHKwQLjnEKWZ3H8BdhX0gesZcs40acrwaCnRh2%2FSvM4gaOEjK4YfLoXezVlLGA9M3DHw3dPkIIKfe7tYaU4yQFEdFL9qmjcihbrqeu%2FND%2Bj464ykCpk9NxBpow%2F12tkbhaa0MPG%2BkFmYHVrGCFjMA%2FPasnmsS%2FDcFQ8eB7OceIAhgHyaTQD7po9D4i7d8cY4AISQ7tPPcmdI6bplghQi38GAXzBwkM%2Bca4%3D"
            };
            
            console.log('请求体预览: ' + JSON.stringify(waterBody).substring(0, 100) + '...');
            const waterRes = await doPost(
                `/api/manor-gateway/manor/query/user/water?pdduid=${uid}`,
                waterBody,
                headers
            );
            console.log('水分查询完整响应: ' + JSON.stringify(waterRes));

            // 查询果树状态
            const treeBody = {
                "part_id_list": [102],
                "source": "",
                "fun_pl": 11,
                "tubetoken": waterBody.tubetoken
            };
            const treeRes = await doPost(
                `/api/manor-query/tree/part/get?pdduid=${uid}`,
                treeBody,
                headers
            );
            console.log('果树查询完整响应: ' + JSON.stringify(treeRes));

            let accMsg = `账号${i + 1}: `;
            if (waterRes.success) {
                accMsg += `水分 ${waterRes.data?.water || 0}💧 `;
            } else {
                accMsg += '水分查询失败 ';
            }
            if (treeRes.success) {
                accMsg += '果树查询成功';
            }

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
    console.log('请求 URL: ' + url);
    return new Promise((resolve, reject) => {
        const opts = {
            url, method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
            timeout: 30000
        };
        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(res => {
                console.log('响应状态码: ' + res.statusCode);
                try { resolve(JSON.parse(res.body)); } catch (e) { reject(e); }
            }).catch(reject);
        } else {
            $httpClient.post(opts, (err, resp, data) => {
                if (err) reject(err);
                else {
                    console.log('响应状态码: ' + (resp ? resp.statusCode : 'unknown'));
                    try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                }
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