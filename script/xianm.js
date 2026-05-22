/**
 * App Store 限时免费监控 (备用RSSHub数据源)
 * 数据来源: RSSHub
 * 适用: Quantumult X / Surge / Loon / Node.js
 * 定时: 建议每天 8:00, 12:00, 18:00 各一次
 */

// ==================== 跨平台环境适配 (Env) ====================
function Env(name) {
    const isQX = typeof $task !== "undefined";
    const isSurge = typeof $httpClient !== "undefined" && !isQX;
    const isLoon = typeof $loon !== "undefined";
    const isNode = typeof module !== "undefined" && !isQX && !isSurge && !isLoon;

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

    const notify = (title, subtitle, message) => {
        if (isQX) $notify(title, subtitle, message);
        else if (isSurge || isLoon) $notification.post(title, subtitle, message);
        else if (isNode) console.log(`${title}\n${subtitle}\n${message}`);
    };

    const done = (value = {}) => {
        if (isQX || isSurge || isLoon) $done(value);
        else if (isNode) process.exit(0);
    };

    return { name, getdata, setdata, get, notify, done, isNode };
}

// ==================== 主逻辑 ====================
const $ = new Env("AppStore限免监控");

function fetchFreeApps() {
    // RSSHub 接口，返回 RSS 格式的限免信息
    const apiUrl = "https://rsshub.app/appstore/free";

    $.get(apiUrl, {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    }, (err, resp, data) => {
        if (err) {
            console.log(`请求失败: ${err}`);
            $.notify("限免监控", "请求失败", err.message || err);
            $.done();
            return;
        }

        try {
            // RSSHub 返回的是 RSS 格式，我们需要解析 XML
            const items = parseRSSItems(data);
            if (items.length === 0) {
                console.log("今日暂无新的限免应用");
                $.done();
                return;
            }

            let message = `📱 今日限免 (共${items.length}款):\n`;
            items.forEach((item, index) => {
                message += `\n${index + 1}. ${item.title}`;
                if (item.price) message += ` (原价: ${item.price})`;
                if (item.link) message += `\n   🔗 ${item.link}`;
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

// 简易 RSS XML 解析器（提取 <item> 中的 <title> 和 <link>）
function parseRSSItems(xmlString) {
    const items = [];
    // 匹配 <item>...</item> 块
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xmlString)) !== null) {
        const content = match[1];
        const titleMatch = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = content.match(/<link>(.*?)<\/link>/);
        if (titleMatch && linkMatch) {
            items.push({
                title: titleMatch[1],
                link: linkMatch[1]
            });
        }
    }
    return items;
}

fetchFreeApps();