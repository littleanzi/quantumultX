/*
 * 高德打车·签到脚本
 * 2026-06-10 版本: 1.4.0
 * 签名密钥 (TEA delta): 0x9E3779B9
 * 算法: TEA加密 + RC4校验 + MD5签名 + HMAC-MD5 (密钥混淆于小程序代码中，无法直接还原)
 * MITM 域名: m5.amap.com, m5-zb.amap.com
 * 重写规则 (Rewrite): ^https:\/\/m5(-zb)?\.amap\.com\/ws\/car-place\/activity\/daily_sign
 * [rewrite_local]
 * ^https:\/\/m5(-zb)?\.amap\.com\/ws\/car-place\/activity\/daily_sign url script-request-body gaode.js
 * [task_local]
 * 35 7 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/refs/heads/main/script/gaode.js, tag=高德打车签到, enabled=true
 * [MITM]
 * hostname = m5.amap.com, m5-zb.amap.com
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
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }
    if (typeof $httpClient !== 'undefined') {
      $httpClient[o.method.toLowerCase()](o, function (e, r, d) { return e ? reject(e) : resolve({ status: r.status, body: d }) })
    } else if (typeof $task !== 'undefined') {
      $task.fetch(o).then(function (r) { return resolve({ status: r.statusCode, body: r.body }) }, reject)
    } else reject(new Error('no http client'))
  })
}

// ====== Rewrite: 拦截签到请求 ======
async function rewriteCapture() {
  var store = load()
  var url = $request.url || ''
  var h = $request.headers || {}

  console.log('[Gaode] === 捕获签到请求 ===')
  console.log('[Gaode] URL: ' + url)

  var cookie = h['Cookie'] || h['cookie'] || ''
  var sessionId = ''
  if (cookie) {
    var matchSid = cookie.match(/sessionid=([^;]+)/)
    if (matchSid) sessionId = matchSid[1]
  }

  store.signUrl = url
  store.cookie = cookie
  store.sessionId = sessionId
  store.capturedAt = new Date().toISOString()
  store.timestamp = Date.now()

  save(store)
  notify('高德打车签到', '已捕获签到请求', 'sessionid=' + (sessionId ? '有' : '无'))
}

// ====== Task: 定时签到 ======
async function taskRun() {
  var store = load()
  console.log('[Gaode] 定时任务启动')

  if (!store.signUrl) {
    notify('高德打车签到', '缺少请求数据', '请先打开小程序捕获签到请求')
    return
  }

  var cookie = store.cookie || ''
  if (store.sessionId && cookie.indexOf('sessionid=') === -1) {
    cookie = cookie ? cookie + '; sessionid=' + store.sessionId : 'sessionid=' + store.sessionId
  }

  try {
    var headers = {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.43',
    }

    console.log('[Gaode] 重放请求...')

    var result = await request({
      url: store.signUrl,
      method: 'GET',
      headers: headers,
    })

    console.log('[Gaode] 响应: ' + (result.body || '').substring(0, 500))

    var success = false
    var msg = ''
    try {
      var resp = JSON.parse(result.body)
      if (resp.code == 200 || resp.code == 0 || resp.result === true) {
        success = true
        msg = resp.data ? (resp.data.desc || resp.data.message || '签到成功') : '签到成功'
      } else {
        msg = resp.message || resp.desc || 'code=' + resp.code
      }
    } catch (e) {
      msg = result.body ? result.body.substring(0, 100) : '空响应'
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
    console.log('[Gaode] ' + (isRequest ? '重写' : '定时'))
    if (isRequest) { await rewriteCapture(); done() }
    else { await taskRun(); done() }
  } catch (e) {
    console.log('[Gaode] 错误: ' + (e.message || e))
    notify('高德打车签到', '脚本错误', String(e.message || e))
    done()
  }
}

main()