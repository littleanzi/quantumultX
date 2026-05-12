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
      let body = JSON.parse($response.body);
      // 递归修改所有可能表示VIP状态的字段
      function deepModify(obj) {
        if (typeof obj !== 'object' || obj === null) return;
        for (let key in obj) {
          if (typeof obj[key] === 'object') deepModify(obj[key]);
          // 匹配常见 VIP 字段
          if (/is_vip|vip|isVip|isPremium|is_member/i.test(key)) obj[key] = true;
          if (/vip_level|user_level|level/i.test(key)) obj[key] = 99;
          if (/expire_time|expire_date|end_time|deadline/i.test(key)) obj[key] = 4070880000;
          if (/user_type|role|member_type/i.test(key)) obj[key] = "vip";
        }
      }
      deepModify(body);
      $done({ body: JSON.stringify(body) });
    } catch (e) {
      $done({});
    }
  } else {
    // 其他接口不做修改，直接放行
    $done({});
  }
})();