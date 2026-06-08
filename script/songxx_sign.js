/*
 * 松鲜鲜·签到脚本
 * 2026-06-09 版本: 3.0.0
 * MITM 域名: open.youzan.com, h5.youzan.com
 * 重写规则 (Rewrite): ^https:\/\/(open\.youzan\.com|h5\.youzan\.com)\/.*
 * 算法: MITM 抓取 Cookie/Token → Youzan API 签到
 * [rewrite_local]
 * ^https:\/\/(open\.youzan\.com|h5\.youzan\.com)\/.* url script-request-header songxx_sign.js
 * [task_local]
 * 0 9 * * * songxx_sign.js, tag=松鲜鲜签到, img-url=https://img01.yzcdn.cn/upload_files/2023/07/03/FtFv4zB9O7vAuHxsgdLpP0uSRHBF.png, enabled=true
 * [MITM]
 * hostname = open.youzan.com, h5.youzan.com
 */

// ====== 存储 Key ======
var CONFIG = {
  ACCESS_TOKEN: "songxx_access_token",
  KDT_ID: "songxx_kdt_id",
  APP_ID: "songxx_app_id",
  LAST_SIGN: "songxx_last_sign",
  SIGN_COUNT: "songxx_sign_count",
  BOXJS: "songxx_sign_data"
};

var BASE_URL = "https://h5.youzan.com/wscump/checkin";

// ====== 主入口 ======
if (typeof $task !== "undefined" && $task.fetch) {
  main();
} else if (typeof $request !== "undefined") {
  capture();
} else {
  $done({});
}

// ====== 重写捕获逻辑 ======
function capture() {
  var url = $request.url;
  var headers = $request.headers;

  // 从 Extra-Data 提取信息
  var extraData = headers["Extra-Data"];
  if (extraData) {
    try {
      var extra = JSON.parse(extraData);
      if (extra.sid) {
        $prefs.setValueForKey(extra.sid, CONFIG.ACCESS_TOKEN);
        log("捕获 sid: " + extra.sid);
      }
    } catch (e) {}
  }

  // 从 URL 参数提取 access_token, kdt_id, app_id
  try {
    var urlObj = new URL(url);
    var token = urlObj.searchParams.get("access_token");
    var kdtId = urlObj.searchParams.get("kdt_id");
    var appId = urlObj.searchParams.get("app_id");

    if (token) $prefs.setValueForKey(token, CONFIG.ACCESS_TOKEN);
    if (kdtId) $prefs.setValueForKey(kdtId, CONFIG.KDT_ID);
    if (appId) $prefs.setValueForKey(appId, CONFIG.APP_ID);
  } catch (e) {}

  $done({});
}

// ====== 主签到流程 ======
function main() {
  log("开始执行签到任务...");

  var token = $prefs.valueForKey(CONFIG.ACCESS_TOKEN);
  var kdtId = $prefs.valueForKey(CONFIG.KDT_ID);
  var appId = $prefs.valueForKey(CONFIG.APP_ID);

  // 优先从 boxjs 读取
  var boxjsData = $prefs.valueForKey(CONFIG.BOXJS);
  if (boxjsData) {
    try {
      var data = JSON.parse(boxjsData);
      if (data.token) token = data.token;
      if (data.kdt_id) kdtId = data.kdt_id;
      if (data.app_id) appId = data.app_id;
      log("使用 Boxjs 配置");
    } catch (e) {
      token = boxjsData;
    }
  }

  if (!token || !kdtId) {
    notify("松鲜鲜签到", "缺少 Token 或 kdt_id，请打开小程序捕获");
    $done();
    return;
  }

  var today = getToday();
  var lastSign = $prefs.valueForKey(CONFIG.LAST_SIGN);
  if (lastSign === today) {
    log("今日已签到，跳过");
    $done();
    return;
  }

  // 查询签到状态
  checkSignInfo(token, kdtId, appId, function(err, info) {
    if (err) {
      log("查询失败: " + err);
      notify("松鲜鲜签到失败", err);
      $done();
      return;
    }

    // 检查是否已签到
    if (info.data && info.data.checked_in) {
      $prefs.setValueForKey(today, CONFIG.LAST_SIGN);
      notify("松鲜鲜签到", "今日已签到，无需重复");
      $done();
      return;
    }

    // 执行签到
    doCheckIn(token, kdtId, appId, function(err2, result) {
      if (err2) {
        notify("松鲜鲜签到失败", err2);
        $done();
        return;
      }

      $prefs.setValueForKey(today, CONFIG.LAST_SIGN);
      var count = parseInt($prefs.valueForKey(CONFIG.SIGN_COUNT) || "0") + 1;
      $prefs.setValueForKey(String(count), CONFIG.SIGN_COUNT);
      notify("松鲜鲜签到成功", "已签到 " + count + " 天");
      $done();
    });
  });
}

// ====== 查询签到状态 ======
function checkSignInfo(token, kdtId, appId, callback) {
  var url = BASE_URL + "/check-in-info.json";
  if (appId) url += "?app_id=" + appId;
  url += (appId ? "&" : "?") + "kdt_id=" + kdtId;
  url += "&access_token=" + token;

  $task.fetch({
    url: url,
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  }).then(function(response) {
    try {
      var data = JSON.parse(response.body);
      callback(null, data);
    } catch (e) {
      callback("解析响应失败");
    }
  }).catch(function(e) {
    callback("网络请求失败: " + e);
  });
}

// ====== 执行签到 ======
function doCheckIn(token, kdtId, appId, callback) {
  var url = BASE_URL + "/check-in.json";

  $task.fetch({
    url: url,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      app_id: appId || "",
      kdt_id: kdtId,
      access_token: token
    })
  }).then(function(response) {
    try {
      var data = JSON.parse(response.body);
      callback(null, data);
    } catch (e) {
      callback("签到请求失败");
    }
  }).catch(function(e) {
    callback("签到网络失败: " + e);
  });
}

// ====== 工具函数 ======
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function log(msg) {
  console.log("[松鲜鲜] " + msg);
}

function notify(title, content) {
  $notify(title, "", content);
}
