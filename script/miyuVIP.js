/**
 * 密语漂流瓶 VIP 解锁 (拦截 chargeVip_info)
 * @supported Surge, Loon, Quantumult X
 */

function Env(name) {
    const isQX = typeof $task !== 'undefined';
    const isSurge = typeof $httpClient !== 'undefined' && !isQX;
    const getdata = key => {
        if (isQX) return $prefs.valueForKey(key) || '';
        if (isSurge) return $persistentStore.read(key) || '';
        return '';
    };
    const setdata = (val, key) => {
        if (isQX) $prefs.setValueForKey(val, key);
        else if (isSurge) $persistentStore.write(val, key);
    };
    const msg = (t, s, m) => {
        if (isQX) $notify(t, s, m);
        else if (isSurge) $notification.post(t, s, m);
        console.log(t + '\n' + m);
    };
    const done = () => { if (typeof $done !== 'undefined') $done(); };
    return { name, getdata, setdata, msg, done };
}

const $ = new Env("MiYuVIP");

(() => {
  if (!$response || !$response.body) {
    $done({});
    return;
  }

  const url = $request.url;
  // 匹配 chargeVip_info 接口
  if (/\/friend\/v2\/applePay\/chargeVip_info/.test(url)) {
    try {
      let body = JSON.parse($response.body);
      $.log("✅ 拦截到 chargeVip_info");

      // 伪造会员信息（根据真实响应结构调整）
      if (body.data) {
        body.data.isVip = true;
        body.data.vipExpireTime = 4070880000000; // 2099-01-01 时间戳（毫秒）
        body.data.vipStatus = 1;
        body.data.vipLevel = "premium";
      }
      // 如果根节点直接有这些字段
      if (body.isVip !== undefined) body.isVip = true;
      if (body.vipExpireTime !== undefined) body.vipExpireTime = 4070880000000;

      $.log("🎉 VIP 已解锁");
      $done({ body: JSON.stringify(body) });
    } catch (e) {
      $.log("❌ 解析错误: " + e);
      $done({});
    }
  } else {
    $done({});
  }
})();