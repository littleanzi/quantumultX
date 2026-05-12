/**
 * 调试脚本：获取 user_info 原始响应
 * 效果：弹窗显示响应内容，并存入 QX 数据
 */
const $ = new Env("MiYuDebug");
if ($response && $response.body) {
    const body = $response.body;
    // 弹窗显示前 500 个字符
    $.msg("调试成功", "原始响应", body.substring(0, 500));
    // 存入 QX 数据，方便查看完整内容
    $.write("miyu_response", body);
    console.log("[MiYuDebug] 完整响应: " + body);
    $done({});
} else {
    $.msg("调试失败", "无响应体", "请确认重写规则是否匹配");
    $done({});
}

function Env(name) {
    const isQX = typeof $task !== 'undefined';
    const read = (key) => isQX ? $prefs.valueForKey(key) : null;
    const write = (key, value) => {
        if (isQX) $prefs.setValueForKey(value, key);
    };
    const msg = (title, subtitle, message) => {
        if (isQX) $notify(title, subtitle, message);
    };
    const done = (val) => { if (typeof $done !== 'undefined') $done(val); };
    return { name, read, write, msg, done };
}