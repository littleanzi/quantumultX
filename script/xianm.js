/**
 * App Store 限免监控 (多数据源 + 去重)
 * 数据源: RSSHub (主), IT之家 (备用)
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
            try { data = JSON.parse(require("fs").readFileSync("./box.dat", "utf8")); } catch (e) { }
            return data[key] || "";
        }
        return "";
    };
    const setdata = (val, key) => {
        if (isQX) $prefs.setValueForKey(val, key);
        else if (isSurge || isLoon) $persistentStore.write(val, key);
        else if (isNode) {
            let data = {};
            try { data = JSON.parse(require("fs").readFileSync("./box.dat", "utf8")); } catch (e) { }
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
const STORAGE_KEY = "free_apps_last_ids";

// 尝试多个数据源
const DATA_SOURCES = [
    {
        name: "RSSHub",
        url: "https://rsshub.app/appstore/free",
        parser: parseRSS
    },
    {
        name: "IT之家",
        url: "https://napi.ithome.com/api/appdiscount/getdiscountapps",
        parser: parseITH
    }
];

function fetchFreeApps(index = 0) {
    if (index >= DATA_SOURCES.length) {
        $.notify("限免监控", "所有数据源均失败", "请稍后重试");
        $.done();
        return;
    }

    const source = DATA_SOURCES[index];
    console.log(`正在尝试数据源: ${source.name}`);

    $.get(source.url, {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    }, (err, resp, data) => {
        if (err) {
            console.log(`${source.name} 请求失败，错误码: ${err.statusCode}, 错误信息: ${err.message}`);
            fetchFreeApps(index + 1);
            return;
        }

        try {
            const apps = source.parser(data);
            if (apps.length === 0) {
                console.log(`${source.name}: 暂无新限免应用`);
                $.done();
                return;
            }

            // 去重：读取上次推送的应用ID
            const lastIds = ($.getdata(STORAGE_KEY) || "").split(",").filter(Boolean);
            const newApps = apps.filter(app => !lastIds.includes(app.id));

            if (newApps.length === 0) {
                console.log("没有新的限免应用");
                $.done();
                return;
            }

            // 格式化推送消息
            let message = `📱 新限免 (${newApps.length}款):\n`;
            newApps.forEach((app, idx) => {
                message += `\n${idx + 1}. ${app.title}`;
                if (app.price) message += ` (原价: ${app.price})`;
                if (app.link) message += `\n   🔗 ${app.link}`;
            });

            $.notify("App Store 限时免费", "", message);

            // 更新已推送的应用ID
            const allIds = lastIds.concat(newApps.map(app => app.id));
            // 只保留最近100个ID，避免无限增长
            const trimmedIds = allIds.slice(-100);
            $.setdata(trimmedIds.join(","), STORAGE_KEY);
        } catch (e) {
            console.log(`${source.name} 解析失败: ${e}`);
            fetchFreeApps(index + 1);
            return;
        }
        $.done();
    });
}

// RSS 解析器 (适用于 RSSHub)
function parseRSS(xmlString) {
    const apps = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xmlString)) !== null) {
        const content = match[1];
        const titleMatch = content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
        const linkMatch = content.match(/<link>(.*?)<\/link>/);
        if (titleMatch && linkMatch) {
            apps.push({
                id: linkMatch[1].split("/id").pop().split("?")[0], // 提取Apple App ID作为唯一标识
                title: titleMatch[1],
                link: linkMatch[1],
                price: "" // RSSHub 可能不包含价格
            });
        }
    }
    return apps;
}

// IT之家 API 解析器
function parseITH(jsonString) {
    const apps = [];
    try {
        const json = JSON.parse(jsonString);
        if (json.status !== 1 || !json.data) return apps;

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");
        const todayStr = `${year}-${month}-${day}`;

        json.data
            .filter(app => app.dateStr === todayStr)
            .forEach(app => {
                apps.push({
                    id: app.appId || app.appUrl,
                    title: app.appName,
                    link: app.appUrl,
                    price: app.originalPrice
                });
            });
    } catch (e) {
        console.log("IT之家JSON解析错误: " + e);
    }
    return apps;
}

fetchFreeApps();