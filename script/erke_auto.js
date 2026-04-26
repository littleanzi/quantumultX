/*
鸿星尔克签到 - 自动抓取请求体 + 自动签到
完全不依赖 Cookie，只依赖请求体中的动态参数
*/

const $ = new Env('鸿星尔克');
const BOXJS_APP = 'erke';
const BODY_KEY = 'sign_body';
const SIGN_URL = 'https://hope.demogic.com/gic-wx-app/sign/member_sign.json';

function getBox(key) { return $.getdata(`@${BOXJS_APP}.${key}`) || ''; }
function setBox(key, val) { $.setdata(val, `@${BOXJS_APP}.${key}`); }

// ========== 抓取阶段（打开小程序手动签到一次触发） ==========
if (typeof $request !== 'undefined') {
    let body = $request.body;
    if (body) {
        try { JSON.parse(body); setBox(BODY_KEY, body); } catch(e) {}
        console.log(`📦 已捕获签到请求体，长度 ${body.length}`);
        $.msg($.name, '✅ 签到参数已更新', '请求体已保存');
    }
    $.done();
    return;
}

// ========== 签到阶段 ==========
!(async () => {
    let body = getBox(BODY_KEY);
    if (!body) {
        console.log('❌ 请先打开鸿星尔克小程序并手动签到一次');
        $.msg($.name, '提示', '请打开小程序并手动签到');
        $.done();
        return;
    }
    const result = await postRequest(SIGN_URL, body);
    if (result && (result.code === '0' || result.code === 0)) {
        console.log(`✅ 签到成功`);
        let award = 0;
        if (result.result?.memberSignCalendar) {
            const today = result.result.memberSignCalendar.find(d => d.currentDayFlag === 1);
            if (today?.memberSignAwards) {
                award = today.memberSignAwards.reduce((s, a) => s + (a.type === 'integral' ? a.count : 0), 0);
            }
        }
        console.log(`🎉 获得积分: +${award}`);
        $.msg($.name, '签到成功', `获得 ${award} 积分`);
    } else if (result && (result.code === '1001' || result.code === 1001)) {
        console.log(`ℹ️ 今日已签到过`);
        $.msg($.name, '签到结果', '今日已签到');
    } else {
        console.log(`⚠️ 签到失败: ${result?.message || result?.errmsg || '未知错误'}`);
        $.msg($.name, '签到失败', result?.message || '未知错误');
    }
    $.done();
})();

function postRequest(url, body) {
    return new Promise(resolve => {
        $.post({
            url: url,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'channelEntrance': 'wx_app',
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.71'
            },
            body: body
        }, (err, resp, data) => {
            if (err) { resolve(null); return; }
            try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
        });
    });
}

// Env 兼容层（精简版，支持 $task 和 $prefs）
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
