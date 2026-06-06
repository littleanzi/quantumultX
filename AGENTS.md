# 量子重写规则 项目规范

## 脚本存放
- 签到脚本 → `script/` 目录
- BoxJS 配置 → 写入 `script/quan.boxjs.json`
- 定时任务 → 写入 `autoScript/anyTask.json`

## 代码注释
- 功能模块用 `// ====== 模块名 ======` 分隔，方便快速定位
- 文件头注释包含 `更新时间: YYYY-MM-DD HH:mm`，脚本中定义 `const UPDATED = 'YYYY-MM-DD HH:mm'`

## 开发流程
- 每次写 Quantumult X 签到脚本前，先查阅官方文档了解 API 用法
