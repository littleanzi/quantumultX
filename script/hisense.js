//! 名称: 签到任务（集成 jhkSign）
//! 描述: 使用 BoxJS 存储配置，调用 jhkSign 完成签名请求
//! 版本: 1.0.0
//! 类型: task

// =========================  主逻辑 =========================
const BOXJS_KEY = "sign_task_config";

async function main() {
  $.info("========== 签到任务开始 ==========");

  const config = await getConfig();
  if (!config) {
    $.msg("❌ 配置缺失", "请检查 BoxJS 中的 sign_task_config 配置");
    return;
  }

  try {
    const result = await performSignIn(config);
    if (result.success) {
      $.msg("✅ 签到成功", result.message);
      if (result.newCookie) await saveConfig({ cookie: result.newCookie });
    } else {
      $.msg("❌ 签到失败", result.message);
    }
  } catch (error) {
    $.error(`❌ 签到异常: ${error.message}`);
    $.msg("签到失败", error.message);
  }

  $.info("========== 签到任务结束 ==========");
  $done();
}

// 从 BoxJS 读取配置
async function getConfig() {
  return new Promise((resolve) => {
    $.read(BOXJS_KEY, (err, data) => {
      if (err || !data) {
        $.error("❌ 读取 BoxJS 配置失败");
        resolve(null);
      } else {
        $.info("✅ 成功读取 BoxJS 配置");
        resolve(data);
      }
    });
  });
}

// 保存配置到 BoxJS
async function saveConfig(updateData) {
  return new Promise((resolve) => {
    $.read(BOXJS_KEY, (err, oldData) => {
      let config = oldData || {};
      Object.assign(config, updateData);
      $.write(config, BOXJS_KEY, () => resolve(true));
    });
  });
}

// 执行签到请求（示例）
async function performSignIn(config) {
  if (!config.cookie) throw new Error("缺少 cookie，请在 BoxJS 中配置");

  // 示例：使用 jhkSign 生成签名链接
  let signedUrl = null;
  if (config.appKey && config.videoUrl) {
    signedUrl = jhkSign.addAntiLeech(config.appKey, config.videoUrl, 15);
    $.info(`🔗 签名链接: ${signedUrl}`);
  }

  // 实际签到请求（请替换为真实 API）
  const requestOptions = {
    url: "https://api.example.com/user/sign",
    method: "POST",
    headers: {
      "Cookie": config.cookie,
      "Content-Type": "application/json",
      "User-Agent": "Quantumult X"
    },
    body: JSON.stringify({
      timestamp: Date.now(),
      sign: config.appKey ? jhkSign.getSignStr({ user: "test" }, config.secret) : undefined
    })
  };

  return new Promise((resolve, reject) => {
    $.httpClient.post(requestOptions, (err, resp, data) => {
      if (err) return reject(new Error(`网络错误: ${err}`));
      if (resp.statusCode !== 200) return reject(new Error(`HTTP ${resp.statusCode}`));
      try {
        const json = JSON.parse(data);
        if (json.code === 0 || json.success === true)
          resolve({ success: true, message: json.msg || "签到成功" });
        else
          resolve({ success: false, message: json.msg || "签到失败" });
      } catch (e) {
        reject(new Error(`解析失败: ${e.message}`));
      }
    });
  });
}

// =========================  jhkSign 签名库 =========================
// 请在此处粘贴你提供的完整反编译代码（从 var r = require... 到末尾的 U }))
// 为了节省篇幅，此处用注释代替，实际使用时必须完整粘贴
/* ----- jhkSign 完整代码开始 ----- */
// ... 你的代码 ...
/* ----- jhkSign 完整代码结束 ----- */

// =========================  Env 兼容层（放在最后） =========================
function Env(name) {
  return new (class {
    constructor(name) {
      this.name = name;
      this.isQuanX = typeof $task !== "undefined";
      this.isSurge = typeof $httpClient !== "undefined";
      console.log(`📦 ${name} 初始化`);
    }
    log(msg) { console.log(msg); }
    info(msg) { this.log(`ℹ️ ${msg}`); }
    error(msg) { this.log(`❌ ${msg}`); }
    msg(title, subtitle = "", body = "") {
      if (this.isQuanX) $notify(title, subtitle, body);
      if (this.isSurge) $notification.post(title, subtitle, body);
      this.log(`${title} ${subtitle} ${body}`);
    }
    write(value, key, callback) {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      if (this.isQuanX) $prefs.setValueForKey(str, key);
      if (this.isSurge) $persistentStore.write(str, key);
      callback && callback();
    }
    read(key, callback) {
      let val;
      if (this.isQuanX) val = $prefs.valueForKey(key);
      if (this.isSurge) val = $persistentStore.read(key);
      try {
        const parsed = val ? JSON.parse(val) : null;
        callback && callback(null, parsed);
      } catch {
        callback && callback(null, val);
      }
    }
    get httpClient() {
      return this.isQuanX ? $task : this.isSurge ? $httpClient : null;
    }
  })(name);
}

const $ = Env("签到脚本");

// 启动
main().catch(err => { $.error(`未捕获: ${err}`); $done(); });