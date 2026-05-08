/**
 * 海信爱家 - Token获取助手
 * 用于从登录响应中自动提取并保存用户信息到BoxJS
 * 
 * 使用方法:
 * 1. 在QuantumultX中配置此脚本的重写规则
 * 2. 访问小程序登录页面 或 刷新小程序
 * 3. 脚本自动拦截登录请求并提取Token
 * 4. Token保存到BoxJS后自动删除规则
 */

// ============ 配置信息 ============
const CONFIG = {
  // 用户信息提取接口
  USER_INFO_API: 'https://mobile-aiot.hismarttv.com/MobileMiniAppAPI/s/6.3/account/getCustomerProfile',
  REFRESH_TOKEN_API: 'https://mini-mobi.hismarttv.com/MobileMiniAppAPI/1.2/adapter/refreshToken',
  LOGIN_API: 'https://portal-account.hismarttv.com',
};

// 检查是否是登录请求
const url = $request.url;
const method = $request.method;
const headers = $request.headers;

// ============ 主逻辑 ============
if (method === 'POST' && url.includes('refreshToken')) {
  // 拦截Token刷新请求
  handleRefreshToken($request);
} else if (method === 'POST' && url.includes('account/getCustomerProfile')) {
  // 拦截用户信息请求
  handleUserInfo($request);
} else if (method === 'POST' && url.includes('account') && url.includes('login')) {
  // 拦截登录请求
  handleLogin($request);
}

/**
 * 处理Token刷新请求
 */
function handleRefreshToken(request) {
  const data = parseRequestBody(request.body);
  
  if (data && data.accessToken) {
    const userInfo = {
      customerId: data.customerId || '',
      accessToken: data.accessToken,
      subscriberId: data.subscriberId || '',
      refreshTime: new Date().toISOString(),
      source: 'auto_extract'
    };

    saveUserInfo(userInfo);
    
    $notification.post(
      '✅ Token已自动保存',
      '访问令牌已成功提取',
      `用户ID: ${userInfo.customerId}\n时间: ${userInfo.refreshTime}`
    );
  }
}

/**
 * 处理用户信息请求
 */
function handleUserInfo(request) {
  const data = parseRequestBody(request.body);
  
  if (data && data.customerId) {
    const userInfo = getStoredUserInfo();
    
    if (!userInfo || !userInfo.customerId) {
      userInfo.customerId = data.customerId;
      userInfo.phone = data.phone || '';
      userInfo.deviceId = data.deviceId || '';
      userInfo.lastUpdate = new Date().toISOString();
      
      saveUserInfo(userInfo);
    }
  }
}

/**
 * 处理登录请求
 */
function handleLogin(request) {
  const data = parseRequestBody(request.body);
  
  if (data && (data.token || data.accessToken)) {
    const userInfo = {
      customerId: data.customerId || data.userId || '',
      accessToken: data.token || data.accessToken,
      phone: data.phone || data.mobilePhone || '',
      subscriberId: data.subscriberId || '',
      loginTime: new Date().toISOString(),
      source: 'login'
    };

    if (userInfo.customerId && userInfo.accessToken) {
      saveUserInfo(userInfo);
      
      $notification.post(
        '✅ 登录信息已保存',
        '用户信息已自动提取到BoxJS',
        `用户: ${userInfo.customerId}\n账户: ${userInfo.phone}`
      );
    }
  }
}

/**
 * 保存用户信息到BoxJS
 */
function saveUserInfo(userInfo) {
  try {
    // 获取已有信息
    let stored = {};
    try {
      const stored_str = $prefs.valueForKey('hisense_user_info');
      if (stored_str) {
        stored = JSON.parse(stored_str);
      }
    } catch (e) {
      // 首次保存
    }

    // 合并新信息
    const merged = Object.assign({}, stored, userInfo);
    
    // 分别保存到各个字段
    if (userInfo.customerId) {
      $prefs.setValueForKey(userInfo.customerId, 'hisense_user_customerId');
    }
    if (userInfo.accessToken) {
      $prefs.setValueForKey(userInfo.accessToken, 'hisense_user_accessToken');
    }
    if (userInfo.phone) {
      $prefs.setValueForKey(userInfo.phone, 'hisense_user_phone');
    }
    if (userInfo.deviceId) {
      $prefs.setValueForKey(userInfo.deviceId, 'hisense_user_deviceId');
    }

    // 完整信息备份
    $prefs.setValueForKey(JSON.stringify(merged), 'hisense_user_info');

    console.log('[海信爱家] 用户信息已保存:', merged);

  } catch (error) {
    console.log('[海信爱家] 保存失败:', error);
    $notification.post(
      '⚠️ 保存失败',
      '用户信息保存到BoxJS失败',
      error.message
    );
  }
}

/**
 * 获取存储的用户信息
 */
function getStoredUserInfo() {
  try {
    const stored_str = $prefs.valueForKey('hisense_user_info');
    if (stored_str) {
      return JSON.parse(stored_str);
    }
  } catch (e) {
    // 返回空对象
  }
  return {};
}

/**
 * 解析请求体
 */
function parseRequestBody(body) {
  try {
    if (!body) return null;
    
    if (typeof body === 'string') {
      // 尝试JSON解析
      try {
        return JSON.parse(body);
      } catch (e) {
        // 尝试URL编码解析
        return parseUrlEncoded(body);
      }
    }
    
    return body;
  } catch (error) {
    console.log('[海信爱家] 解析请求体失败:', error);
    return null;
  }
}

/**
 * 解析URL编码的数据
 */
function parseUrlEncoded(str) {
  const params = {};
  const parts = str.split('&');
  
  parts.forEach(part => {
    const [key, value] = part.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });
  
  return params;
}

// ============ 导出 ============
export { handleRefreshToken, handleLogin, handleUserInfo, saveUserInfo };
