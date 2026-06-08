/*
 * 松鲜鲜·签到脚本
 * 2026-06-08 版本: 1.8.0
 * 签名密钥: N/A
 * MITM 域名: h5.youzan.com
 * 重写规则 (Rewrite): ^https:\/\/h5\.youzan\.com\/wscump\/checkin\/.*
 * 算法: access_token + Extra-Data → h5.youzan.com/wscump/checkin/*.json
 * [rewrite_local]
 * ^https:\/\/h5\.youzan\.com\/wscump\/checkin\/.* url script-request-header songxx_sign.js
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/main/script/songxx_sign.js, tag=松鲜鲜签到, enabled=true
 * [MITM]
 * hostname = h5.youzan.com
 */

const ENV_KEY = 'songxx_sign_data'
const APP_ID = 'wxe65af2b5b95dc5da'
const KDT_ID = '117130552'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.74(0x18004a29) NetType/WIFI Language/zh_CN'

const isRequest = typeof $request !== 'undefined' && typeof $response === 'undefined'
const isTask = typeof $request === 'undefined'

// ====== 持久化 ======
function load() {
  const raw = typeof $persistentStore !== 'undefined' ? $persistentStore.read(ENV_KEY)
    : typeof $prefs !== 'undefined' ? $prefs.valueForKey(ENV_KEY) : '{}'
  try { return raw ? JSON.parse(raw) : {} } catch (e) { return {} }
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
      method: opts.method || 'GET',
      headers: opts.headers || {},
      body: opts.body || undefined,
    }
    console.log('[松鲜鲜] ' + o.method + ' ' + o.url)
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

// ====== 构建请求 ======
function buildReq(path, store) {
  return {
    url: 'https://h5.youzan.com/wscump/checkin/' + path + '?app_id=' + APP_ID + '&kdt_id=' + KDT_ID + '&access_token=' + (store.access_token || ''),
    method: 'GET',
    headers: {
      'Extra-Data': store.extraData || '',
      'User-Agent': UA,
      'Referer': 'https://servicewechat.com/' + APP_ID + '/93/page-frame.html',
    },
  }
}

// ====== 捕获参数 ======
async function rewriteCapture() {
  let store = load()
  if (typeof store === 'string') store = {}

  const url = $request.url || ''
  const headers = $request.headers || {}
  const extraData = headers['Extra-Data'] || headers['extra-data'] || ''

  // 从 URL 提取 access_token
  let token = ''
  try { token = url.match(/access_token=([^&]+)/)[1] } catch (e) {}

  let changed = false

  if (extraData && extraData !== store.extraData) {
    store.extraData = extraData
    changed = true
  }
  if (token && token !== store.access_token) {
    store.access_token = token
    changed = true
  }

  if (changed) {
    save(store)
    console.log('[松鲜鲜] 参数已捕获')
    notify('松鲜鲜签到', '已捕获', '可定时签到')
  }
}

// ====== 签到 ======
async function taskRun() {
  let store = load()
  if (typeof store === 'string') store = {}

  const token = store.access_token || ''

  if (!token || !store.extraData) {
    notify('松鲜鲜签到', '缺少参数', '请在签到页面触发抓包')
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  if (store.lastSign === today) {
    console.log('[松鲜鲜] 今日已签到，跳过')
    return
  }

  // 查询签到状态
  try {
    const statusRes = await request(buildReq('check-in-info.json', store))
    console.log('[松鲜鲜] 状态: ' + statusRes.body.substring(0, 200))
    const data = JSON.parse(statusRes.body)
    if (data.code === 0 || data.success) {
      const signed = data.data?.is_sign || data.data?.isSign || data.data?.today_signed || data.data?.todaySigned || false
      if (signed) {
        store.lastSign = today
        save(store)
        notify('松鲜鲜签到', '今日已签到', '无需重复签到')
        return
      }
    }
  } catch (e) {
    console.log('[松鲜鲜] 状态查询失败: ' + (e.message || '').substring(0, 100))
  }

  // 执行签到
  try {
    const signRes = await request(buildReq('check-in.json', store))
    console.log('[松鲜鲜] 签到: ' + signRes.body.substring(0, 200))
    const data = JSON.parse(signRes.body)
    if (data.code === 0 || data.success) {
      store.lastSign = today
      save(store)
      notify('松鲜鲜签到', '签到成功', data.data?.message || data.msg || '')
    } else {
      notify('松鲜鲜签到', '失败', (data.msg || JSON.stringify(data)).substring(0, 200))
    }
  } catch (e) {
    console.log('[松鲜鲜] 签到异常: ' + (e.message || '').substring(0, 100))
    notify('松鲜鲜签到', '异常', (e.message || '').substring(0, 200))
  }
}

// ====== Main ======
async function main() {
  try {
    console.log('[松鲜鲜] v1.8.0 | ' + (isRequest ? '重写' : '定时'))
    if (isRequest) { await rewriteCapture(); done() }
    else { await taskRun(); done() }
  } catch (e) {
    console.log('[松鲜鲜] 错误: ' + (e.message || '').substring(0, 200))
    done()
  }
}

main()