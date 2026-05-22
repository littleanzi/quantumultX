/**
 * App Store 限时免费监控
 * 数据来源: IT之家限免API
 */

// ==================== 跨平台环境适配 (Env) ====================
function Env(name) {
    const isQX = typeof $task !== "undefined";
    const isSurge = typeof $httpClient !== "undefined" && !isQX;
    const isLoon = typeof $loon !== "undefined";
    const isNode = typeof module !== "undefined" && !isQX && !isSurge && !isLoon;

    // 读取持久化数据
    const getdata = (key) => {
        if (isQX) return $prefs.valueForKey(key) || "";
        if (isSurge || isLoon) return $persistentStore.read(key) || "";
        if (isNode) {
            let data = {};
            try { data = JSON.parse(require("fs").readFileSync("./box.dat", "utf8")); } catch (e) {}
            return data[key] || "";
        }
        return "";
    };
    // 写入持久化数据
    const setdata = (val, key) => {
        if (isQX) $prefs.setValueForKey(val, key);
        else if (isSurge || isLoon) $persistentStore.write(val, key);
        else if (isNode) {
            let data = {};
            try { data = JSON.parse(require("fs").readFileSync("./box.dat", "utf8")); } catch (e) {}
            data[key] = val;
            require("fs").writeFileSync("./box.dat", JSON.stringify(data));
        }
    };

    // GET 请求
    const get = (url, headers = {}, callback) => {
        const options = { url, headers };
        if (isQX) {
            options.method = "GET";
            $task.fetch(options).then(
                (res) => callback(null, res, res.body),
                (err) => callback(err)
            );
        } else if (isSurge || isLoon) {
            $httpClient.get(options, (err, resp, data) => callback(err, resp, data));
        } else if (isNode) {
            const got = require("got");
            got.get(url, { headers }).then(
                (resp) => callback(null, resp, resp.body),
                (err) => callback(err)
            );
        }
    };

    // 通知
    const notify = (title, subtitle, message) => {
        if (isQX) $notify(title, subtitle, message);
        else if (isSurge || isLoon) $notification.post(title, subtitle, message);
        else if (isNode) console.log(`${title}\n${subtitle}\n${message}`);
    };

    // 结束
    const done = (value = {}) => {
        if (isQX || isSurge || isLoon) $done(value);
        else if (isNode) process.exit(0);
    };

    return { name, getdata, setdata, get, notify, done, isNode };
}

// ==================== 主逻辑 ====================
const $ = new Env("AppStore限免监控");

async function fetchDiscountApps() {
    const apiUrl = "https://napi.ithome.com/api/appdiscount/getdiscountapps";

    $.get(apiUrl, {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    }, async (err, resp, data) => {
        if (err) {
            console.log(`请求失败: ${err}`);
            $.done();
            return;
        }

        try {
            const json = JSON.parse(data);
            if (json.status !== 1 || !json.data) {
                $.notify("限免监控", "数据异常", "API返回状态不正常");
                $.done();
                return;
            }

            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, "0");
            const day = String(today.getDate()).padStart(2, "0");
            const todayStr = `${year}-${month}-${day}`;  // 格式 2025-06-22

            // 筛选出今天限免的应用
            const todayApps = json.data.filter(app => app.dateStr === todayStr);

            if (todayApps.length === 0) {
                console.log("今日暂无新的限免应用");
                $.done();
                return;
            }

            // 格式化推送消息
            let message = `📱 今日限免 (共${todayApps.length}款):\n`;
            todayApps.forEach((app, index) => {
                message += `\n${index + 1}. ${app.appName}  (原价 ¥${app.originalPrice})`;
                if (app.currentPrice !== "0.00") {
                    message += ` → 现价 ¥${app.currentPrice}`;
                }
                if (app.expireDate) {
                    message += `\n   截止: ${app.expireDate}`;
                }
                // 将链接简化显示或直接输出
                message += `\n   🔗 ${app.appUrl || "无"}`;
            });

            $.notify("App Store 限时免费", "", message);
        } catch (e) {
            console.log(`解析失败: ${e}`);
            $.notify("限免监控", "解析错误", e.message);
        } finally {
            $.done();
        }
    });
}

fetchDiscountApps();