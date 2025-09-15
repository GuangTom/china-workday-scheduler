# 中国工作日调度器

这是一个 Node.js 服务，用于在中国法定工作日（跳过法定休息日）的 00:00:00 准时调用指定的 API 接口。

## 功能特点

- 自动获取互联网时间，确保时间准确性
- 智能识别中国法定工作日，跳过法定节假日和周末
- 在工作日的 00:00:00 准时触发 API 调用
- 支持自定义 API 接口、请求方法、请求头和请求体
- 自动重试和错误处理机制

## 安装

### 前提条件

- Node.js 12.x 或更高版本
- npm 或 yarn

### 安装步骤

1. 克隆或下载本项目
2. 安装依赖

```bash
npm install
# 或
yarn install
```

## 配置

你可以通过环境变量或直接修改 `index.js` 文件来配置API调用参数：

### 环境变量配置

```bash
# API接口URL
export API_URL="https://your-api-endpoint.com/api/trigger"

# API请求方法 (GET, POST, PUT, DELETE等)
export API_METHOD="POST"

# API请求头 (JSON格式字符串)
export API_HEADERS='{"Content-Type":"application/json","Authorization":"Bearer your-token"}'

# API请求体 (JSON格式字符串)
export API_BODY='{"event":"workday-trigger","source":"scheduler"}'
```

### 直接修改代码

你也可以直接修改 `index.js` 文件中的配置项：

```javascript
// 配置项
const config = {
  // API接口URL
  apiUrl: process.env.API_URL || 'https://your-api-endpoint.com/api/trigger',

  // API请求方法
  apiMethod: process.env.API_METHOD || 'POST',

  // API请求头
  apiHeaders: process.env.API_HEADERS ? JSON.parse(process.env.API_HEADERS) : {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-token'
  },

  // API请求体
  apiBody: process.env.API_BODY ? JSON.parse(process.env.API_BODY) : {
    event: 'workday-trigger',
    source: 'scheduler'
  }
}
```

### 自定义API调用逻辑

如果你需要更复杂的API调用逻辑，可以修改 `index.js` 文件中的 `callApi` 函数：

```javascript
async function callApi() {
  // 在这里实现你的自定义API调用逻辑
  // ...
}
```

## 使用方法

### 启动服务

```bash
node index.js
```

或者使用 npm 脚本：

```bash
npm start
```

### 使用PM2进行进程管理（推荐）

```bash
# 安装PM2
npm install -g pm2

# 启动服务
pm2 start index.js --name "china-workday-scheduler"

# 查看日志
pm2 logs china-workday-scheduler

# 停止服务
pm2 stop china-workday-scheduler
```

## 工作原理

1. 服务启动后，首先获取当前互联网时间
2. 判断当前是否为中国法定工作日
3. 如果当前是工作日且时间接近 00:00:00，立即执行 API 调用
4. 计算下一个工作日的 00:00:00 时间点
5. 设置定时任务，在下一个工作日的 00:00:00 触发 API 调用
6. 循环执行步骤3-5

## 注意事项

- 本服务依赖外部 API 获取互联网时间和节假日信息，如果这些 API 不可用，将使用本地时间和周末判断作为备选方案
- 建议使用 PM2 等进程管理工具确保服务持续运行
- 如果你的 API 调用需要特殊的认证或处理逻辑，请自定义 `callApi` 函数

## 许可证

ISC
