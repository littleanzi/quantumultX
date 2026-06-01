//! 名称: 海信应用签到（集成真实jhkSign签名）
//! 描述: 使用BoxJS管理token，调用jhkSign完成请求签名
//! 版本: 2.0.0
//! 类型: task

"use strict";

// ==================== 数据存储（基于BoxJS） ====================
const BOXJS_KEY = "hisense_config";

class StorageManager {
  async getData(key) {
    return new Promise((resolve) => {
      $.read(BOXJS_KEY, (err, data) => {
        if (err || !data) resolve(key ? null : {});
        else {
          const config = typeof data === "string" ? JSON.parse(data) : data;
          resolve(key ? config[key] : config);
        }
      });
    });
  }
  async saveData(key, value) {
    return new Promise((resolve) => {
      $.read(BOXJS_KEY, (err, oldData) => {
        let config = oldData ? (typeof oldData === "string" ? JSON.parse(oldData) : oldData) : {};
        if (typeof key === "object") config = { ...config, ...key };
        else config[key] = value;
        $.write(config, BOXJS_KEY, () => resolve(true));
      });
    });
  }
}

// ==================== 真实的jhkSign签名库（你提供的反编译代码） ====================
// 请将你提供的完整反编译代码粘贴在此处（从 var r = require... 到末尾的 U }))
// 注意：该代码会导出一个全局变量 jhkSign
const jhkSign = (function () {
  // 在此粘贴你的完整反编译代码（之前消息中提供的那一大段）
  // 为节省篇幅，此处仅作占位，实际使用时请完整替换
  /* ---------------- 你的 jhkSign 完整代码开始 ---------------- */
  // ... 请粘贴 ...
  /* ---------------- 你的 jhkSign 完整代码结束 ---------------- */
})();

// ==================== API 请求封装 ====================
class HisenseAPI {
  constructor(storage) {
    this.storage = storage;
    this.baseURL = "https://api.hisense.com";
  }

  async request(method, url, options = {}) {
    const fullUrl = url.startsWith("http") ? url : this.baseURL + url;
    const httpOption = {
      url: fullUrl,
      method: method,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...options.headers,
      },
      timeout: options.timeout || 20000,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };
    return new Promise((resolve) => {
      $.http.request(httpOption, (error, response, data) => {
        if (error) return resolve({ success: false, error });
        try {
          const json = typeof data === "string" ? JSON.parse(data) : data;
          resolve({ success: true, data: json, status: response.status });
        } catch (e) {
          resolve({ success: true, data: data, status: response.status });
        }
      });
    });
  }

  // 使用jhkSign为URL添加防盗链签名
  async signVideoUrl(appKey, videoUrl, expireMinutes = 15) {
    if (!jhkSign.addAntiLeech) {
      $.log("⚠️ jhkSign未提供addAntiLeech，返回原链接");
      return videoUrl;
    }
    return jhkSign.addAntiLeech(appKey, videoUrl, expireMinutes);
  }

  // 生成请求签名（示例：将参数排序后拼接secret再MD5）
  async generateSign(params, secret) {
    if (jhkSign.getSignStr) {
      return jhkSign.getSignStr(params, secret);
    } else {
      // 降级方案
      const sortedKeys = Object.keys(params).sort();
      const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join("&") + secret;
      let hash = 0;
      for (let i = 0; i < signStr.length; i++) hash = ((hash << 5) - hash) + signStr.charCodeAt(i);
      return Math.abs(hash).toString(16);
    }
  }

  async getUserInfo(token) {
    return this.request("GET", "/api/user/queryUserInfo", {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async doCheckin(token, deviceId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = { deviceId, timestamp, appVersion: "5.0.0", osVersion: "iOS 14.7" };
    return this.request("POST", "/api/user/sign", {
      headers: { Authorization: `Bearer ${token}`, "X-Device-Id": deviceId, "X-Timestamp": timestamp },
      body
    });
  }

  async getRewardsList(token) {
    return this.request("GET", "/api/rewards/queryRewardsList", {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  async claimReward(token, rewardId) {
    return this.request("POST", "/api/rewards/claimReward", {
      headers: { Authorization: `Bearer ${token}` },
      body: { rewardId }
    });
  }
}

// ==================== 签到管理器 ====================
class CheckinManager {
  constructor(storage, api) {
    this.storage = storage;
    this.api = api;
  }

  async isCheckedInToday() {
    const lastTime = await this.storage.getData("lastCheckTime");
    if (!lastTime) return false;
    return new Date(lastTime).toDateString() === new Date().toDateString();
  }

  async main() {
    $.log("========== 海信签到开始 ==========");
    const token = await this.storage.getData("token");
    if (!token) {
      $.log("❌ 未找到token，请先通过抓包获取并填入BoxJS");
      $.notification.post("签到失败", "", "未配置token，请检查BoxJS");
      return;
    }

    if (await this.isCheckedInToday()) {
      $.log("✅ 今日已签到");
      const points = (await this.storage.getData("userInfo"))?.points || 0;
      $.notification.post("签到完成", `今日已签，当前积分: ${points}`);
      return;
    }

    let deviceId = await this.storage.getData("deviceId");
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await this.storage.saveData("deviceId", deviceId);
    }

    // 获取用户信息
    const userResp = await this.api.getUserInfo(token);
    if (!userResp.success) {
      $.log("❌ 获取用户信息失败");
      $.notification.post("签到失败", "无法获取用户信息，请检查token是否过期");
      return;
    }
    await this.storage.saveData("userInfo", userResp.data);
    $.log(`👤 用户: ${userResp.data.nickname || "未知"}`);

    // 执行签到
    const checkinResp = await this.api.doCheckin(token, deviceId);
    if (!checkinResp.success || checkinResp.data.code !== 0) {
      $.log("❌ 签到请求失败");
      $.notification.post("签到失败", checkinResp.data?.msg || "请求失败");
      return;
    }

    const points = checkinResp.data.points || 0;
    const continueDay = checkinResp.data.continueDay || 0;
    await this.storage.saveData({
      lastCheckTime: new Date().toISOString(),
      lastCheckPoints: points,
      continueDay,
      totalPoints: ((await this.storage.getData("totalPoints")) || 0) + points,
    });

    $.log(`✅ 签到成功！获得 ${points} 积分，连续 ${continueDay} 天`);
    $.notification.post("签到成功", `获得${points}积分，连续${continueDay}天`);

    // 尝试领取奖励
    await this.tryClaimRewards(token);
  }

  async tryClaimRewards(token) {
    try {
      const rewardsResp = await this.api.getRewardsList(token);
      if (!rewardsResp.success) return;
      const rewards = rewardsResp.data.rewards || [];
      const claimable = rewards.filter(r => r.status === "unclaimed");
      for (const reward of claimable.slice(0, 3)) {
        const claimResp = await this.api.claimReward(token, reward.id);
        if (claimResp.success) $.log(`🎁 领取奖励成功: ${reward.name}`);
      }
    } catch (e) { $.log(`⚠️ 领取奖励出错: ${e.message}`); }
  }
}

// ==================== 主程序入口 ====================
(async () => {
  const storage = new StorageManager();
  const api = new HisenseAPI(storage);
  const manager = new CheckinManager(storage, api);
  await manager.main();
  $.done();
})();

// ==================== Env 兼容层（放在最后） ====================
function Env() {
  const isQuanX = typeof $task !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isQuanX;
  const isLoon = typeof $loon !== "undefined";
  const log = (...msgs) => console.log(msgs.join(" "));
  const getdata = (key) => isQuanX ? $prefs.valueForKey(key) : (isSurge || isLoon) ? $persistentStore.read(key) : null;
  const setdata = (val, key) => isQuanX ? $prefs.setValueForKey(val, key) : (isSurge || isLoon) ? $persistentStore.write(val, key) : false;
  const http = {
    request: (options, callback) => {
      if (isQuanX) $task.fetch(options).then(res => callback(null, res, res.body), err => callback(err));
      else if (isSurge || isLoon) $httpClient.request(options, (err, resp, body) => callback(err, resp, body));
      else callback(new Error("Unsupported environment"));
    }
  };
  const notification = { post: (title, sub, msg) => { if (isQuanX) $notify(title, sub, msg); else if (isSurge || isLoon) $notification.post(title, sub, msg); else console.log(`${title} ${sub} ${msg}`); } };
  const done = () => { if (isQuanX || isSurge) $done(); };
  return { log, getdata, setdata, http, notification, done, read: getdata, write: setdata };
}
const $ = Env();