/**
 * 密语漂流瓶 VIP 解锁脚本
 * @supported Surge, Loon, Quantumult X
 * @description 拦截 /friend/v2/user/user_info 接口，伪造 VIP 权限
 */

// ======================= Env 环境适配（完整版） =======================
function Env(name) {
  const isLoon = typeof $loon !== "undefined";
  const isSurge = typeof $httpClient !== "undefined" && !isLoon;
  const isQX = typeof $task !== "undefined";

  const read = (key) => {
    if (isLoon || isSurge) return $persistentStore.read(key);
    if (isQX) return $prefs.valueForKey(key);
  };
  const write = (key, value) => {
    if (isLoon || isSurge) return $persistentStore.write(key, value);
    if (isQX) return $prefs.setValueForKey(key, value);
  };
  const notify = (title = "XiaoMao", subtitle = "", message = "", url = "", url2 = url) => {
    if (isLoon) $notification.post(title, subtitle, message, url);
    if (isSurge) $notification.post(title, subtitle, message, { url });
    if (isQX) $notify(title, subtitle, message, { "open-url": url, "media-url": url2 });
  };
  const get = (url, callback) => {
    if (isLoon || isSurge) $httpClient.get(url, callback);
    if (isQX) {
      url.method = `GET`;
      $task.fetch(url).then((resp) => callback(null, {}, resp.body));
    }
  };
  const post = (url, callback) => {
    if (isLoon || isSurge) $httpClient.post(url, callback);
    if (isQX) {
      url.method = `POST`;
      $task.fetch(url).then((resp) => callback(null, {}, resp.body));
    }
  };
  const put = (url, callback) => {
    if (isLoon || isSurge) $httpClient.put(url, callback);
    if (isQX) {
      url.method = "PUT";
      $task.fetch(url).then((resp) => callback(null, {}, resp.body));
    }
  };
  const toObj = (str) => JSON.parse(str);
  const toStr = (obj) => JSON.stringify(obj);
  const queryStr = (obj) => Object.keys(obj).map((key) => `${key}=${obj[key]}`).join("&");
  const log = (message) => console.log(message);
  const done = (value = {}) => $done(value);

  return { name, read, write, notify, get, post, put, toObj, toStr, queryStr, log, done };
}

// ======================= 脚本主逻辑 =======================
let $XiaoMao = new Env("MiYuVIP");

(() => {
  // 没有响应体则直接结束
  if (!$response || !$response.body) {
    $XiaoMao.log("⚠️ 无响应体，直接放行");
    $done({});
    return;
  }

  const requestUrl = $request.url;
  // 拦截 user_info 接口（根据抓包记录）
  const targetRegex = /^http:\/\/www\.iyouliao\.cn\/friend\/v2\/user\/user_info/;

  if (targetRegex.test(requestUrl)) {
    try {
      // 解析原始响应
      let body = JSON.parse($response.body);
      $XiaoMao.log("✅ 拦截到 user_info 接口，原始数据: " + JSON.stringify(body));

      // ----- 伪造 VIP 数据（根据常见字段修改，可自行调整）-----
      // 情况1：data 对象内包含 vip 相关字段
      if (body.data) {
        body.data.is_vip = true;
        body.data.vip = 1;
        body.data.vip_level = "premium";
        body.data.vip_expire_time = 4070880000;  // 2099-01-01 时间戳
        body.data.vip_end_time = "2099-12-31";
        if (body.data.vip_status !== undefined) body.data.vip_status = 1;
      }
      // 情况2：根节点直接包含 vip 字段
      if (body.is_vip !== undefined) body.is_vip = true;
      if (body.vip !== undefined) body.vip = 1;
      if (body.vip_expired !== undefined) body.vip_expired = false;
      // 情况3：可能存在 member 或 subscription 对象
      if (body.member) {
        body.member.is_active = true;
        body.member.expire = "2099-12-31";
      }
      if (body.subscription) {
        body.subscription.status = "active";
      }

      // 可选：强制修改用户等级或积分 (有些 app 会判断积分)
      if (body.user_level !== undefined) body.user_level = 99;
      if (body.points !== undefined) body.points = 999999;

      $XiaoMao.log("🎉 VIP 已解锁，修改后数据: " + JSON.stringify(body));
      $done({ body: JSON.stringify(body) });
    } catch (e) {
      $XiaoMao.log("❌ 解析失败: " + e);
      $done({});
    }
  } else {
    // 其他接口不做修改，直接放行
    $done({});
  }
})();