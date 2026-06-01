/**
 * 海信应用签到脚本 - QuantumultX & Surge & Loon
 * 功能：自动签到，获取积分
 * 作者: Auto-Generated
 * 更新时间: 2024-01-01
 * 
 * ========== QuantumultX ==========
 * [task_local]
 * # 海信应用签到
 * 0 8 * * * https://raw.githubusercontent.com/yourname/scripts/main/hisense_checkin.js, tag=海信签到, img-url=https://q1.qlogo.cn/g?b=qq&nk=0&s=100, enabled=true
 *
 * [rewrite_local]
 * # 海信API代理
 * ^https:\/\/api\.hisense\.com\/api\/user\/queryUserInfo url script-response-body https://raw.githubusercontent.com/yourname/scripts/main/hisense_checkin.js
 *
 * [mitm]
 * hostname = api.hisense.com
 * 
 * ========== Surge ==========
 * [Script]
 * 海信签到 = type=http-request, pattern=^https:\/\/api\.hisense\.com\/api\/user\/queryUserInfo, script-path=hisense_checkin.js, timeout=10
 * 海信签到 = type=cron, cronexp="0 8 * * *", script-path=hisense_checkin.js, timeout=10
 *
 * ========== Loon ==========
 * [Script]
 * http-request ^https:\/\/api\.hisense\.com\/api\/user\/queryUserInfo script-path=hisense_checkin.js, timeout=10, tag=海信API
 * cron "0 8 * * *" script-path=hisense_checkin.js, tag=海信签到
 */

"use strict";

// ==================== 环境适配 ====================
const $ = new Env();

// ==================== 常量定义 ====================
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15",
  "Content-Type": "application/json;charset=UTF-8",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

const API_BASE = "https://api.hisense.com";
const ENDPOINTS = {
  login: "/api/user/login",
  checkin: "/api/user/sign",
  queryUser: "/api/user/queryUserInfo",
  getRewards: "/api/rewards/queryRewardsList",
  claimReward: "/api/rewards/claimReward",
};

// ==================== 数据存储 ====================
class StorageManager {
  constructor() {
    this.storageKey = "hisense_checkin";
    this.boxjsKey = `${this.storageKey}_boxjs`;
  }

  // 获取存储的数据
  getData(key) {
    try {
      const data = $.getdata(this.storageKey);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return key ? parsed[key] : parsed;
    } catch (e) {
      $.log("获取数据失败: " + e);
      return null;
    }
  }

  // 保存数据
  saveData(key, value) {
    try {
      let data = this.getData() || {};
      if (typeof key === "object") {
        data = { ...data, ...key };
      } else {
        data[key] = value;
      }
      $.setdata(JSON.stringify(data), this.storageKey);
      return true;
    } catch (e) {
      $.log("保存数据失败: " + e);
      return false;
    }
  }

  // 获取所有数据
  getAllData() {
    return this.getData() || {};
  }

  // 清除所有数据
  clearData() {
    $.setdata("", this.storageKey);
    return true;
  }

  // 删除特定数据
  removeData(key) {
    try {
      let data = this.getData() || {};
      delete data[key];
      $.setdata(JSON.stringify(data), this.storageKey);
      return true;
    } catch (e) {
      return false;
    }
  }
}

// ==================== 加密签名 ====================
class SignHelper {
  // MD5 实现 (简化版，用于演示)
  static md5(text) {
    // 在实际使用中，应使用完整的MD5库
    // 这里使用一个简单的哈希示例
    const hash = require("crypto").createHash("md5");
    return hash.update(text).digest("hex");
  }

  // 生成签名字符串
  static generateSignStr(params, appSecret) {
    // 按照键名排序
    const sortedKeys = Object.keys(params).sort();
    const signStr = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    // 添加appSecret
    return signStr + appSecret;
  }

  // 获取时间戳
  static getTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
  }

  // 生成请求签名
  static generateSign(data, appSecret) {
    const signStr = this.generateSignStr(data, appSecret);
    // 使用简单的hash作为签名示例
    let hash = 0;
    for (let i = 0; i < signStr.length; i++) {
      const char = signStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32位整数
    }
    return Math.abs(hash).toString(16);
  }

  // 用于特定的反编译文件中的签名机制
  static getSignStrWithJSON(jsonStr, appSecret) {
    const plainStr = typeof jsonStr === "string" ? jsonStr : JSON.stringify(jsonStr);
    const baseStr = plainStr + appSecret;
    return this.md5(baseStr);
  }
}

// ==================== API 请求 ====================
class HisenseAPI {
  constructor(storage) {
    this.storage = storage;
    this.baseURL = API_BASE;
  }

  // 发送 HTTP 请求
  async request(method, url, options = {}) {
    const fullURL = url.startsWith("http") ? url : this.baseURL + url;
    const httpOption = {
      url: fullURL,
      method: method,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      timeout: options.timeout || 20000,
    };

    if (options.body) {
      httpOption.body = JSON.stringify(options.body);
    }

    if (options.form) {
      httpOption.body = new URLSearchParams(options.form).toString();
      httpOption.headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    return new Promise((resolve) => {
      $.http.request(httpOption, (error, response, data) => {
        if (error) {
          $.log(`请求出错: ${error}`);
          resolve({ success: false, error: error, data: null });
          return;
        }

        try {
          const result = typeof data === "string" ? JSON.parse(data) : data;
          resolve({ success: true, data: result, status: response.status });
        } catch (e) {
          $.log(`解析响应失败: ${e}`);
          resolve({ success: true, data: data, status: response.status });
        }
      });
    });
  }

  // 获取用户信息
  async getUserInfo(token) {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    return this.request("GET", ENDPOINTS.queryUser, { headers });
  }

  // 执行签到
  async doCheckin(token, deviceId) {
    const timestamp = SignHelper.getTimestamp();
    const body = {
      deviceId: deviceId,
      timestamp: timestamp,
      appVersion: "5.0.0",
      osVersion: "iOS 14.7",
    };

    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Device-Id": deviceId,
      "X-Timestamp": timestamp,
    };

    return this.request("POST", ENDPOINTS.checkin, {
      body,
      headers,
    });
  }

  // 获取奖励列表
  async getRewardsList(token) {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    return this.request("GET", ENDPOINTS.getRewards, { headers });
  }

  // 领取奖励
  async claimReward(token, rewardId) {
    const body = { rewardId };
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    return this.request("POST", ENDPOINTS.claimReward, {
      body,
      headers,
    });
  }
}

// ==================== 签到逻辑 ====================
class CheckinManager {
  constructor(storage, api) {
    this.storage = storage;
    this.api = api;
  }

  // 检查是否已签到
  isCheckedInToday() {
    const lastCheckTime = this.storage.getData("lastCheckTime");
    if (!lastCheckTime) return false;

    const lastDate = new Date(lastCheckTime).toDateString();
    const todayDate = new Date().toDateString();

    return lastDate === todayDate;
  }

  // 主要签到流程
  async main() {
    $.log("========== 海信应用签到 开始 ==========");

    try {
      // 1. 获取保存的令牌
      const token = this.storage.getData("token");
      const deviceId = this.storage.getData("deviceId") || this.generateDeviceId();

      if (!token) {
        $.log("❌ 未找到保存的token，请先登录");
        return this.notifyUser("❌ 签到失败", "未找到保存的token，请检查配置");
      }

      // 2. 检查今日是否已签到
      if (this.isCheckedInToday()) {
        $.log("✅ 今天已签到过了");
        const userInfo = this.storage.getData("userInfo") || {};
        return this.notifyUser(
          "✅ 签到完成",
          `今天已签到过了\n积分: ${userInfo.points || 0}分`
        );
      }

      // 3. 获取用户信息
      const userResponse = await this.api.getUserInfo(token);
      if (!userResponse.success || !userResponse.data) {
        $.log("❌ 获取用户信息失败");
        return this.notifyUser("❌ 签到失败", "获取用户信息失败");
      }

      const userData = userResponse.data;
      this.storage.saveData("userInfo", userData);
      $.log(`👤 用户: ${userData.nickname || "未知"}`);

      // 4. 执行签到
      const checkinResponse = await this.api.doCheckin(token, deviceId);
      if (!checkinResponse.success) {
        $.log("❌ 签到请求失败");
        return this.notifyUser("❌ 签到失败", "签到请求失败");
      }

      const checkinData = checkinResponse.data;
      const points = checkinData.points || checkinData.score || 0;
      const continueDay = checkinData.continueDay || 0;

      // 5. 保存签到记录
      this.storage.saveData({
        lastCheckTime: new Date().toISOString(),
        lastCheckPoints: points,
        continueDay: continueDay,
        totalPoints: (this.storage.getData("totalPoints") || 0) + points,
      });

      $.log(`✅ 签到成功！获得 ${points} 积分`);
      $.log(`🔥 连续签到: ${continueDay} 天`);

      // 6. 尝试领取奖励
      await this.tryClaimRewards(token);

      // 7. 发送通知
      this.notifyUser(
        "✅ 签到成功",
        `获得 ${points} 积分\n连续签到: ${continueDay} 天\n总积分: ${this.storage.getData("totalPoints")} 分`
      );
    } catch (error) {
      $.log(`❌ 签到出错: ${error}`);
      this.notifyUser("❌ 签到异常", error.message || "未知错误");
    }
  }

  // 尝试领取奖励
  async tryClaimRewards(token) {
    try {
      const rewardsResponse = await this.api.getRewardsList(token);
      if (!rewardsResponse.success || !rewardsResponse.data) {
        return;
      }

      const rewards = rewardsResponse.data.rewards || [];
      const claimableRewards = rewards.filter((r) => r.status === "unclaimed");

      if (claimableRewards.length === 0) {
        $.log("ℹ️  没有可领取的奖励");
        return;
      }

      for (const reward of claimableRewards.slice(0, 3)) {
        const claimResponse = await this.api.claimReward(token, reward.id);
        if (claimResponse.success) {
          $.log(`🎁 领取奖励成功: ${reward.name}`);
        }
      }
    } catch (error) {
      $.log(`⚠️  领取奖励出错: ${error}`);
    }
  }

  // 生成设备ID
  generateDeviceId() {
    const deviceId = this.storage.getData("deviceId");
    if (deviceId) return deviceId;

    const newDeviceId = `device_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    this.storage.saveData("deviceId", newDeviceId);
    return newDeviceId;
  }

  // 发送通知
  notifyUser(title, message) {
    $.notification.post(title, "", message);
    $.log(`${title}\n${message}`);
  }
}

// ==================== 中间件处理 ====================
function interceptRequest() {
  $.log("========== API 拦截 开始 ==========");

  // 从请求头提取信息
  const requestBody = $.request.body || "{}";
  const responseBody = $.response.body || "{}";

  try {
    const data = JSON.parse(responseBody);

    if (data.token) {
      const storage = new StorageManager();
      storage.saveData("token", data.token);
      $.log("✅ 令牌已保存");
    }

    if (data.user) {
      const storage = new StorageManager();
      storage.saveData("userInfo", data.user);
      $.log("✅ 用户信息已保存");
    }
  } catch (e) {
    $.log(`⚠️  拦截处理出错: ${e}`);
  }
}

// ==================== 主程序入口 ====================
async function main() {
  $.log("🚀 海信签到脚本启动");

  const storage = new StorageManager();
  const api = new HisenseAPI(storage);
  const checkinManager = new CheckinManager(storage, api);

  // 判断运行环境
  if (typeof $response !== "undefined" && $response) {
    // 中间件模式 - 拦截API响应
    interceptRequest();
  } else if (typeof $request !== "undefined" && $request) {
    // 请求拦截模式
    $.log("请求拦截模式");
    interceptRequest();
  } else {
    // 定时任务模式 - 执行签到
    await checkinManager.main();
  }

  $.done();
}

// ==================== Env 类定义 ====================
function Env() {
  const isQuanX = typeof $task !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isQuanX;
  const isLoon = typeof $loon !== "undefined";
  const isNode = typeof require === "function" && !isQuanX && !isSurge && !isLoon;

  const log = (message) => {
    if (isQuanX) $task.log(message);
    else if (isSurge) $notification.post("日志", "", message);
    else if (isLoon) $loon.log(message);
    else if (isNode) console.log(message);
  };

  const getdata = (key) => {
    if (isQuanX) return $prefs.valueForKey(key);
    if (isSurge) return $persistentStore.read(key);
    if (isLoon) return $persistentStore.read(key);
    if (isNode) {
      const fs = require("fs");
      const path = `${process.env.HOME}/hisense_data.json`;
      if (!fs.existsSync(path)) return null;
      const data = JSON.parse(fs.readFileSync(path, "utf8"));
      return data[key] ? JSON.stringify(data[key]) : null;
    }
    return null;
  };

  const setdata = (value, key) => {
    if (isQuanX) return $prefs.setValueForKey(value, key);
    if (isSurge) $persistentStore.write(value, key);
    if (isLoon) $persistentStore.write(value, key);
    if (isNode) {
      const fs = require("fs");
      const path = `${process.env.HOME}/hisense_data.json`;
      const data = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8")) : {};
      data[key] = JSON.parse(value);
      fs.writeFileSync(path, JSON.stringify(data, null, 2));
    }
    return true;
  };

  const http = {
    request: (options, callback) => {
      if (isQuanX) {
        $task.fetch(options).then(
          (response) => {
            callback(null, response, response.body);
          },
          (error) => {
            callback(error);
          }
        );
      } else if (isSurge || isLoon) {
        $httpClient.request(options, (error, response, body) => {
          callback(error, { status: response.status }, body);
        });
      } else if (isNode) {
        const https = require("https");
        const url = new URL(options.url);
        const reqOptions = {
          hostname: url.hostname,
          port: 443,
          path: url.pathname + url.search,
          method: options.method || "GET",
          headers: options.headers || {},
        };
        https
          .request(reqOptions, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => callback(null, { status: res.statusCode }, body));
          })
          .on("error", callback)
          .end(options.body);
      }
    },
  };

  const notification = {
    post: (title, subtitle, message) => {
      if (isQuanX) {
        $notify(title, subtitle, message);
      } else if (isSurge || isLoon) {
        $notification.post(title, subtitle, message);
      } else if (isNode) {
        console.log(`[${title}] ${subtitle}\n${message}`);
      }
    },
  };

  const done = () => {
    if (isQuanX) $done();
    if (isSurge) $done();
    if (isLoon) $done();
  };

  return {
    isQuanX,
    isSurge,
    isLoon,
    isNode,
    log,
    getdata,
    setdata,
    http,
    notification,
    done,
    request: options => http.request(options, () => { }),
  };
}

// ==================== 执行主程序 ====================
if (typeof $response !== "undefined") {
  // API 响应拦截
  main();
} else {
  // 定时任务执行
  main();
}
