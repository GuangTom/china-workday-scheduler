import WorkdayScheduler from './scheduler.js'
import axios from 'axios'

/**
 * 中国工作日调度器 - 主程序
 * 在中国法定工作日的00:00:00调用指定的API接口
 */

// 配置项
const config = {
  // API接口URL
  apiUrl: process.env.API_URL || 'https://example.com/api/workday-trigger',

  // API请求方法
  apiMethod: process.env.API_METHOD || 'POST',

  // API请求头
  apiHeaders: process.env.API_HEADERS ? JSON.parse(process.env.API_HEADERS) : {
    'Content-Type': 'application/json'
  },

  // API请求体
  apiBody: process.env.API_BODY ? JSON.parse(process.env.API_BODY) : {
    trigger: 'workday-midnight'
  }
}

/**
 * 调用API的函数
 * 用户可以根据需要修改此函数来实现自定义的API调用逻辑
 */
async function callApi() {
  try {
    console.log(`正在调用API: ${config.apiMethod} ${config.apiUrl}`)

    const response = await axios({
      method: config.apiMethod,
      url: config.apiUrl,
      headers: config.apiHeaders,
      data: config.apiBody
    })

    console.log('API调用成功，响应状态码:', response.status)
    console.log('响应数据:', JSON.stringify(response.data, null, 2))

    return response.data
  } catch (error) {
    console.error('API调用失败:', error.message)
    if (error.response) {
      console.error('响应状态码:', error.response.status)
      console.error('响应数据:', error.response.data)
    }
    throw error
  }
}

/**
 * 启动调度器
 */
function startScheduler() {
  // 创建工作日调度器实例
  const scheduler = new WorkdayScheduler(callApi)

  // 启动调度器
  scheduler.start()
    .then(() => {
      console.log('调度器已成功启动')
    })
    .catch(error => {
      console.error('启动调度器失败:', error)
      process.exit(1)
    })

  // 处理进程退出信号
  process.on('SIGINT', () => {
    console.log('接收到SIGINT信号，正在停止调度器...')
    scheduler.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('接收到SIGTERM信号，正在停止调度器...')
    scheduler.stop()
    process.exit(0)
  })
}

// 如果直接运行此文件，则启动调度器
// 在ESM中，可以通过检查import.meta.url来判断是否为直接运行
const isMainModule = import.meta.url.endsWith(process.argv[1]);
if (isMainModule) {
  console.log('中国工作日调度器 - 启动中...')
  startScheduler()
}

// 作为模块导出
export {
  WorkdayScheduler,
  callApi,
  startScheduler,
  config
}
