/*
油价查询 - 武汉市（无标题）
*/

const $ = new Env('油价查询');

const API_KEY = 'b090b6db8d34af372136a5cddb91d069';
const PROVINCE = '湖北';
const API_URL = 'https://apis.tianapi.com/oilprice/index';

!(async () => {
    const options = {
        url: API_URL,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `key=${API_KEY}&prov=${PROVINCE}`
    };
    try {
        const bodyStr = await $.post(options);
        const data = JSON.parse(bodyStr);
        if (data && data.code === 200) {
            const r = data.result;
            const msg = `92#汽油： ${r.p92}元\n95#汽油： ${r.p95}元\n0#柴油： ${r.p0}元`;
            console.log(msg);
            $.msg('武汉今日油价', '', msg);   // 标题和副标题均为空，只显示内容
        } else {
            $.msg('查询失败', '', data.msg || '接口错误');
        }
    } catch (e) {
        $.msg('查询失败', '', '网络错误');
    }
    $.done();
})();

function Env(name) {
    return {
        name: name,
        msg: (t, s, b) => $notify(t, s, b),
        post: (opt) => $task.fetch({ method: 'POST', ...opt }).then(resp => resp.body),
        done: $done
    };
}
