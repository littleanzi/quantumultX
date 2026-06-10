/*
 * 高德打车·签到脚本
 * 2026-06-10 版本: 1.2.1
 * 签名密钥 (TEA delta): 0x9E3779B9
 * 算法: TEA加密 + RC4校验 + MD5签名 + HMAC-MD5 (密钥混淆于小程序代码中，无法直接还原)
 * MITM 域名: m5.amap.com, m5-zb.amap.com
 * 重写规则 (Rewrite): ^https:\/\/m5\.amap\.com\/ws\/car-place\/activity\/daily_sign
 * [rewrite_local]
 * Logs:

[Gaode] 定时
[Gaode] 定时任务启动
[Gaode] 重放请求...
[Gaode] 响应: {"code":"14","message":"Not login.(http: named cookie not present)","timestamp":1781108944,"version":"","gsId":"2135fbe817811089440201175e0ce4","data":null,"result":false}

gaode.js
 * [task_local]
 * 35 7 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/refs/heads/main/script/gaode.js, tag=高德打车签到, enabled=true
 * [MITM]
 * hostname = m5.amap.com, m5-zb.amap.com
 *
 * 注意：签到接口使用 TEA+RC4+MD5 复合加密，签名算法高度混淆无法还原，
 * 脚本通过 MITM 拦截完整已签名请求后重放。建议保持小程序活跃以刷新 session。
 */

const ENV_KEY = 'gaode_checkin_data'

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined'
const isTask = typeof $request === 'undefined' && typeof $notification !== 'undefined'

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

// ====== Rewrite: 拦截签到请求，捕获完整参数 ======
async function rewriteCapture() {
  var store = load()
  var url = $request.url || ''
  var h = $request.headers || {}

  console.log('[Gaode] === 捕获请求 ===')
  console.log('[Gaode] URL: ' + url)

  // 从 URL 参数提取
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

  // 从 headers 提取
  var cookie = h['Cookie'] || h['cookie'] || ''
  var sessionId = ''
  if (cookie) {
    var matchSid = cookie.match(/sessionid=([^;]+)/)
    if (matchSid) sessionId = matchSid[1]
  }

  // 从 URL 参数提取 sessionId
  if (!sessionId && urlParams.sessionId) sessionId = urlParams.sessionId
  if (!sessionId && urlParams.sessionid) sessionId = urlParams.sessionid

  console.log('[Gaode] sessionid: ' + (sessionId ? sessionId.substring(0, 20) + '...' : '无'))
  console.log('[Gaode] URL参数: ' + JSON.stringify(Object.keys(urlParams)))

  // 保存完整请求
  store.signUrl = url
  store.cookie = cookie
  store.sessionId = sessionId
  store.urlParams = urlParams
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

  // 检查是否过期（超过 6 小时）
  var elapsed = Date.now() - (store.timestamp || 0)
  if (elapsed > 6 * 60 * 60 * 1000) {
    console.log('[Gaode] 请求数据已过期: ' + Math.round(elapsed / 3600000) + ' 小时前捕获')
  }

  try {
    var headers = {
      'Cookie': store.cookie || '',
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