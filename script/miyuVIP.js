// 最小调试脚本：只确认拦截是否生效
const $ = new Env("MiYuDebug");
if ($response) {
    $.log("🔥 重写已触发！URL: " + $request.url);
    $done({});
} else {
    $.log("⚠️ 没有响应体，放行");
    $done({});
}

function Env(name) {
    const isQX = typeof $task !== "undefined";
    const log = (msg) => console.log("[MiYuDebug] " + msg);
    const done = (value = {}) => $done(value);
    return { name, log, done };
}