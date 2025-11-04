import WorkdayScheduler from './scheduler.js'
import axios from 'axios'
import config from './config.js'
import {
  handleApiError,
  getInternetTime,
  wasLastInternetFetchSuccessful
} from './utils.js'

/**
 * 中国工作日调度器 - 主程序
 * 在中国法定工作日的指定的时间调用指定的API接口
 */

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
    // 只在调试模式下输出详细响应数据
    if (config.debug) {
      console.log('响应数据:', JSON.stringify(response.data, null, 2))
    }

    return response.data
  } catch (error) {
    handleApiError(error)
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

// 解析命令行参数
function parseCommandLineArgs() {
  const args = process.argv.slice(2)
  const options = {
    testMode: false
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-t' || args[i] === '--test') {
      options.testMode = true
    }
  }

  return options
}

// 如果直接运行此文件，则启动调度器
// 在ESM中，可以通过检查import.meta.url来判断是否为直接运行
const isMainModule = import.meta.url.endsWith(process.argv[1])

if (isMainModule) {
  console.log('中国工作日调度器 - 启动中...')

  // 解析命令行参数
  const options = parseCommandLineArgs()

  // 等待一次互联网时间初始化，以便后续使用全局时间无需等待
  await getInternetTime()
  // 若初始化未成功（使用了本地fallback），则异步再尝试一次获取互联网时间
  if (!wasLastInternetFetchSuccessful()) {
    setTimeout(() => { getInternetTime().catch(() => {}) }, 0)
  }


  // 如果是测试模式，立即触发一次API调用
  if (options.testMode) {
    console.log('测试模式：立即触发一次API调用...')
    callApi()
      .then(() => {
        console.log('测试API调用完成')
      })
      .catch(error => {
        console.error('测试API调用失败:', error)
        process.exit(1)
      })
  }

  // 启动正常调度器
  startScheduler()
}

// 作为模块导出
export {
  WorkdayScheduler,
  callApi,
  startScheduler,
  config
}
