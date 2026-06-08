/*
 * 松鲜鲜·签到脚本
 * 2026-06-08 版本: 2.1.0
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
const CONFIG = {
  SESSION: "songxx_session",
  BUYER_ID: "songxx_buyer_id",
  KDT_ID: "songxx_kdt_id",
  LAST_SIGN: "songxx_last_sign",
  SIGN_COUNT: "songxx_sign_count",
  BOXJS: "songxx_sign_data"
};

const CARMEN_API = "https://open.youzan.com/api";

const API_METHODS = {
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
  // 优先使用 boxjs 手动填入的 Cookie
  const boxjsCookie = $persistentStore.read(CONFIG.BOXJS);
  if (boxjsCookie) {
    log("使用 Boxjs Cookie");
    return boxjsCookie;
  }
  // 其次使用 MITM 自动捕获的 Cookie
  return $persistentStore.read(CONFIG.SESSION);
}

// ====== 重写捕获逻辑 ======
function capture() {
  const url = $request.url;
  const headers = $request.headers;
  const cookie = headers["Cookie"] || headers["cookie"] || "";

  if (!cookie) {
    $done({});
    return;
  }

  const stored = $persistentStore.read(CONFIG.SESSION);
  if (stored !== cookie) {
    $persistentStore.write(cookie, CONFIG.SESSION);
    log("Cookie 已更新");
  }

  if ($request.body) {
    try {
      const body = JSON.parse($request.body);
      if (body.kdt_id || body.kdtId) {
        $persistentStore.write(String(body.kdt_id || body.kdtId), CONFIG.KDT_ID);
      }
      if (body.buyer_id || body.buyerId) {
        $persistentStore.write(String(body.buyer_id || body.buyerId), CONFIG.BUYER_ID);
      }
    } catch (e) {}
  }

  try {
    const urlObj = new URL(url);
    const kdtId = urlObj.searchParams.get("kdt_id") || urlObj.searchParams.get("kdtId");
    if (kdtId) $persistentStore.write(kdtId, CONFIG.KDT_ID);
  } catch (e) {}

  $done({});
}

// ====== 主签到流程 ======
async function main() {
  log("开始执行签到任务...");

  const cookie = getCookie();
  if (!cookie) {
    notify("松鲜鲜签到", "未捕获到 Cookie，请先打开小程序或在 Boxjs 填入");
    $done();
    return;
  }

  const today = getToday();
  const lastSign = $persistentStore.read(CONFIG.LAST_SIGN);
  if (lastSign === today) {
    log("今日已签到，跳过");
    $done();
    return;
  }

  try {
    const checkResult = await checkSignStatus(cookie);
    if (checkResult && checkResult.alreadySigned) {
      $persistentStore.write(today, CONFIG.LAST_SIGN);
      notify("松鲜鲜签到", "今日已签到，无需重复");
      $done();
      return;
    }

    const signResult = await doSign(cookie);
    if (signResult.success) {
      $persistentStore.write(today, CONFIG.LAST_SIGN);
      const count = parseInt($persistentStore.read(CONFIG.SIGN_COUNT) || "0") + 1;
      $persistentStore.write(String(count), CONFIG.SIGN_COUNT);
      notify("松鲜鲜签到成功", `已签到 ${count} 天`);
    } else {
      notify("松鲜鲜签到失败", signResult.message || "未知错误");
    }
  } catch (e) {
    log("签到异常: " + e);
    notify("松鲜鲜签到异常", e);
  }

  $done();
}

// ====== 查询签到状态 ======
function checkSignStatus(cookie) {
  return new Promise((resolve) => {
    tryMethods(API_METHODS.CHECK, cookie, {}, (err, data) => {
      if (err) {
        resolve({ alreadySigned: false });
        return;
      }
      const alreadySigned =
        data.data?.is_sign ||
        data.data?.isSign ||
        data.data?.today_signed ||
        data.data?.todaySigned ||
        data.data?.signed;
      resolve({ alreadySigned: !!alreadySigned, data });
    });
  });
}

// ====== 执行签到 ======
function doSign(cookie) {
  return new Promise((resolve) => {
    tryMethods(API_METHODS.SIGN, cookie, {}, (err, data) => {
      if (err) {
        resolve({ success: false, message: err });
        return;
      }
      resolve({
        success: true,
        message: data.data?.message || data.data?.desc || "签到成功",
        data
      });
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

  const method = methods[idx];
  log("尝试 API: " + method);

  $task.fetch({
    url: CARMEN_API,
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({ method, params: params || {} })
  }).then(
    (response) => {
      try {
        const data = JSON.parse(response.body);
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
    },
    () => {
      tryMethods(methods, cookie, params, callback, idx + 1);
    }
  );
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
