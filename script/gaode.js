/*
 * 高德打车·签到脚本
 * 2026-06-10 版本: 1.0.0
 * 签名密钥 (TEA delta): 0x9E3779B9
 * 算法: TEA加密 + RC4校验 + MD5签名 + HMAC-MD5 (密钥混淆于小程序代码中，无法直接还原)
 * MITM 域名: m5-zb.amap.com
 * 重写规则 (Rewrite): ^https:\/\/m5-zb\.amap\.com\/ws\/car-place\/activity\/daily_sign\/do_sign
 * [rewrite_local]
 * ^https:\/\/m5-zb\.amap\.com\/ws\/car-place\/activity\/daily_sign\/do_sign url script-request-body gaode.js
 * [task_local]
 * 35 7 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/refs/heads/main/script/gaode.js, tag=高德打车签到, enabled=true
 * [MITM]
 * hostname = m5-zb.amap.com
 *
 * 注意：签到接口使用 TEA+RC4+MD5 复合加密，签名算法高度混淆无法还原，
 * 脚本通过 MITM 拦截完整已签名请求后重放。建议保持小程序活跃以刷新 session。
 */

const ENV_KEY = 'gaode_checkin_data'

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined'
const isTask = typeof $request === 'undefined' && typeof $notification !== 'undefined'

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

function request(opts) {
  return new Promise(function (resolve, reject) {
    var o = {
      url: opts.url,
      method: opts.method || 'POST',
      headers: opts.headers || {},
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    }
    if (typeof $httpClient !== 'undefined') {
      $httpClient[o.method.toLowerCase()](o, function (e, r, d) { return e ? reject(e) : resolve({ status: r.status, body: d }) })
    } else if (typeof $task !== 'undefined') {
      $task.fetch(o).then(function (r) { return resolve({ status: r.statusCode, body: r.body }) }, reject)
    } else reject(new Error('no http client'))
  })
}

// ====== Rewrite: 拦截签到响应，捕获请求参数 ======
async function rewriteCapture() {
  var store = load()
  var url = $request.url || ''
  var method = ($request.method || 'POST').toUpperCase()
  var h = $request.headers || {}

  console.log('[Gaode] === 捕获签到请求 ===')
  console.log('[Gaode] URL: ' + url)

  // 解析 URL query 参数
  var urlParams = {}
  if (url.indexOf('?') > -1) {
    var paramStr = url.split('?')[1].split('#')[0]
    paramStr.split('&').forEach(function (p) {
      var idx = p.indexOf('=')
      if (idx > -1) {
        var key = decodeURIComponent(p.substring(0, idx))
        var val = decodeURIComponent(p.substring(idx + 1))
        urlParams[key] = val
      }
    })
  }

  // 提取 cookie
  var cookie = h['Cookie'] || h['cookie'] || ''
  var sessionId = ''
  var sgcookie = ''
  if (cookie) {
    var matchSid = cookie.match(/sessionid=([^;]+)/)
    var matchSg = cookie.match(/sgcookie=([^;]+)/)
    if (matchSid) sessionId = matchSid[1]
    if (matchSg) sgcookie = matchSg[1]
    console.log('[Gaode] sessionid: ' + sessionId.substring(0, 20) + '...')
  }

  // 解析 body
  var bodyStr = ''
  try {
    bodyStr = typeof $request.body === 'string' ? $request.body : JSON.stringify($request.body || '')
  } catch (e) { bodyStr = '' }

  // 保存完整请求快照
  var snapshot = {
    url: url,
    urlBase: url.split('?')[0],
    urlParams: urlParams,
    method: method,
    cookie: cookie,
    sessionId: sessionId,
    sgcookie: sgcookie,
    body: bodyStr,
    headers: {
      'Content-Type': h['Content-Type'] || 'application/x-www-form-urlencoded',
      'User-Agent': h['User-Agent'] || h['user-agent'] || '',
      'Referer': h['Referer'] || h['referer'] || '',
      'Origin': h['Origin'] || h['origin'] || '',
    },
    capturedAt: new Date().toISOString(),
    timestamp: Date.now()
  }

  store.lastSnapshot = snapshot

  // 保存历史记录
  if (!store.history) store.history = []
  store.history.push({
    time: snapshot.capturedAt,
    hasCookie: !!cookie,
    hasBody: !!bodyStr,
    urlParamKeys: Object.keys(urlParams)
  })
  if (store.history.length > 30) store.history = store.history.slice(-30)

  // 提取 sign 字段（如果存在）
  if (urlParams.sign) {
    store.lastSign = urlParams.sign
    console.log('[Gaode] sign: ' + urlParams.sign.substring(0, 30) + '...')
  }
  if (urlParams.xck) {
    store.lastXck = urlParams.xck
    console.log('[Gaode] xck: ' + urlParams.xck.substring(0, 30) + '...')
  }

  save(store)

  var summary = 'sessionid=' + (sessionId ? '有' : '无') +
    ' | xck=' + (urlParams.xck ? '有' : '无') +
    ' | sign=' + (urlParams.sign ? '有' : '无') +
    ' | body=' + (bodyStr ? '有' : '无')
  notify('高德打车签到', '已捕获签到请求', summary)
}

// ====== Task: 定时签到 ======
async function taskRun() {
  var store = load()
  var snap = store.lastSnapshot
  console.log('[Gaode] 定时任务启动')

  if (!snap || !snap.url) {
    notify('高德打车签到', '缺少请求数据', '请先打开小程序捕获签到请求')
    return
  }

  // 检查捕获时间，超过 2 小时则提醒
  var elapsed = Date.now() - snap.timestamp
  if (elapsed > 2 * 60 * 60 * 1000) {
    console.log('[Gaode] 请求数据已过期: ' + Math.round(elapsed / 60000) + ' 分钟前捕获')
  }

  try {
    var headers = snap.headers || {}
    headers['Cookie'] = snap.cookie

    console.log('[Gaode] 重放请求: ' + snap.url.substring(0, 100) + '...')

    var result = await request({
      url: snap.url,
      method: snap.method,
      headers: headers,
      body: snap.body || undefined
    })

    console.log('[Gaode] 响应状态: ' + result.status)
    console.log('[Gaode] 响应内容: ' + (result.body || '').substring(0, 500))

    var success = false
    var msg = ''
    try {
      var resp = JSON.parse(result.body)
      // 高德接口一般 code=200 或 code=0 表示成功
      if (resp.code == 200 || resp.code == 0 || resp.status == 'success') {
        success = true
        msg = resp.data ? (resp.data.desc || resp.data.message || '签到成功') : '签到成功'
      } else {
        msg = resp.message || resp.desc || 'code=' + resp.code
      }
    } catch (e) {
      msg = '响应解析失败: ' + (result.body || '').substring(0, 100)
    }

    if (success) {
      notify('高德打车签到', '✅ 签到成功', msg)
    } else {
      notify('高德打车签到', '❌ 签到失败', msg + '\n建议重新打开小程序捕获请求')
    }
  } catch (e) {
    console.log('[Gaode] 错误: ' + (e.message || e))
    notify('高德打车签到', '请求错误', String(e.message || e))
  }
}

// ====== Main ======
async function main() {
  try {
    if (isRequest) {
      console.log('[Gaode] 重写模式 - 捕获签到请求')
      await rewriteCapture()
      done()
    } else if (isTask) {
      console.log('[Gaode] 定时任务模式')
      await taskRun()
      done()
    } else {
      console.log('[Gaode] 未知运行模式')
      notify('高德打车签到', '运行模式错误', '请通过 rewrite 或 cron 触发')
      done()
    }
  } catch (e) {
    console.log('[Gaode] 主错误: ' + (e.message || e))
    notify('高德打车签到', '脚本错误', String(e.message || e))
    done()
  }
}

main()