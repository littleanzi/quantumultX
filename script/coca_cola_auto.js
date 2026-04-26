/*
可口可乐吧签到 - 自动抓取 + 自动签到
- 重写规则触发：保存 Cookie 和请求体到 BoxJS
- 定时任务触发：使用保存的数据执行签到
*/

const $ = new Env('可口可乐吧');
const BOXJS_APP = 'coca_cola';
const COOKIE_KEY = 'cookie';
const SIGN_BODY_KEY = 'sign_body';
const SIGN_URL = 'https://member-api.icoke.cn/api/icoke-sign/icoke/mini/sign/main/sign';

// BoxJS 读写封装
function getBox(key) { return $.getdata(`@${BOXJS_APP}.${key}`) || ''; }
function setBox(key, val) { $.setdata(val, `@${BOXJS_APP}.${key}`); }

// ========== 阶段一：重写抓取（打开小程序时自动触发） ==========
if (typeof $request !== 'undefined') {
    // 保存 Cookie
    let cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) setBox(COOKIE_KEY, cookie);
    // 保存请求体（签到 body）
    let body = $request.body;
    if (body && $request.url.includes('/sign')) {
        try { JSON.parse(body); setBox(SIGN_BODY_KEY, body); } catch(e) {}
    }
    console.log(`📦 已捕获签到数据 (Cookie长度:${cookie.length}, Body长度:${body?.length || 0})`);
    $.msg($.name, '✅ 签到参数已更新', 'Cookie和请求体已保存');
    $.done();
    return;
}

// ========== 阶段二：定时签到（每天自动执行） ==========
!(async () => {
    const cookie = getBox(COOKIE_KEY);
    const signBody = getBox(SIGN_BODY_KEY);
    if (!cookie || !signBody) {
        console.log('❌ 尚未捕获到签到数据，请打开可口可乐吧小程序并手动签到一次');
        $.msg($.name, '提示', '请先打开小程序并手动签到');
        $.done();
        return;
    }
    console.log(`🔔 开始执行签到`);
    const result = await doSign(cookie, signBody);
    if (result && (result.code === 200 || result.code === '200')) {
        console.log(`✅ 签到成功`);
        $.msg($.name, '签到成功', '获得积分');
    } else if (result && (result.code === 1001 || result.msg?.includes('已签到'))) {
        console.log(`ℹ️ 今日已签到过`);
        $.msg($.name, '签到结果', '今日已签到');
    } else {
        console.log(`⚠️ 签到失败: ${JSON.stringify(result)}`);
        $.msg($.name, '签到失败', result?.msg || '未知错误');
    }
    $.done();
})();

function doSign(cookie, body) {
    return new Promise(resolve => {
        $.post({
            url: SIGN_URL,
            headers: {
                'Cookie': cookie,
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.51'
            },
            body: body
        }, (err, resp, data) => {
            if (err) { resolve(null); return; }
            try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
        });
    });
}

// Env 兼容层（精简版，支持 Quantumult X 的 $prefs 和 $task）
function Env(name) {
    return {
        name: name,
        getdata: (key) => $prefs.valueForKey(key),
        setdata: (val, key) => $prefs.setValueForKey(val, key),
        msg: (t, s, b) => $notify(t, s, b),
        get: (o, cb) => $task.fetch({method:'GET',...o}).then(r=>cb(null,r,r.body), e=>cb(e,null,null)),
        post: (o, cb) => $task.fetch({method:'POST',...o}).then(r=>cb(null,r,r.body), e=>cb(e,null,null)),
        done: $done
    };
}
