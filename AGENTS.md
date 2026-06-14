# 通用工作规范

## Quantumult X 脚本开发
- 每次写 Quantumult X 签到脚本前，先查阅量子重写规则使用文档，了解 `$task.fetch`、`$persistentStore` 等 API 的正确用法
- Quantumult X没有内置加密函数，需要纯JS实现
— 使用与erke.js相同的可靠SHA1实现
- 通知用 `$.notify()`，不是 `$.msg()`——后者只写控制台日志，不弹通知
- 修改已有 JSON 配置文件时，只加新条目，不要整个覆盖原文件

## 新脚本工作流程
写完/改完脚本后，需同步更新本地quantumultX项目文件夹：
1. `script/xxx.js` - 脚本代码
2. `autoScript/anyTask.json` - 添加定时任务，含 `img-url` 指向本地图标
3. `quan.boxjs.json` - 添加 Boxjs 配置，含 `icons` 数组指向本地图标
4. 写/改脚本文件
5. 在 VS Code 中打开让用户过目
6. 改单个文件，改完直接提交推送到github，多个文件需用户确认后再提交推送（不得擅自 commit/push）

## GitHub 安全规范
- 不得提交个人凭证（UID、token、密码等）到仓库
- 用户私有数据通过 `$persistentStore` 运行时捕获存储，不入库
- 签名密钥是反编译小程序得到的协议常量，非个人凭证，可提交
- API 地址、算法描述等均为协议公开信息，可提交
- `.gitignore` 中排除本地配置和临时文件

## 代码风格
- 关键逻辑段落加注释标记（如 `// ====== MD5 ======`），方便阅读定位
- 不添加逐行解释性注释
- 每次改动迭代注释里的版本号
- 定期清理无效对话碎片
- 思考过程和回答都用中文显示
- 保持简洁
- 脚本头注释格式：
* {脚本名}·签到脚本
* {日期} 版本: {版本号}
* 签名密钥 ({key_name}): {key_value}
* MITM 域名: {domain1}, {domain2}
* 重写规则 (Rewrite): ^{regex}
* 算法: {算法描述}
* [rewrite_local]
* {rewrite规则}
* [task_local]
* {定时任务}
* [MITM]
* hostname = {域名列表}
*/



