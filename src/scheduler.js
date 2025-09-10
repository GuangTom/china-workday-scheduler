import schedule from 'node-schedule'
import { getInternetTime, isChineseWorkday, getNextWorkdayMidnight } from './utils.js'

/**
 * 调度器类，用于在中国法定工作日的00:00:00调用指定API
 */
class WorkdayScheduler {
  /**
   * 创建一个工作日调度器
   * @param {Function} apiCallback 要调用的API回调函数
   */
  constructor(apiCallback) {
    if (typeof apiCallback !== 'function') {
      throw new Error('apiCallback必须是一个函数')
    }

    this.apiCallback = apiCallback
    this.job = null
    this.isRunning = false
  }

  /**
   * 启动调度器
   */
  async start() {
    if (this.isRunning) {
      console.log('调度器已经在运行中')
      return
    }

    this.isRunning = true
    console.log('工作日调度器已启动')

    // 立即检查当前是否为工作日，并安排下一次执行
    await this.scheduleNextExecution()
  }

  /**
   * 停止调度器
   */
  stop() {
    if (!this.isRunning) {
      console.log('调度器未在运行')
      return
    }

    if (this.job) {
      this.job.cancel()
      this.job = null
    }

    this.isRunning = false
    console.log('工作日调度器已停止')
  }

  /**
   * 安排下一次执行
   */
  async scheduleNextExecution() {
    try {
      // 取消现有的任务（如果有）
      if (this.job) {
        this.job.cancel()
        this.job = null
      }

      // 获取当前互联网时间
      const now = await getInternetTime()
      console.log(`当前时间: ${now.toISOString()}`)

      // 检查当前是否为工作日
      const isWorkday = await isChineseWorkday(now)
      console.log(`今天是${isWorkday ? '工作日' : '非工作日'}`)

      // 如果现在是工作日且时间是00:00:00附近（允许1分钟误差）
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      if (isWorkday && currentHour === 0 && currentMinute < 1) {
        console.log('现在是工作日00:00:00，执行API调用')
        await this.executeApiCall()
      }

      // 获取下一个工作日的00:00:00时间
      const nextExecutionTime = await getNextWorkdayMidnight()
      console.log(`下一次执行时间: ${nextExecutionTime.toISOString()}`)

      // 安排下一次执行
      this.job = schedule.scheduleJob(nextExecutionTime, async () => {
        console.log(`触发定时任务，当前时间: ${new Date().toISOString()}`)

        // 执行API调用
        await this.executeApiCall()

        // 安排下一次执行
        await this.scheduleNextExecution()
      })
    } catch (error) {
      console.error('安排下一次执行时出错:', error)

      // 出错时，1小时后重试
      console.log('1小时后将重试安排下一次执行')
      setTimeout(() => this.scheduleNextExecution(), 60 * 60 * 1000)
    }
  }

  /**
   * 执行API调用
   */
  async executeApiCall() {
    try {
      console.log('执行API调用...')
      await this.apiCallback()
      console.log('API调用成功')
    } catch (error) {
      console.error('API调用失败:', error)
    }
  }
}

export default WorkdayScheduler
