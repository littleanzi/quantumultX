/*
 * 松鲜鲜·签到脚本
 * 2026-06-08 版本: 1.6.0
* 签名密钥: N/A
* MITM 域名: passport.youzan.com, open.youzan.com, h5.youzan.com, *.youzan.com
* 重写规则 (Rewrite): ^https:\/\/(passport\.youzan\.com|open\.youzan\.com|h5\.youzan\.com|.*\.youzan\.com)\/.*
* 算法: Cookie 认证 → open.youzan.com/api/oauthentry/{method}?kdt_id=117130552
* [rewrite_local]
* ^https:\/\/(passport\.youzan\.com|open\.youzan\.com|h5\.youzan\.com|.*\.youzan\.com)\/.* url script-request-header songxx_sign.js
* [task_local]
* 0 9 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/main/script/songxx_sign.js, tag=松鲜鲜签到, enabled=true
* [MITM]
* hostname = passport.youzan.com, open.youzan.com, h5.youzan.com
 */

const ENV_KEY = 'songxx_sign_data'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.43'

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined'
const isTask = typeof $request === 'undefined'

// ====== 持久化 ======
function load() {
  const raw = typeof $persistentStore !== 'undefined' ? $persistentStore.read(ENV_KEY)
    : typeof $prefs !== 'undefined' ? $prefs.valueForKey(ENV_KEY) : '{}'
  return raw ? JSON.parse(raw) : {}
}
function save(store) {
  const str = JSON.stringify(store)
  if (typeof $persistentStore !== 'undefined') $persistentStore.write(str, ENV_KEY)
  else if (typeof $prefs !== 'undefined') $prefs.setValueForKey(str, ENV_KEY)
}
function notify(title, sub, msg) {
  if (typeof $notification !== 'undefined') $notification.post(title, sub, msg)
  else if (typeof $notify !== 'undefined') $notify(title, sub, msg)
}
function done() { if (typeof $done !== 'undefined') $done({}) }

// ====== HTTP 请求 ======
function request(opts) {
  return new Promise(function (resolve, reject) {
    const o = {
      url: opts.url,
      method: opts.method || 'POST',
      headers: opts.headers || {},
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    }
    console.log('[松鲜鲜] REQ: ' + (opts.method || 'POST') + ' ' + opts.url)
    if (typeof $httpClient !== 'undefined') {
      $httpClient[o.method.toLowerCase()](o, function (e, r, d) {
        return e ? reject(e) : resolve({ status: r.status, body: d })
      })
    } else if (typeof $task !== 'undefined') {
      o.opts = o.opts || {}
      o.opts.timeout = 30
      $task.fetch(o).then(function (r) {
        resolve({ status: r.statusCode, body: r.body })
      }, function (e) {
        reject(e)
      })
    } else reject(new Error('no http client'))
  })
}

// ====== 有赞 API ======
function callUmp(method, cookie) {
  const url = 'https://open.youzan.com/api/oauthentry/' + method + '?kdt_id=117130552'
  return request({
    url: url,
    method: 'GET',
    headers: {
      'User-Agent': UA,
      'Cookie': cookie,
    },
  }).then(function (r) {
    console.log('[松鲜鲜] RSP[' + r.status + ']: ' + r.body.substring(0, 300))
    if (r.status !== 200) throw new Error('HTTP ' + r.status)
    return JSON.parse(r.body)
  })
}

// ====== 捕获 Cookie ======
async function rewriteCapture() {
  let store = load()
  if (typeof store === 'string') store = {}

  const rh = ($request && $request.headers) || {}
  const cookie = rh['Cookie'] || rh['cookie'] || ''

  if (cookie && cookie !== store.cookie) {
    store.cookie = cookie
    save(store)
    console.log('[松鲜鲜] Cookie 已从MITM捕获')
    notify('松鲜鲜签到', '已捕获', '可定时签到')
  }
}

// ====== 签到 ======
async function taskRun() {
  const raw = load()

  // 手动填写的Cookie是纯字符串，MITM捕获的是JSON对象
  let cookie = ''
  let store = {}
  if (typeof raw === 'string') {
    cookie = raw.trim()
    store = { manualCookie: cookie }
  } else {
    store = raw
    cookie = store.manualCookie || store.cookie || ''
  }

  if (!cookie) {
    notify('松鲜鲜签到', '缺少 Cookie', '请在BoxJS中粘贴Cookie，或确认MITM已启用')
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  if (store.lastSign === today) {
    console.log('[松鲜鲜] 今日已签到，跳过')
    return
  }

  // 查询签到状态
  const methodPrefixes = ['youzan.ump.checkin', 'wsc.ump.checkin', 'ump.checkin']
  let alreadySigned = false
  let workingPrefix = ''
  for (const prefix of methodPrefixes) {
    try {
      console.log('[松鲜鲜] 尝试: ' + prefix + '.status.get/1.0.0')
      const statusRes = await callUmp(prefix + '.status.get/1.0.0', cookie)
      if (statusRes.code === 0 || statusRes.success) {
        alreadySigned = statusRes.data?.is_sign || statusRes.data?.isSign || statusRes.data?.today_signed || statusRes.data?.todaySigned || false
        workingPrefix = prefix
        console.log('[松鲜鲜] ✓ 成功! method=' + prefix)
        break
      }
      console.log('[松鲜鲜] ✗ ' + prefix + ' -> ' + JSON.stringify(statusRes).substring(0, 100))
    } catch (e) {
      console.log('[松鲜鲜] ✗ ' + prefix + ' -> ' + (e.message || JSON.stringify(e)).substring(0, 100))
    }
  }

  if (!workingPrefix) {
    notify('松鲜鲜签到', '无法查询状态', '所有方法名均返回错误，检查日志')
    return
  }

  if (alreadySigned) {
    store.lastSign = today
    save(store)
    notify('松鲜鲜签到', '今日已签到', '无需重复签到')
    return
  }

  // 执行签到
  try {
    console.log('[松鲜鲜] 签到: ' + workingPrefix + '.punch/1.0.0')
    const signRes = await callUmp(workingPrefix + '.punch/1.0.0', cookie)
    const code = String(signRes.code || '')
    const msg = signRes.msg || signRes.message || JSON.stringify(signRes).substring(0, 100)

    if (code === '0' || signRes.success) {
      store.lastSign = today
      save(store)
      notify('松鲜鲜签到', '签到成功', msg)
    } else {
      notify('松鲜鲜签到', '失败 [' + code + ']', msg)
    }
  } catch (e) {
    const msg = (typeof e === 'string' ? e : e.message || e.error || JSON.stringify(e)).substring(0, 200)
    console.log('[松鲜鲜] 签到异常: ' + msg)
    notify('松鲜鲜签到', '异常', msg)
  }
}

// ====== Main ======
async function main() {
  try {
    console.log('[松鲜鲜] v1.6.0 | ' + (isRequest ? '重写' : '定时'))
    if (isRequest) { await rewriteCapture(); done() }
    else { await taskRun(); done() }
  } catch (e) {
    const msg = (typeof e === 'string' ? e : e.message || e.error || JSON.stringify(e)).substring(0, 500)
    console.log('[松鲜鲜] 错误: ' + msg)
    done()
  }
}

main()