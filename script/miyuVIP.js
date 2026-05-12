/**
 * 调试脚本：获取 user_info 原始响应
 * 效果：弹窗显示响应内容，并存入 QX 数据
 */
// 暴力伪造法：直接返回加密前的明文 JSON
const $ = new Env("MiYuVIP");
if ($response && $response.body) {
    // 你自己编造的“VIP 已激活”数据
    const fakeBody = JSON.stringify({
        data: {
            is_vip: true,
            vip: 1,
            vip_expire_time: 4070880000, // 2099年
            user_name: "test"
        }
    });
    $done({ body: fakeBody });
} else {
    $done({});
}
// Env 部分与之前相同，这里省略

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