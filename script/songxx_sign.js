/*
 * 松鲜鲜·签到脚本
 * 2026-06-09 版本: 2.2.0
 * MITM 域名: open.youzan.com, h5.youzan.com
 * 重写规则 (Rewrite): ^https:\/\/(open\.youzan\.com|h5\.youzan\.com)\/.*
 * 算法: MITM 抓取 Cookie → Carmen API 签到
 * [rewrite_local]
 * ^https:\/\/(open\.youzan\.com|h5\.youzan\.com)\/.* url script-request-header songxx_sign.js
 * [task_local]
 * 0 9 * * * songxx_sign.js, tag=松鲜鲜签到, img-url=https://img01.yzcdn.cn/upload_files/2023/07/03/FtFv4zB9O7vAuHxsgdLpP0uSRHBF.png, enabled=true
 * [MITM]
 * hostname = open.youzan.com, h5.youzan.com
 */

// ====== 存储 Key ======
var CONFIG = {
  SESSION: "songxx_session",
  BUYER_ID: "songxx_buyer_id",
  KDT_ID: "songxx_kdt_id",
  LAST_SIGN: "songxx_last_sign",
  SIGN_COUNT: "songxx_sign_count",
  BOXJS: "songxx_sign_data"
};

var CARMEN_API = "https://open.youzan.com/api";

var API_METHODS = {
  CHECK: [
    "wsc.ump.checkin.status.get/1.0.0",
    "wsc.ump.punch.status.get/1.0.0",
    "wsc.checkin.status.get/1.0.0"
  ],
  SIGN: [
    "wsc.ump.checkin.punch/1.0.0",
    "wsc.ump.punch.sign/1.0.0",
    "wsc.checkin.punch/1.0.0"
  ]
};

// ====== 主入口 ======
if (typeof $task !== "undefined" && $task.fetch) {
  main();
} else if (typeof $request !== "undefined") {
  capture();
} else {
  $done({});
}

// ====== 获取 Cookie ======
function getCookie() {
  var boxjsCookie = $prefs.valueForKey(CONFIG.BOXJS);
  if (boxjsCookie) {
    log("使用 Boxjs Cookie");
    return boxjsCookie;
  }
  return $prefs.valueForKey(CONFIG.SESSION);
}

// ====== 重写捕获逻辑 ======
function capture() {
  var url = $request.url;
  var headers = $request.headers;
  var cookie = headers["Cookie"] || headers["cookie"] || "";

  if (!cookie) {
    $done({});
    return;
  }

  var stored = $prefs.valueForKey(CONFIG.SESSION);
  if (stored !== cookie) {
    $prefs.setValueForKey(cookie, CONFIG.SESSION);
    log("Cookie 已更新");
  }

  if ($request.body) {
    try {
      var body = JSON.parse($request.body);
      if (body.kdt_id || body.kdtId) {
        $prefs.setValueForKey(String(body.kdt_id || body.kdtId), CONFIG.KDT_ID);
      }
      if (body.buyer_id || body.buyerId) {
        $prefs.setValueForKey(String(body.buyer_id || body.buyerId), CONFIG.BUYER_ID);
      }
    } catch (e) {}
  }

  try {
    var urlObj = new URL(url);
    var kdtId = urlObj.searchParams.get("kdt_id") || urlObj.searchParams.get("kdtId");
    if (kdtId) $prefs.setValueForKey(kdtId, CONFIG.KDT_ID);
  } catch (e) {}

  $done({});
}

// ====== 主签到流程 ======
function main() {
  log("开始执行签到任务...");

  var cookie = getCookie();
  if (!cookie) {
    notify("松鲜鲜签到", "未捕获到 Cookie，请先打开小程序或在 Boxjs 填入");
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

  // 先查询签到状态
  tryMethods(API_METHODS.CHECK, cookie, {}, function(err, data) {
    if (!err && data) {
      var alreadySigned = data.data && (
        data.data.is_sign || data.data.isSign ||
        data.data.today_signed || data.data.todaySigned ||
        data.data.signed
      );
      if (alreadySigned) {
        $prefs.setValueForKey(today, CONFIG.LAST_SIGN);
        notify("松鲜鲜签到", "今日已签到，无需重复");
        $done();
        return;
      }
    }

    // 执行签到
    tryMethods(API_METHODS.SIGN, cookie, {}, function(err2, data2) {
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

// ====== 依次尝试多个 API Method ======
function tryMethods(methods, cookie, params, callback, idx) {
  idx = idx || 0;
  if (idx >= methods.length) {
    callback("所有签到接口均失败，请抓包确认实际 API");
    return;
  }

  var method = methods[idx];
  log("尝试 API: " + method);

  $task.fetch({
    url: CARMEN_API,
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({ method: method, params: params || {} })
  }).then(function(response) {
    try {
      var data = JSON.parse(response.body);
      if (data.code === 0 || data.code === "" || data.success) {
        callback(null, data);
      } else if (data.code === 40010 || data.code === 40009) {
        callback("登录态已过期，请重新打开小程序");
      } else {
        tryMethods(methods, cookie, params, callback, idx + 1);
      }
    } catch (e) {
      tryMethods(methods, cookie, params, callback, idx + 1);
    }
  }).catch(function() {
    tryMethods(methods, cookie, params, callback, idx + 1);
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
