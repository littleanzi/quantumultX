/*
历史上的今天 - 查询指定日期的历史大事件（精简版）
*/

const $ = new Env('🗓️历史上的今天');

const API_KEY = 'b090b6db8d34af372136a5cddb91d069';
const API_URL = 'https://apis.tianapi.com/lishi/index';

const today = new Date();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const queryDate = `${month}${day}`;

!(async () => {
    const options = {
        url: `${API_URL}?key=${API_KEY}&date=${queryDate}`,
        method: 'GET'
    };
    try {
        const response = await $.get(options);
        const data = JSON.parse(response);
        if (data && data.code === 200 && data.result?.title) {
            const title = `${month}月${day}日 ${data.result.title}`;
            console.log(title);
            $.msg($.name, title, '');
        } else {
            const fallback = `${month}月${day}日 暂无记录`;
            console.log(fallback);
            $.msg($.name, fallback, '');
        }
    } catch (error) {
        console.log(`❌ 错误: ${error}`);
        $.msg($.name, '查询失败', '网络错误');
    }
    $.done();
})();

function Env(name) {
    return {
        name: name,
        getdata: (key) => $prefs.valueForKey(key),
        setdata: (val, key) => $prefs.setValueForKey(val, key),
        msg: (t, s, b) => $notify(t, s, b),
        get: (opt) => $task.fetch({ method: 'GET', ...opt }).then(resp => resp.body),
        post: (opt) => $task.fetch({ method: 'POST', ...opt }).then(resp => resp.body),
        done: $done
    };
}
