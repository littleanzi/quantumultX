/*
 * 高德打车·签到脚本
 * 2026-06-11 版本: 2.0.0
 * 签名密钥 (RSA Public Key): MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+8wDPpA9orgXJFrZZXjbETVpdaIlV26Auq46+V3olSimyQBpTfKEKKULcaA+cZ5oXUBZ7o1aDVj7IEadBKOH2eCDUydfJ9PABgLduW668s8jrbqQVM2vzMO6F2sW/23Wc4vas0Rez99OCWgqnEnIvmxQuM4lrKO0wcvX026ic2QIDAQAB
 * 算法: RSA公钥加密(TEA密钥) + TEA加密(请求体) + MD5签名
 * MITM 域名: m5.amap.com, m5-zb.amap.com
 * 重写规则 (Rewrite): ^https?:\/\/(m5(|-zb))\.amap\.com\/ws\/yuece\/(act|openapi\/activity\/current)\/query url script-response-body gaode.js
 * [rewrite_local]
 * ^https?:\/\/(m5(|-zb))\.amap\.com\/ws\/yuece\/(act|openapi\/activity\/current)\/query url script-response-body https://raw.githubusercontent.com/littleanzi/quantumultX/refs/heads/main/script/gaode.js
 * [task_local]
 * 34 5 * * * https://raw.githubusercontent.com/littleanzi/quantumultX/refs/heads/main/script/gaode.js, tag=高德打车, enabled=true
 * [MITM]
 * hostname = *.amap.com
 *
 * 使用方式：
 * 1. 开启重写和 MITM
 * 2. 高德地图 APP → 打车 → 福利中心，自动捕获 Cookie
 * 3. 后续定时任务自动签到，无需手动抓包
 */

const $ = new Env("高德打车签到");
const _key = 'gaode_checkin_data';
var ckobj = $.toObj(getEnv(_key));
$.messages = [];

async function main() {
    intRSA(), intCryptoJS();
    const list = [
        {"name": "APP端", "node": "Amap", "channel": "amap", "actID": "5DRBxfzndQq", "playID": "5DRBxfFiaXN"}
    ];
    for (const index of list) {
        if (await checkIn(index)) {
            await signIn(index)
        }
    }
}

function getQuery(l) {
    const xck = RSA_Public_Encrypt(l.key);
    const _in = Encrypt_Body(Json2Form({"channel": l.channel, "sign": l.sign}), l.key);
    const query = {"adiu": $.adiu, "node": l.node, "env": "prod", "xck_channel": "default", "xck": encodeURIComponent(xck), "in": encodeURIComponent(_in)}
    return Json2Form(query)
}

function getReq(l) {
    const characters = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    l.key = Array.from({length: 16}, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
    l.sign = md5(l.channel + '@oEEln6dQJK7lRfGxQjlyGthZ4loXcRHR').toUpperCase();
    const url = l.url + getQuery(l);
    let body = {
        ...l.addbody,
        "bizVersion": "080700",
        "h5version": "8.87.10",
        "platform": "ios",
        "tid": $.adiu,
        "eId": "",
        "adiu": $.adiu,
        "diu": $.adiu,
        "imei": $.adiu,
        "idfa": $.adiu,
        "enterprise": "0",
        "ts": new Date().getTime(),
        "uid": $.userId,
        "userId": $.userId,
        "channel": l.channel,
        "dip": "20020",
        "adCode": "",
        "actID": l.actID,
        "node": l.node,
        "sign": l.sign
    };
    body = 'in=' + encodeURIComponent(Encrypt_Body(Json2Form(body), l.key));
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 amap/12.13.1.2034 AliApp(amap/12.13.1.2034) NetType/WiFi',
        'sessionid': $.sessionid
    };
    return {url, body, headers};
}

async function checkIn(list) {
    list.addbody = {"playTypes": "dailySign", "playIDs": list.playID};
    list.url = 'https://m5.amap.com/ws/car-place/show?'
    const {code, data, message} = await httpRequest(getReq(list));
    if (code == '1') {
        if (!data.actID) {
            pushMsg(`${list.name}->查询:请到福利中心查看活动是否存在(若存在请联系脚本作者更新)`);
            return false;
        }
        const today = $.time('MM月dd日')
        let foundItem = data?.playMap?.dailySign?.signList?.find(t => t?.date === today);
        if (foundItem) {
            $.signTerm = data?.playMap?.dailySign?.signTerm;
            $.signDay = foundItem.day;
            return true;
        }
    } else {
        pushMsg(`${list.name}->查询:${message}`)
    }
}

async function signIn(list) {
    list.addbody = {playID: list.playID, signTerm: $.signTerm, signType: "1", signDay: $.signDay, div: ""};
    list.url = 'https://m5.amap.com/ws/alice/activity/daily_sign/do_sign?';
    const {code, message} = await httpRequest(getReq(list));
    pushMsg(`${list.name}->签到: ${code === '1' ? '签到成功' : message}`);
}

function getToken() {
    if (!$request || $request.method === 'OPTIONS') return;
    let abc = {}, mark = '';
    if (/\/common\/(alipaymini|wxmini)\?_ENCRYPT=/.test($request.url)) {
        let encryptedData = $request.url.split("_ENCRYPT=")[1].split("&")[0];
        let decodedData = base64decode(encryptedData);
        decodedData.split('&').forEach(item => {let [key, value] = item.split('=');abc[key] = value;});
        abc.userId = abc.userId;
        abc.adiu = abc.deviceId;
        abc.sessionid = abc.sessionId;
        mark = '小程序';
    } else {
        let responseData = $.toObj($response.body);
        abc.userId = responseData.content.uid;
        abc.adiu = responseData.content.adiu;
        let headers = ObjectKeys2LowerCase($request.headers);
        abc.sessionid = headers['sessionid'] || headers['cookie']?.split("sessionid=")[1]?.split(";")[0];
        mark = 'Cookie';
    }
    if (abc.sessionid && abc.sessionid.length > 30) {
        $.setdata($.toStr(abc), _key);
        $.msg($.name, `从${mark}:获取签到sessionid成功🎉`, $.toStr(abc));
    }
}

!(async () => {
    if(typeof $request !== `undefined`){
        getToken();
        return;
    }
    if (!ckobj || !ckobj.sessionid || ckobj.sessionid.length < 30) {
        sendMsg('❌请先获取sessionid🎉')
        return;
    }
    $.userId = ckobj.userId;
    $.sessionid = ckobj.sessionid;
    $.adiu = ckobj.adiu;
    await main();
})().catch((e) => $.messages.push(e.message || e) && $.logErr(e))
    .finally(async () => {
        await sendMsg($.messages.join('\n'));
        $.done();
    })

function pushMsg(msg){msg=msg.trimStart().trimEnd(),$.messages.push(msg),$.log(msg)};

async function httpRequest(options){try{options=options.url?options:{url:options};const _method=options?._method||('body'in options?'post':'get');const _respType=options?._respType||'body';const _timeout=options?._timeout||15e3;const _http=[new Promise((_,reject)=>setTimeout(()=>reject(`请求超时:${options['url']}`),_timeout)),new Promise((resolve,reject)=>{debug(options,'[Request]');$[_method.toLowerCase()](options,(error,response,data)=>{debug(data,'[响应body]');error&&$.log($.toStr(error));if(_respType!=='all'){resolve($.toObj(response?.[_respType],response?.[_respType]));}else{resolve(response);}})})];return await Promise.race(_http);}catch(err){$.logErr(err);}}

function debug(content,title="debug"){let start=`┌---------------↓↓${title}↓↓---------------\n`;let end=`\n└---------------↑↑${$.time('HH:mm:ss')}↑↑---------------`;if($.is_debug==='true'){if(typeof content=="string"){$.log(start+content.replace(/\s+/g,'')+end);}else if(typeof content=="object"){$.log(start+$.toStr(content)+end);}}};

function Json2Form(obj){return Object.keys(obj).sort().map(key=>`${key}=${obj[key]}`).join('&');}

// ====== CryptoJS ======
function intCryptoJS(){CryptoJS=function(t,r){var n;if("undefined"!=typeof window&&window.crypto&&(n=window.crypto),"undefined"!=typeof self&&self.crypto&&(n=self.crypto),"undefined"!=typeof globalThis&&globalThis.crypto&&(n=globalThis.crypto),!n&&"undefined"!=typeof window&&window.msCrypto&&(n=window.msCrypto),!n&&"undefined"!=typeof global&&global.crypto&&(n=global.crypto),!n&&"function"==typeof require)try{n=require("crypto")}catch(t){}var e=function(){if(n){if("function"==typeof n.getRandomValues)try{return n.getRandomValues(new Uint32Array(1))[0]}catch(t){}if("function"==typeof n.randomBytes)try{return n.randomBytes(4).readInt32LE()}catch(t){}}throw new Error("Native crypto module could not be used to get secure random number.")},i=Object.create||function(){function t(){}return function(r){var n;return t.prototype=r,n=new t,t.prototype=null,n}}(),o={},a=o.lib={},s=a.Base={extend:function(t){var r=i(this);return t&&r.mixIn(t),r.hasOwnProperty("init")&&this.init!==r.init||(r.init=function(){r.$super.init.apply(this,arguments)}),r.init.prototype=r,r.$super=this,r},create:function(){var t=this.extend();return t.init.apply(t,arguments),t},init:function(){},mixIn:function(t){for(var r in t)t.hasOwnProperty(r)&&(this[r]=t[r]);t.hasOwnProperty("toString")&&(this.toString=t.toString)},clone:function(){return this.init.prototype.extend(this)}},c=a.WordArray=s.extend({init:function(t,r){t=this.words=t||[],this.sigBytes=null!=r?r:4*t.length},toString:function(t){return(t||f).stringify(this)},concat:function(t){var r=this.words,n=t.words,e=this.sigBytes,i=t.sigBytes;if(this.clamp(),e%4)for(var o=0;o<i;o++){var a=n[o>>>2]>>>24-o%4*8&255;r[e+o>>>2]|=a<<24-(e+o)%4*8}else for(var s=0;s<i;s+=4)r[e+s>>>2]=n[s>>>2];return this.sigBytes+=i,this},clamp:function(){var r=this.words,n=this.sigBytes;r[n>>>2]&=4294967295<<32-n%4*8,r.length=t.ceil(n/4)},clone:function(){var t=s.clone.call(this);return t.words=this.words.slice(0),t},random:function(r){var n,i=[],o=function(r){r=r;var n=987654321,e=4294967295;return function(){var i=((n=36969*(65535&n)+(n>>16)&e)<<16)+(r=18e3*(65535&r)+(r>>16)&e)&e;return i/=4294967296,(i+=.5)*(t.random()>.5?1:-1)}},a=!1;try{e(),a=!0}catch(t){}for(var s,u=0;u<r;u+=4)a?i.push(e()):(s=987654071*(n=o(4294967296*(s||t.random())))(),i.push(4294967296*n()|0));return new c.init(i,r)}}),u=o.enc={},f=u.Hex={stringify:function(t){for(var r=t.words,n=t.sigBytes,e=[],i=0;i<n;i++){var o=r[i>>>2]>>>24-i%4*8&255;e.push((o>>>4).toString(16)),e.push((15&o).toString(16))}return e.join("")},parse:function(t){for(var r=t.length,n=[],e=0;e<r;e+=2)n[e>>>3]|=parseInt(t.substr(e,2),16)<<24-e%8*4;return new c.init(n,r/2)}},h=u.Latin1={stringify:function(t){for(var r=t.words,n=t.sigBytes,e=[],i=0;i<n;i++){var o=r[i>>>2]>>>24-i%4*8&255;e.push(String.fromCharCode(o))}return e.join("")},parse:function(t){for(var r=t.length,n=[],e=0;e<r;e++)n[e>>>2]|=(255&t.charCodeAt(e))<<24-e%4*8;return new c.init(n,r)}},p=u.Utf8={stringify:function(t){try{return decodeURIComponent(escape(h.stringify(t)))}catch(t){throw new Error("Malformed UTF-8 data")}},parse:function(t){return h.parse(unescape(encodeURIComponent(t)))}},d=a.BufferedBlockAlgorithm=s.extend({reset:function(){this._data=new c.init,this._nDataBytes=0},_append:function(t){"string"==typeof t&&(t=p.parse(t)),this._data.concat(t),this._nDataBytes+=t.sigBytes},_process:function(r){var n,e=this._data,i=e.words,o=e.sigBytes,a=this.blockSize,s=o/(4*a),u=(s=r?t.ceil(s):t.max((0|s)-this._minBufferSize,0))*a,f=t.min(4*u,o);if(u){for(var h=0;h<u;h+=a)this._doProcessBlock(i,h);n=i.splice(0,u),e.sigBytes-=f}return new c.init(n,f)},clone:function(){var t=s.clone.call(this);return t._data=this._data.clone(),t},_minBufferSize:0}),l=(a.Hasher=d.extend({cfg:s.extend(),init:function(t){this.cfg=this.cfg.extend(t),this.reset()},reset:function(){d.reset.call(this),this._doReset()},update:function(t){return this._append(t),this._process(),this},finalize:function(t){return t&&this._append(t),this._doFinalize()},blockSize:16,_createHelper:function(t){return function(r,n){return new t.init(n).finalize(r)}},_createHmacHelper:function(t){return function(r,n){return new l.HMAC.init(t,n).finalize(r)}}}),o.algo={});return o}(Math);!function(t){var r=CryptoJS,n=r.lib,e=n.WordArray,i=n.Hasher,o=r.algo,a=[];!function(){for(var r=0;r<64;r++)a[r]=4294967296*t.abs(t.sin(r+1))|0}();var s=o.MD5=i.extend({_doReset:function(){this._hash=new e.init([1732584193,4023233417,2562383102,271733878])},_doProcessBlock:function(t,r){for(var n=0;n<16;n++){var e=r+n,i=t[e];t[e]=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8)}var o=this._hash.words,s=t[r+0],p=t[r+1],d=t[r+2],l=t[r+3],y=t[r+4],v=t[r+5],g=t[r+6],w=t[r+7],_=t[r+8],m=t[r+9],B=t[r+10],b=t[r+11],C=t[r+12],S=t[r+13],x=t[r+14],A=t[r+15],H=o[0],z=o[1],M=o[2],D=o[3];z=h(z=h(z=h(z=h(z=f(z=f(z=f(z=f(z=u(z=u(z=u(z=u(z=c(z=c(z=c(z=c(z,M=c(M,D=c(D,H=c(H,z,M,D,s,7,a[0]),z,M,p,12,a[1]),H,z,d,17,a[2]),D,H,l,22,a[3]),M=c(M,D=c(D,H=c(H,z,M,D,y,7,a[4]),z,M,v,12,a[5]),H,z,g,17,a[6]),D,H,w,22,a[7]),M=c(M,D=c(D,H=c(H,z,M,D,_,7,a[8]),z,M,m,12,a[9]),H,z,B,17,a[10]),D,H,b,22,a[11]),M=c(M,D=c(D,H=c(H,z,M,D,C,7,a[12]),z,M,S,12,a[13]),H,z,x,17,a[14]),D,H,A,22,a[15]),M=u(M,D=u(D,H=u(H,z,M,D,p,5,a[16]),z,M,g,9,a[17]),H,z,b,14,a[18]),D,H,s,20,a[19]),M=u(M,D=u(D,H=u(H,z,M,D,v,5,a[20]),z,M,B,9,a[21]),H,z,A,14,a[22]),D,H,y,20,a[23]),M=u(M,D=u(D,H=u(H,z,M,D,m,5,a[24]),z,M,x,9,a[25]),H,z,l,14,a[26]),D,H,_,20,a[27]),M=u(M,D=u(D,H=u(H,z,M,D,S,5,a[28]),z,M,d,9,a[29]),H,z,w,14,a[30]),D,H,C,20,a[31]),M=f(M,D=f(D,H=f(H,z,M,D,v,4,a[32]),z,M,_,11,a[33]),H,z,b,16,a[34]),D,H,x,23,a[35]),M=f(M,D=f(D,H=f(H,z,M,D,p,4,a[36]),z,M,y,11,a[37]),H,z,w,16,a[38]),D,H,B,23,a[39]),M=f(M,D=f(D,H=f(H,z,M,D,S,4,a[40]),z,M,s,11,a[41]),H,z,l,16,a[42]),D,H,g,23,a[43]),M=f(M,D=f(D,H=f(H,z,M,D,m,4,a[44]),z,M,C,11,a[45]),H,z,A,16,a[46]),D,H,d,23,a[47]),M=h(M,D=h(D,H=h(H,z,M,D,s,6,a[48]),z,M,w,10,a[49]),H,z,x,15,a[50]),D,H,v,21,a[51]),M=h(M,D=h(D,H=h(H,z,M,D,C,6,a[52]),z,M,l,10,a[53]),H,z,B,15,a[54]),D,H,p,21,a[55]),M=h(M,D=h(D,H=h(H,z,M,D,_,6,a[56]),z,M,A,10,a[57]),H,z,g,15,a[58]),D,H,S,21,a[59]),M=h(M,D=h(D,H=h(H,z,M,D,y,6,a[60]),z,M,b,10,a[61]),H,z,d,15,a[62]),D,H,m,21,a[63]),o[0]=o[0]+H|0,o[1]=o[1]+z|0,o[2]=o[2]+M|0,o[3]=o[3]+D|0},_doFinalize:function(){var r=this._data,n=r.words,e=8*this._nDataBytes,i=8*r.sigBytes;n[i>>>5]|=128<<24-i%32;var o=t.floor(e/4294967296),a=e;n[15+(i+64>>>9<<4)]=16711935&(o<<8|o>>>24)|4278255360&(o<<24|o>>>8),n[14+(i+64>>>9<<4)]=16711935&(a<<8|a>>>24)|4278255360&(a<<24|a>>>8),r.sigBytes=4*(n.length+1),this._process();for(var s=this._hash,c=s.words,u=0;u<4;u++){var f=c[u];c[u]=16711935&(f<<8|f>>>24)|4278255360&(f<<24|f>>>8)}return s},clone:function(){var t=i.clone.call(this);return t._hash=this._hash.clone(),t}});function c(t,r,n,e,i,o,a){var s=t+(r&n|~r&e)+i+a;return(s<<o|s>>>32-o)+r}function u(t,r,n,e,i,o,a){var s=t+(r&e|n&~e)+i+a;return(s<<o|s>>>32-o)+r}function f(t,r,n,e,i,o,a){var s=t+(r^n^e)+i+a;return(s<<o|s>>>32-o)+r}function h(t,r,n,e,i,o,a){var s=t+(n^(r|~e))+i+a;return(s<<o|s>>>32-o)+r}r.MD5=i._createHelper(s),r.HmacMD5=i._createHmacHelper(s)}(Math),function(){var t=CryptoJS,r=t.lib.WordArray;t.enc.Base64={stringify:function(t){var r=t.words,n=t.sigBytes,e=this._map;t.clamp();for(var i=[],o=0;o<n;o+=3)for(var a=(r[o>>>2]>>>24-o%4*8&255)<<16|(r[o+1>>>2]>>>24-(o+1)%4*8&255)<<8|r[o+2>>>2]>>>24-(o+2)%4*8&255,s=0;s<4&&o+.75*s<n;s++)i.push(e.charAt(a>>>6*(3-s)&63));var c=e.charAt(64);if(c)for(;i.length%4;)i.push(c);return i.join("")},parse:function(t){var n=t.length,e=this._map,i=this._reverseMap;if(!i){i=this._reverseMap=[];for(var o=0;o<e.length;o++)i[e.charCodeAt(o)]=o}var a=e.charAt(64);if(a){var s=t.indexOf(a);-1!==s&&(n=s)}return function(t,n,e){for(var i=[],o=0,a=0;a<n;a++)if(a%4){var s=e[t.charCodeAt(a-1)]<<a%4*2,c=e[t.charCodeAt(a)]>>>6-a%4*2;i[o>>>2]|=(s|c)<<24-o%4*8,o++}return r.create(i,o)}(t,n,i)},_map:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="}}();};function md5(word){return CryptoJS.MD5(word).toString();}

// ====== RSA ======
function intRSA(){RSA={};!function(exports){var window={},navigator={},dbits;function BigInteger(t,e,i){null!=t&&("number"==typeof t?this.fromNumber(t,e,i):null==e&&"string"!=typeof t?this.fromString(t,256):this.fromString(t,e))}function nbi(){return new BigInteger(null)}var canary=0xdeadbeefcafe,j_lm=15715070==(16777215&canary);function am1(t,e,i,r,n,s){for(;--s>=0;){var o=e*this[t++]+i[r]+n;n=Math.floor(o/67108864),i[r++]=67108863&o}return n}function am2(t,e,i,r,n,s){for(var o=32767&e,h=e>>15;--s>=0;){var a=32767&this[t],u=this[t++]>>15,p=h*a+u*o;n=((a=o*a+((32767&p)<<15)+i[r]+(1073741823&n))>>>30)+(p>>>15)+h*u+(n>>>30),i[r++]=1073741823&a}return n}function am3(t,e,i,r,n,s){for(var o=16383&e,h=e>>14;--s>=0;){var a=16383&this[t],u=this[t++]>>14,p=h*a+u*o;n=((a=o*a+((16383&p)<<14)+i[r]+n)>>28)+(p>>14)+h*u,i[r++]=268435455&a}return n}j_lm&&"Microsoft Internet Explorer"==navigator.appName?(BigInteger.prototype.am=am2,dbits=30):j_lm&&"Netscape"!=navigator.appName?(BigInteger.prototype.am=am1,dbits=26):(BigInteger.prototype.am=am3,dbits=28),BigInteger.prototype.DB=dbits,BigInteger.prototype.DM=(1<<dbits)-1,BigInteger.prototype.DV=1<<dbits;var BI_FP=52;BigInteger.prototype.FV=Math.pow(2,BI_FP),BigInteger.prototype.F1=BI_FP-dbits,BigInteger.prototype.F2=2*dbits-BI_FP;var BI_RM="0123456789abcdefghijklmnopqrstuvwxyz",BI_RC=new Array,rr,vv;for(rr="0".charCodeAt(0),vv=0;vv<=9;++vv)BI_RC[rr++]=vv;for(rr="a".charCodeAt(0),vv=10;vv<36;++vv)BI_RC[rr++]=vv;for(rr="A".charCodeAt(0),vv=10;vv<36;++vv)BI_RC[rr++]=vv;function int2char(t){return BI_RM.charAt(t)}function intAt(t,e){var i=BI_RC[t.charCodeAt(e)];return null==i?-1:i}RSAKey.prototype.doPublic=RSADoPublic,RSAKey.prototype.setPublic=RSASetPublic,RSAKey.prototype.encrypt_public=RSAPublicEncrypt,RSAKey.prototype.encrypt_private=RSAPrivateEncrypt,RSAKey.prototype.doPrivate=RSADoPrivate,RSAKey.prototype.setPrivate=RSASetPrivate,RSAKey.prototype.setPrivateEx=RSASetPrivateEx,RSAKey.prototype.generate=RSAGenerate,RSAKey.prototype.decrypt_private=RSAPrivateDecrypt,RSAKey.prototype.decrypt_public=RSAPublicDecrypt;var b64map="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",b64pad="=";function hex2b64(t){var e,i,r="";for(e=0;e+3<=t.length;e+=3)i=parseInt(t.substring(e,e+3),16),r+=b64map.charAt(i>>6)+b64map.charAt(63&i);for(e+1==t.length?(i=parseInt(t.substring(e,e+1),16),r+=b64map.charAt(i<<2)):e+2==t.length&&(i=parseInt(t.substring(e,e+2),16),r+=b64map.charAt(i>>2)+b64map.charAt((3&i)<<4));(3&r.length)>0;)r+=b64pad;return r}function b64tohex(t){var e,i,r="",n=0;for(e=0;e<t.length&&t.charAt(e)!=b64pad;++e)v=b64map.indexOf(t.charAt(e)),v<0||(0==n?(r+=int2char(v>>2),i=3&v,n=1):1==n?(r+=int2char(i<<2|v>>4),i=15&v,n=2):2==n?(r+=int2char(i),r+=int2char(v>>2),i=3&v,n=3):(r+=int2char(i<<2|v>>4),r+=int2char(15&v),n=0));return 1==n&&(r+=int2char(i<<2)),r}function b64toBA(t){var e,i=b64tohex(t),r=new Array;for(e=0;2*e<i.length;++e)r[e]=parseInt(i.substring(2*e,2*e+2),16);return r}function parseBigInt(t,e){return new BigInteger(t,e)}function pkcs1pad2(t,e,i){if(e<t.length+11)return console.error("Message too long for RSA"),null;for(var r=new Array,n=t.length-1;n>=0&&e>0;){var s=t.charCodeAt(n--);s<128?r[--e]=s:s>127&&s<2048?(r[--e]=63&s|128,r[--e]=s>>6|192):(r[--e]=63&s|128,r[--e]=s>>6&63|128,r[--e]=s>>12|224)}if(r[--e]=0,2==i)for(var o=new SecureRandom,h=new Array;e>2;){for(h[0]=0;0==h[0];)o.nextBytes(h);r[--e]=h[0]}else if(0==i)r[--e]=0;else for(;e>2;)r[--e]=255;return r[--e]=i,r[--e]=0,new BigInteger(r)}function RSAKey(){this.n=null,this.e=0,this.d=null,this.p=null,this.q=null,this.dmp1=null,this.dmq1=null,this.coeff=null}function RSASetPublic(t,e){null!=t&&null!=e&&t.length>0&&e.length>0?(this.n=parseBigInt(t,16),this.e=parseInt(e,16)):console.error("Invalid RSA public key")}function RSADoPublic(t){return t.modPowInt(this.e,this.n)}function RSAPublicEncrypt(t,e){var i=pkcs1pad2(t,this.n.bitLength()+7>>3,e);if(null==i)return null;var r=this.doPublic(i);if(null==r)return null;var n=r.toString(16);return 0==(1&n.length)?n:"0"+n}function RSAPrivateEncrypt(t,e){var i=pkcs1pad2(t,this.n.bitLength()+7>>3,e);if(null==i)return null;var r=this.doPrivate(i);if(null==r)return null;var n=r.toString(16);return 0==(1&n.length)?n:"0"+n}function RSAGenerate(t,e){var i=new SecureRandom,r=t>>1;this.e=parseInt(e,16);for(var n=new BigInteger(e,16);;){for(;this.p=new BigInteger(t-r,1,i),0!=this.p.subtract(BigInteger.ONE).gcd(n).compareTo(BigInteger.ONE)||!this.p.isProbablePrime(10););for(;this.q=new BigInteger(r,1,i),0!=this.q.subtract(BigInteger.ONE).gcd(n).compareTo(BigInteger.ONE)||!this.q.isProbablePrime(10););if(this.p.compareTo(this.q)<=0){var s=this.p;this.p=this.q,this.q=s}var o=this.p.subtract(BigInteger.ONE),h=this.q.subtract(BigInteger.ONE),a=o.multiply(h);if(0==a.gcd(n).compareTo(BigInteger.ONE)){this.n=this.p.multiply(this.q),this.d=n.modInverse(a),this.dmp1=this.d.mod(o),this.dmq1=this.d.mod(h),this.coeff=this.q.modInverse(this.p);break}}}function RSADoPrivate(t){if(null==this.p||null==this.q)return t.modPow(this.d,this.n);for(var e=t.mod(this.p).modPow(this.dmp1,this.p),i=t.mod(this.q).modPow(this.dmq1,this.q);e.compareTo(i)<0;)e=e.add(this.p);return e.subtract(i).multiply(this.coeff).mod(this.p).multiply(this.q).add(i)}function RSAPrivateDecrypt(t,e){var i=parseBigInt(t,16),r=this.doPrivate(i);return null==r?null:pkcs1unpad2(r,this.n.bitLength()+7>>3,e)}function RSAPublicDecrypt(t,e){var i=parseBigInt(t,16),r=this.doPublic(i);return null==r?null:pkcs1unpad2(r,this.n.bitLength()+7>>3,e)}function pkcs1unpad2(t,e,i){var r=t.toByteArray(),n=0;if(0==i)n=-1;else{for(;n<r.length&&0==r[n];)++n;if(r.length-n!=e-1||r[n]!=i)return null;for(++n;0!=r[n];)if(++n>=r.length)return null}for(var s="";++n<r.length;){var o=255&r[n];o<128?s+=String.fromCharCode(o):o>191&&o<224?(s+=String.fromCharCode((31&o)<<6|63&r[n+1]),++n):(s+=String.fromCharCode((15&o)<<12|(63&r[n+1])<<6|63&r[n+2]),n+=2)}return s}function SecureRandom(){}function Arcfour(){this.i=0,this.j=0,this.S=new Array}function ARC4init(t){var e,i,r;for(e=0;e<256;++e)this.S[e]=e;for(i=0,e=0;e<256;++e)i=i+this.S[e]+t[e%t.length]&255,r=this.S[e],this.S[e]=this.S[i],this.S[i]=r;this.i=0,this.j=0}function ARC4next(){var t;return this.i=this.i+1&255,this.j=this.j+this.S[this.i]&255,t=this.S[this.i],this.S[this.i]=this.S[this.j],this.S[this.j]=t,this.S[t+this.S[this.i]&255]}function prng_newstate(){return new Arcfour}Arcfour.prototype.init=ARC4init,Arcfour.prototype.next=ARC4next;var rng_psize=256,rng_state,rng_pool,rng_pptr;if(null==rng_pool){var t;if(rng_pool=new Array,rng_pptr=0,window.crypto&&window.crypto.getRandomValues){var z=new Uint32Array(256);for(window.crypto.getRandomValues(z),t=0;t<z.length;++t)rng_pool[rng_pptr++]=255&z[t]}}function rng_get_byte(){if(null==rng_state){for(rng_state=prng_newstate();rng_pptr<rng_psize;){var t=Math.floor(65536*Math.random());rng_pool[rng_pptr++]=255&t}for(rng_state.init(rng_pool),rng_pptr=0;rng_pptr<rng_pool.length;++rng_pptr)rng_pool[rng_pptr]=0;rng_pptr=0}return rng_state.next()}function rng_get_bytes(t){var e;for(e=0;e<t.length;++e)t[e]=rng_get_byte()}SecureRandom.prototype.nextBytes=rng_get_bytes;var JSEncryptRSAKey=function(t){RSAKey.call(this),t&&("string"==typeof t?this.parseKey(t):(this.hasPrivateKeyProperty(t)||this.hasPublicKeyProperty(t))&&this.parsePropertiesFrom(t))};JSEncryptRSAKey.prototype=new RSAKey,JSEncryptRSAKey.prototype.constructor=JSEncryptRSAKey;var JSEncrypt=function(t){t=t||{},this.default_key_size=parseInt(t.default_key_size)||1024,this.default_public_exponent=t.default_public_exponent||"010001",this.log=t.log||!1,this.key=null};JSEncrypt.prototype.setKey=function(t){this.log&&this.key&&console.warn("A key was already set, overriding existing."),this.key=new JSEncryptRSAKey(t)},JSEncrypt.prototype.setPublicKey=function(t){this.setKey(t)},JSEncrypt.prototype.setPrivateKey=function(t){this.setKey(t)},JSEncrypt.prototype.getKey=function(t){if(!this.key){if(this.key=new JSEncryptRSAKey,t&&"[object Function]"==={}.toString.call(t))return void this.key.generateAsync(this.default_key_size,this.default_public_exponent,t);this.key.generate(this.default_key_size,this.default_public_exponent)}return this.key},JSEncrypt.prototype.public_encryptLong=function(string,padding,output){var k=this.getKey(),maxLength=(k.n.bitLength()+7>>3)-11;try{var lt="",ct="";if(string.length>maxLength)return lt=string.match(eval("/.{1,"+maxLength+"}/g")),lt.forEach(function(t){var e=k.encrypt_public(t,padding);ct+=e}),output?hex2b64(ct):ct;var t=k.encrypt_public(string,padding),y=output?hex2b64(t):t;return y}catch(t){return!1}},JSEncrypt.prototype.setPublic=RSASetPublic,JSEncrypt.version="2.3.0",exports.JSEncrypt=JSEncrypt}(RSA);};function RSA_Public_Encrypt(t){var public_key="MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+8wDPpA9orgXJFrZZXjbETVpdaIlV26Auq46+V3olSimyQBpTfKEKKULcaA+cZ5oXUBZ7o1aDVj7IEadBKOH2eCDUydfJ9PABgLduW668s8jrbqQVM2vzMO6F2sW/23Wc4vas0Rez99OCWgqnEnIvmxQuM4lrKO0wcvX026ic2QIDAQAB";var Crypt=new RSA.JSEncrypt;return Crypt.setPublicKey(public_key),Crypt.public_encryptLong(t,2,true)}

// ====== TEA 加解密 ======
function base64encode(r){for(var n,e,t,o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",a="",i=0,f=r.length;i<f;){if(n=255&r.charCodeAt(i++),i==f){a+=o.charAt(n>>2),a+=o.charAt((3&n)<<4),a+="==";break}if(e=r.charCodeAt(i++),i==f){a+=o.charAt(n>>2),a+=o.charAt((3&n)<<4|(240&e)>>4),a+=o.charAt((15&e)<<2),a+="=";break}t=r.charCodeAt(i++),a+=o.charAt(n>>2),a+=o.charAt((3&n)<<4|(240&e)>>4),a+=o.charAt((15&e)<<2|(192&t)>>6),a+=o.charAt(63&t)}return a}
function base64decode(r){for(var n,e,t,o,a="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",i="",f=0,c=r.length;f<c;){do{n=a.indexOf(r.charAt(f++))}while(f<c&&-1==n);if(-1==n)break;do{e=a.indexOf(r.charAt(f++))}while(f<c&&-1==e);if(-1==e)break;i+=String.fromCharCode(n<<2|(48&e)>>4);do{if("="==(t=r.charAt(f++)))return i;t=a.indexOf(t)}while(f<c&&-1==t);if(-1==t)break;i+=String.fromCharCode((15&e)<<4|(60&t)>>2);do{if("="==(o=r.charAt(f++)))return i;o=a.indexOf(o)}while(f<c&&-1==o);if(-1==o)break;i+=String.fromCharCode((3&t)<<6|o)}return i}
function padAndConvertToUint32Array(r,n){var e,t=4-r.length%4;e=n?0==(3&r.length)?r.length>>>2:1+(r.length>>>2):r.length/4+1;for(var o=new Uint32Array(Math.floor(e)),a=(t<<24)+(t<<16)+(t<<8)+t,i=0;i<e;++i)o[i]=a;for(e=r.length,i=0;i<e;++i)o[i>>>2]&=~(255<<((3&i)<<3)),o[i>>>2]|=(255&r[i])<<((3&i)<<3);return o}
function ensureMinLength16(r){if(r.length<16){var n=new Uint8Array(16);n.set(r),r=n}return r}
function complexBitwiseOperation(r,n,e,t,o,a){return(e>>>5^n<<2)+(n>>>3^e<<4)^(r^n)+(a[3&t^o]^e)}
function convertToUint8Array(r,n){var e=r.length,t=e<<2;if(n){var o=r[e-1];if(o<(t-=4)-3||o>t)return null;t=o}for(var a=new Uint8Array(Math.floor(t)),i=0;i<t;++i)a[i]=r[i>>2]>>((3&i)<<3);return a}
function utf8Encode(r){for(var n=r.length,e=new Uint8Array(Math.floor(3*n+1)),t=0,o=0;o<n;o++){var a=r.charCodeAt(o);if(a<128)e[t++]=a;else if(a<2048)e[t++]=192|a>>6,e[t++]=128|63&a;else{if(!(a<55296||a>57343)){if(o+1<n){var i=r.charCodeAt(o+1);if(a<56320&&56320<=i&&i<=57343){var f=65536+((1023&a)<<10|1023&i);e[t++]=240|f>>18,e[t++]=128|f>>12&63,e[t++]=128|f>>6&63,e[t++]=128|63&f,o++;continue}}throw new Error("Malformed string")}e[t++]=224|a>>12,e[t++]=128|a>>6&63,e[t++]=128|63&a}}return e.subarray(0,t+1)}
function encryptAndEncode(r,n){return"string"==typeof r&&(r=utf8Encode(r)),"string"==typeof n&&(n=utf8Encode(n)),null==r||0===r.length?r:convertToUint8Array(function(r,n){var e,t,o,a,i,f,c=r.length,h=c-1;for(t=r[h],o=0,f=0|Math.floor(6+52/c);f>0;--f){for(a=(o+=2654435769)>>>2&3,i=0;i<h;++i)e=r[i+1],t=r[i]+=complexBitwiseOperation(o,e,t,i,a,n);e=r[0],t=r[h]+=complexBitwiseOperation(o,e,t,i,a,n)}return r}(padAndConvertToUint32Array(r,!1),padAndConvertToUint32Array(ensureMinLength16(n),!1)),!1)}
function encodeToBase64(r){for(var n="",e=new Uint8Array(r),t=e.byteLength,o=0;o<t;o++)n+=String.fromCharCode(e[o]);return base64encode(n)}
function Encrypt_Body(r,n){return encodeToBase64(encryptAndEncode(r,n))}

function getEnv(...keys){for(let key of keys){var value=$.isNode()?process.env[key]||process.env[key.toUpperCase()]||process.env[key.toLowerCase()]||$.getdata(key):$.getdata(key);if(value)return value;}};

async function sendMsg(message){if(!message)return;try{if($.isNode()){try{var notify=require('./sendNotify');}catch(e){var notify=require('./utils/sendNotify');}await notify.sendNotify($.name,message);}else{$.msg($.name,'',message);}}catch(e){$.log(`\n\n-----${$.name}-----\n${message}`);}};

function ObjectKeys2LowerCase(obj){return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k.toLowerCase(),v]))};

// ====== ENV ======
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,a)=>{s.call(this,t,(t,s,r)=>{t?a(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const a=this.getdata(t);if(a)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,a)=>e(a))})}runScript(t,e){return new Promise(s=>{let a=this.getdata("@chavy_boxjs_userCfgs.httpapi");a=a?a.replace(/\n/g,"").trim():a;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[i,o]=a.split("@"),n={url:`http://${o}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":i,Accept:"*/*"},timeout:r};this.post(n,(t,e,a)=>s(a))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e);if(!s&&!a)return{};{const a=s?t:e;try{return JSON.parse(this.fs.readFileSync(a))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):a?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,a)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[a+1])>>0==+e[a+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,a]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,a,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,a,r]=/^@(.*?)\.(.*?)$/.exec(e),i=this.getval(a),o=a?"null"===i?null:i||"{}":"{}";try{const e=JSON.parse(o);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),a)}catch(e){const i={};this.lodash_set(i,r,t),s=this.setval(JSON.stringify(i),a)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,a)=>{!t&&s&&(s.body=a,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,a)});break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:a,headers:r,body:i,bodyBytes:o}=t;e(null,{status:s,statusCode:a,headers:r,body:i,bodyBytes:o},i,o)},t=>e(t&&t.error||"UndefinedError"));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:a,statusCode:r,headers:i,rawBody:o}=t,n=s.decode(o,this.encoding);e(null,{status:a,statusCode:r,headers:i,rawBody:o,body:n},n)},t=>{const{message:a,response:r}=t;e(a,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,a)=>{!t&&s&&(s.body=a,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,a)});break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:a,headers:r,body:i,bodyBytes:o}=t;e(null,{status:s,statusCode:a,headers:r,body:i,bodyBytes:o},i,o)},t=>e(t&&t.error||"UndefinedError"));break;case"Node.js":let a=require("iconv-lite");this.initGotEnv(t);const{url:r,...i}=t;this.got[s](r,i).then(t=>{const{statusCode:s,statusCode:r,headers:i,rawBody:o}=t,n=a.decode(o,this.encoding);e(null,{status:s,statusCode:r,headers:i,rawBody:o,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&a.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let a={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};return/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length))),t.replace(new RegExp("("+Object.keys(a).join("|")+")","g"),function(t){return t in a?1==RegExp.$1.length?a[t]:("00"+a[t]).substr((""+a[t]).length):t})}queryStr(t){let e="";for(const s in t){let a=t[s];null!=a&&""!==a&&("object"==typeof a&&(a=JSON.stringify(a)),e+=`${s}=${a}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",a="",r){const i=this.isNode()?t=>t:function(t){switch(typeof t){case void 0:return t;case"string":switch(this.getEnv()){case"Surge":case"Stash":default:return{url:t};case"Loon":case"Shadowrocket":return t;case"Quantumult X":return{"open-url":t};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":default:{let e=t.url||t.openUrl||t["open-url"];return{url:e}}case"Loon":{let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}case"Quantumult X":{let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,a=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":a}}default:return}}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,a,i(r));break;case"Quantumult X":$notify(e,s,a,i(r));break;case"Node.js":}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),a&&t.push(a),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,t);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,t.stack)}}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":process.exit(1)}}}(t,e)}
