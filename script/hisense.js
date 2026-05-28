/**
 * 海信爱家签到 - 请求重放版
 * 
 * 原理：
 * 1. 重写规则拦截小程序发出的真实签到请求（含已生成的签名）
 * 2. 将完整的请求头、请求体、URL 保存到 QX 本地存储
 * 3. 定时任务读取存储的数据，原封不动地重新发送该请求
 * 
 * 使用步骤：
 * 1. 配置 MITM 和重写规则（见下方）
 * 2. 打开海信爱家小程序 → 会员中心 → 点击签到按钮
 * 3. QX 弹出 "🎉 签到请求已保存" 通知
 * 4. 每天定时任务会自动回放该请求
 */

const $ = new Env('海信爱家签到');
const STORE_KEY = 'hisense_sign_request';

// ==================== 抓取模式：保存完整请求 ====================
if (typeof $request !== 'undefined') {
  const url = $request.url;

  // 只抓取 checkIn 请求
  if (url.includes('/checkIn')) {
    const headers = $request.headers;
    const body = $request.body || '{}';
    const customerId = (url.match(/customerId=([^&]+)/) || [])[1] || '';

    const data = JSON.stringify({
      url: url,
      headers: headers,
      body: body,
      customerId: customerId,
      timestamp: Date.now()
    });

    $.setdata(data, STORE_KEY);
    $.msg($.name, '抓取成功', '🎉 签到请求已保存，可用于定时回放');
  }
  $.done();
}

// ==================== 定时签到模式：回放请求 ====================
(async () => {
  const raw = $.getdata(STORE_KEY) || '';

  if (!raw) {
    $.msg($.name, '❌ 未找到请求数据', '请先进入海信爱家小程序，点击签到按钮抓取请求');
    $.done();
    return;
  }

  let saved;
  try {
    saved = JSON.parse(raw);
  } catch (e) {
    $.msg($.name, '❌ 数据解析失败', '请重新抓取签到请求');
    $.done();
    return;
  }

  // 提取完整的请求信息
  const url = saved.url || `https://mobile-aiot.hismarttv.com/AIoTPointsMall/gw/svc/HiVip/1.0/checkIn?customerId=${saved.customerId}`;
  const reqBody = typeof saved.body === 'string' ? saved.body : JSON.stringify(saved.body);
  const reqHeaders = Object.assign(
    {
      'Content-Type': 'application/json',
      'Host': 'mobile-aiot.hismarttv.com'
    },
    saved.headers || {}
  );

  console.log('回放请求 URL: ' + url);
  console.log('回放请求体: ' + reqBody.substring(0, 200) + '...');

  try {
    const res = await doPost(url, reqBody, reqHeaders);
    console.log('签到响应: ' + JSON.stringify(res));

    let msg = '';
    if (res.resultCode === 0 || res.code === 0) {
      msg = '✅ 签到成功';
    } else if (res.errorDesc && res.errorDesc.includes('已签到')) {
      msg = '⚠️ 今天已签到';
    } else if (res.errorDesc && res.errorDesc.includes('Wrong Signature')) {
      msg = '⚠️ 签名已过期，请重新进入小程序签到页面抓取请求';
    } else {
      msg = '❌ 失败: ' + (res.errorDesc || res.msg || JSON.stringify(res));
    }

    $.msg($.name, '', msg);
  } catch (e) {
    $.msg($.name, '❌ 网络异常', e.message);
  }
  $.done();
})();

// ==================== 网络请求 ====================
function doPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    $.post({
      url: url,
      headers: headers,
      body: body,
      timeout: 30000
    }, (err, resp, data) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('解析失败: ' + data));
      }
    });
  });
}

// ==================== 环境适配 ====================
function Env(name) {
  const isQX = typeof $task !== 'undefined';
  const isSurge = typeof $httpClient !== 'undefined' && !isQX;

  const getdata = (key) => {
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
    console.log(t + '\n' + s + '\n' + m);
  };

  const post = (opt, cb) => {
    if (isQX) {
      opt.method = 'POST';
      $task.fetch(opt).then(res => cb(null, res, res.body)).catch(err => cb(err));
    } else if (isSurge) {
      $httpClient.post(opt, cb);
    }
  };

  const done = (v) => {
    if (typeof $done !== 'undefined') $done(v);
  };

  return { name, getdata, setdata, msg, post, done };
}