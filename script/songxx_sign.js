/*
 * 松鲜鲜·签到脚本
 * 2026-06-08 版本: 1.1.0
 * 签名密钥: N/A
 * MITM 域名: open.youzan.com, h5.youzan.com
 * 重写规则 (Rewrite): ^https:\/\/(open\.youzan\.com|h5\.youzan\.com)\/.*
 * 算法: Cookie 认证 → open.youzan.com/api (wsc.ump.checkin)
 * [rewrite_local]
 * ^https:\/\/(open\.youzan\.com|h5\.youzan\.com)\/.* url script-response-header songxx_sign.js
 * [task_local]
 * 0 9 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/main/script/songxx_sign.js, tag=松鲜鲜签到, enabled=true
 * [MITM]
 * hostname = open.youzan.com, h5.youzan.com
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

// ====== MD5 ======
var MD5 = function (string) {
  function RotateLeft(lValue, iShiftBits) { return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits)) }
  function AddUnsigned(lX, lY) {
    var lX4, lY4, lX8, lY8, lResult
    lX8 = (lX & 0x80000000); lY8 = (lY & 0x80000000)
    lX4 = (lX & 0x40000000); lY4 = (lY & 0x40000000)
    lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF)
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX8 ^ lY8
      else return lResult ^ 0x40000000 ^ lX8 ^ lY8
    } else return lResult ^ lX8 ^ lY8
  }
  function F(x, y, z) { return (x & y) | ((~x) & z) }
  function G(x, y, z) { return (x & z) | (y & (~z)) }
  function H(x, y, z) { return (x ^ y ^ z) }
  function I(x, y, z) { return (y ^ (x | (~z))) }
  function FF(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b) }
  function GG(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b) }
  function HH(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b) }
  function II(a, b, c, d, x, s, ac) { a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac)); return AddUnsigned(RotateLeft(a, s), b) }
  function ConvertToWordArray(string) {
    var lWordCount, lMessageLength = string.length, lNumberOfWords_temp1 = lMessageLength + 8
    var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64
    var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16
    var lWordArray = Array(lNumberOfWords - 1), lBytePosition = 0, lByteCount = 0
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4
      lBytePosition = (lByteCount % 4) * 8
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition))
      lByteCount++
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4
    lBytePosition = (lByteCount % 4) * 8
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition)
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29
    return lWordArray
  }
  function WordToHex(lValue) {
    var WordToHexValue = '', WordToHexValue_temp = '', lByte, lCount
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255
      WordToHexValue_temp = '0' + lByte.toString(16)
      WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2)
    }
    return WordToHexValue
  }
  function Utf8Encode(string) {
    string = string.replace(/\r\n/g, '\n')
    var utftext = ''
    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n)
      if (c < 128) utftext += String.fromCharCode(c)
      else if ((c > 127) && (c < 2048)) { utftext += String.fromCharCode((c >> 6) | 192); utftext += String.fromCharCode((c & 63) | 128) }
      else { utftext += String.fromCharCode((c >> 12) | 224); utftext += String.fromCharCode(((c >> 6) & 63) | 128); utftext += String.fromCharCode((c & 63) | 128) }
    }
    return utftext
  }
  var x = Array(), k, AA, BB, CC, DD, a, b, c, d
  var S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20
  var S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21
  string = Utf8Encode(string)
  x = ConvertToWordArray(string)
  a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476
  for (k = 0; k < x.length; k += 16) {
    AA = a; BB = b; CC = c; DD = d
    a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478); d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756)
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB); b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE)
    a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF); d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A)
    c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501)
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8); d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF)
    c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1); b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE)
    a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122); d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193)
    c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E); b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821)
    a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562); d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340)
    c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51); b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA)
    a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D); d = GG(d, a, b, c, x[k + 10], S22, 0x2441453)
    c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681); b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8)
    a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6); d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6)
    c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87); b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED)
    a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905); d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8)
    c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9); b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A)
    a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681)
    c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122); b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C)
    a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44); d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9)
    c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60); b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70)
    a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6); d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA)
    c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085); b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05)
    a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039); d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5)
    c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8); b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665)
    a = II(a, b, c, d, x[k + 0], S41, 0xF4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97)
    c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7); b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039)
    a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3); d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92)
    c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D); b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1)
    a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F); d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0)
    c = II(c, d, a, b, x[k + 6], S43, 0xA3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1)
    a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82); d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235)
    c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB); b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391)
    a = AddUnsigned(a, AA); b = AddUnsigned(b, BB); c = AddUnsigned(c, CC); d = AddUnsigned(d, DD)
  }
  return (WordToHex(a) + WordToHex(b) + WordToHex(c) + WordToHex(d)).toLowerCase()
}

// ====== HTTP 请求 ======
function request(opts) {
  return new Promise(function (resolve, reject) {
    const o = {
      url: opts.url,
      method: opts.method || 'POST',
      headers: opts.headers || {},
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
    }
    console.log('[松鲜鲜] REQ: ' + opts.url + (o.body ? ' | ' + o.body.substring(0, 200) : ''))
    if (typeof $httpClient !== 'undefined') {
      $httpClient[o.method.toLowerCase()](o, function (e, r, d) {
        return e ? reject(e) : (console.log('[松鲜鲜] RSP: ' + d), resolve({ status: r.status, body: d }))
      })
    } else if (typeof $task !== 'undefined') {
      o.opts = o.opts || {}
      o.opts.timeout = 30
      $task.fetch(o).then(function (r) {
        console.log('[松鲜鲜] RSP: ' + r.body)
        resolve({ status: r.statusCode, body: r.body })
      }, function (e) {
        console.log('[松鲜鲜] ERR: ' + JSON.stringify(e))
        reject(e)
      })
    } else reject(new Error('no http client'))
  })
}

// ====== 有赞 API ======
function callUmp(method, cookie) {
  return request({
    url: 'https://open.youzan.com/api',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Cookie': cookie,
    },
    body: { method: method, params: {} },
  }).then(function (r) {
    if (r.status !== 200) throw new Error('HTTP ' + r.status)
    return JSON.parse(r.body)
  })
}

// ====== 捕获 Cookie ======
async function rewriteCapture() {
  const store = load()
  const h = $response.headers || {}

  // 从响应 Set-Cookie 中提取(session cookie设置在响应里)
  let cookie = h['Set-Cookie'] || h['set-cookie'] || ''

  // 也尝试从请求头获取(可能后续请求已有cookie)
  if (!cookie) {
    const rh = ($request && $request.headers) || {}
    cookie = rh['Cookie'] || rh['cookie'] || ''
  }

  console.log('[松鲜鲜] 捕获URL: ' + ($request ? $request.url : 'unknown'))
  console.log('[松鲜鲜] Cookie: ' + (cookie ? cookie.substring(0, 80) + '...' : '(空)'))

  if (cookie && cookie !== store.cookie) {
    store.cookie = cookie
    save(store)
    notify('松鲜鲜签到', '已捕获', '可定时签到')
  }
}

// ====== 签到 ======
async function taskRun() {
  const store = load()
  const cookie = store.cookie || ''

  if (!cookie) {
    notify('松鲜鲜签到', '缺少 Cookie', '请先打开小程序浏览签到页面')
    return
  }

  const today = new Date().toISOString().slice(0, 10)

  // 防重签
  if (store.lastSign === today) {
    console.log('[松鲜鲜] 今日已签到，跳过')
    return
  }

  // 查询签到状态
  let alreadySigned = false
  try {
    const statusRes = await callUmp('wsc.ump.checkin.status.get/1.0.0', cookie)
    if (statusRes.code === 0 || statusRes.success) {
      alreadySigned = statusRes.data?.is_sign || statusRes.data?.isSign || statusRes.data?.today_signed || statusRes.data?.todaySigned || false
    }
  } catch (e) {
    console.log('[松鲜鲜] 状态查询失败: ' + e.message)
  }

  if (alreadySigned) {
    store.lastSign = today
    save(store)
    notify('松鲜鲜签到', '今日已签到', '无需重复签到')
    return
  }

  // 执行签到
  try {
    const signRes = await callUmp('wsc.ump.checkin.punch/1.0.0', cookie)
    const code = String(signRes.code || '')
    const msg = signRes.msg || signRes.message || JSON.stringify(signRes).substring(0, 100)

    if (code === '0' || signRes.success) {
      store.lastSign = today
      save(store)
      notify('松鲜鲜签到', '✅ 签到成功', msg)
    } else {
      notify('松鲜鲜签到', '❌ 失败 [' + code + ']', msg)
    }
  } catch (e) {
    const msg = (typeof e === 'string' ? e : e.message || e.error || JSON.stringify(e)).substring(0, 200)
    notify('松鲜鲜签到', '❌ 异常', msg)
  }
}

// ====== Main ======
async function main() {
  try {
    console.log('[松鲜鲜] v1.1.0 | ' + (isRequest ? '重写' : '定时'))
    if (isRequest) { await rewriteCapture(); done() }
    else { await taskRun(); done() }
  } catch (e) {
    const msg = (typeof e === 'string' ? e : e.message || e.error || JSON.stringify(e)).substring(0, 500)
    console.log('[松鲜鲜] 错误: ' + msg)
    notify('松鲜鲜签到', '脚本错误', msg.substring(0, 200))
    done()
  }
}

main()