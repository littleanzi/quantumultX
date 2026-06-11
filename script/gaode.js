/*
 * 高德打车·签到脚本
 * 2026-06-10 版本: 1.6.0
 * 签名密钥 (TEA delta): 0x9E3779B9
 * 算法: TEA加密 + RC4校验 + MD5签名 + HMAC-MD5 (密钥混淆于小程序代码中，无法直接还原)
 * MITM 域名: m5.amap.com, m5-zb.amap.com
 * 重写规则 (Rewrite): ^https:\/\/m5\.amap\.com\/ws\/car-place\/activity\/daily_sign
 * [rewrite_local]
 * ^https:\/\/m5\.amap\.com\/ws\/car-place\/activity\/daily_sign url script-request-body gaode.js
 * [task_local]
 * 35 7 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/refs/heads/main/script/gaode.js, tag=高德打车签到, enabled=true
 * [MITM]
 * hostname = m5.amap.com, m5-zb.amap.com
 *
 * 使用方式：
 * 1. 用抓包工具抓取签到请求的完整 URL
 * 2. 在 BoxJS 中填入 signUrl 和 sessionId
 * 3. 定时任务会自动签到
 * 4. signUrl 过期后重新抓取更新即可
 */

const ENV_KEY = 'gaode_checkin_data'

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined'
const isTask = typeof $request === 'undefined' && typeof $notification !== 'undefined'

// ====== 持久化 ======
function load() {
  var raw = typeof $persistentStore !== 'undefined' ? $persistentStore.read(ENV_KEY)
    : typeof $prefs !== 'undefined' ? $prefs.valueForKey(ENV_KEY) : '{}'
  var store = raw ? JSON.parse(raw) : {}

  // 读取 BoxJS 单独字段
  if (!store.signUrl) {
    var v = typeof $persistentStore !== 'undefined' ? $persistentStore.read(ENV_KEY + '.signUrl') : ''
    if (v) store.signUrl = v
  }
  if (!store.sessionId) {
    var v = typeof $persistentStore !== 'undefined' ? $persistentStore.read(ENV_KEY + '.sessionId') : ''
    if (v) store.sessionId = v
  }

  return store
}

function save(store) {
  var str = JSON.stringify(store)
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

// ====== Rewrite: 捕获 sessionid ======
async function rewriteCapture() {
  var h = $request.headers || {}
  var cookie = h['Cookie'] || h['cookie'] || ''
  if (cookie) {
    var matchSid = cookie.match(/sessionid=([^;]+)/)
    if (matchSid) {
      if (typeof $persistentStore !== 'undefined') {
        $persistentStore.write(matchSid[1], ENV_KEY + '.sessionId')
      }
      console.log('[Gaode] 捕获 sessionid: ' + matchSid[1].substring(0, 20) + '...')
    }
  }
  done()
}

// ====== Task: 定时签到 ======
async function taskRun() {
  var store = load()
  console.log('[Gaode] 定时任务启动')

  if (!store.signUrl) {
    notify('高德打车签到', '缺少 signUrl', '请在 BoxJS 中填入签到请求 URL')
    return
  }

  if (!store.sessionId) {
    notify('高德打车签到', '缺少 sessionId', '请在 BoxJS 中填入 Session ID')
    return
  }

  var cookie = 'sessionid=' + store.sessionId

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
      notify('高德打车签到', '❌ 签到失败', msg + '\n建议更新 signUrl')
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
    if (isRequest) { await rewriteCapture() }
    else { await taskRun() }
    done()
  } catch (e) {
    console.log('[Gaode] 错误: ' + (e.message || e))
    notify('高德打车签到', '脚本错误', String(e.message || e))
    done()
  }
}

main()