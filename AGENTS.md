# 量子重写规则 项目规范

## 脚本存放
- 签到脚本 → `script/` 目录
- BoxJS 配置 → 写入 `script/quan.boxjs.json`
- 定时任务 → 写入 `autoScript/anyTask.json`

## 代码注释
- 功能模块用 `// ====== 模块名 ======` 分隔，方便快速定位
- 脚本头注释格式：
  ```
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

## 开发流程
- 每次写 Quantumult X 签到脚本前，先查阅官方文档了解 API 用法
