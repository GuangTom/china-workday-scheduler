import {
  getInternetTime,
  isChineseWorkday,
  getNextWorkdayTime,
  formatDateToUTC8,
  getCurrentTime
} from './utils.js'
import schedule from 'node-schedule'
import config from './config.js'

/**
 * 工作日调度器类
 */
class WorkdayScheduler {
  /**
   * 创建工作日调度器实例
   * @param {Function} apiCallFunction - API调用函数
   */
  constructor(apiCallFunction) {
    if (typeof apiCallFunction !== 'function') {
      throw new Error('apiCallFunction 必须是一个函数')
    }

    this.apiCallFunction = apiCallFunction
    this.scheduledJobs = [] // 存储所有计划任务
    this.isRunning = false

    // 从配置中获取任务列表，如果配置不存在则使用默认值
    this.scheduledTasks = config.scheduleTasks || [
      { name: 'Example Task', hour: 0, minute: 0, enabled: true }
    ]

    // 只记录启用的任务
    console.log('工作日调度时间配置:')
    const enabledTasks = this.scheduledTasks.filter(task => task.enabled)

    if (enabledTasks.length > 0) {
      enabledTasks.forEach(task => {
        console.log(`- ${task.name}: ${task.hour}:${
          task.minute.toString().padStart(2, '0')}`)
      })
    } else {
      console.log('- 没有启用的任务')
    }
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

    // 取消所有计划任务
    this.scheduledJobs.forEach(job => {
      if (job) {
        job.cancel()
      }
    })

    // 清空任务数组
    this.scheduledJobs = []
    this.isRunning = false
    console.log('工作日调度器已停止')
  }

  /**
   * 安排下一次执行
   */
  async scheduleNextExecution() {
    try {
      // 取消现有的任务
      this.scheduledJobs.forEach(job => {
        if (job) {
          job.cancel()
        }
      })

      // 清空任务数组
      this.scheduledJobs = []

      // 刷新当前互联网时间（失败时在utils中自动回退为本地UTC+8）
      try {
        await getInternetTime()
      } catch (error) {
        console.error('获取互联网时间失败，使用本地时间作为备选:', error.message)
      }

      // 为每个启用的任务安排下一次执行
      const maxRetries = 3

      for (const task of this.scheduledTasks) {
        if (!task.enabled) {
          continue
        }

        // 获取下一个工作日的指定时间
        let nextTaskTime
        let retryCount = 0
        let isNextDayRestDay = false // 标记下一天是否为休息日

        while (retryCount < maxRetries) {
          try {
            // 使用统一的获取下一个工作日时间的函数
            nextTaskTime = await getNextWorkdayTime(task.hour, task.minute)

            // 检查下一个执行日期的后一天是否为休息日
            const nextDay = new Date(nextTaskTime)
            nextDay.setDate(nextDay.getDate() + 1)

            try {
              isNextDayRestDay = !(await isChineseWorkday(nextDay))
            } catch (error) {
              console.error(`检查下一天是否为休息日失败:`, error.message)
              // 简单判断是否为周末
              isNextDayRestDay = nextDay.getDay() === 0 || nextDay.getDay() === 6
            }

            break // 成功获取时间，跳出循环
          } catch (error) {
            retryCount++
            console.error(`获取下一个工作日时间失败 (${task.name}, 尝试 ${retryCount}/${maxRetries}):`, error.message)

            if (retryCount >= maxRetries) {
              console.log('使用本地计算作为最终备选')
              // 使用本地时间计算下一个工作日
              const localNow = new Date()
              let nextDay = new Date(localNow)
              nextDay.setDate(nextDay.getDate() + 1)
              nextDay.setHours(task.hour, task.minute, 0, 0)

              // 简单判断工作日（周一至周五）
              while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
                nextDay.setDate(nextDay.getDate() + 1)
              }

              nextTaskTime = nextDay

              // 简单判断下一天是否为休息日
              const checkNextDay = new Date(nextTaskTime)
              checkNextDay.setDate(checkNextDay.getDate() + 1)
              isNextDayRestDay = checkNextDay.getDay() === 0 || checkNextDay.getDay() === 6
            } else {
              // 等待一段时间后重试
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
          }
        }

        // 如果配置了当次日是休息日时跳过执行，且下一天确实是休息日，则跳过此次调度
        if (task.skipIfNextRestDay && isNextDayRestDay) {
          console.log(`跳过任务 ${task.name} 的调度，因为次日是休息日`)
          continue
        }

        // 运行在休息日：若今天是休息日且次日是工作日，并且未过目标时间
        // 注意：若与 skipIfNextRestDay 冲突，以 skipIfNextRestDay 为准（上方已处理）
        if (task.runIfNextWorkDay) {
          const now = getCurrentTime() || new Date()
          let isTodayWorkday = true
          try {
            isTodayWorkday = await isChineseWorkday(now)
          } catch (error) {
            // 回退为简单的周末判断
            isTodayWorkday = now.getDay() !== 0 && now.getDay() !== 6
          }

          const isPastTargetTime = now.getHours() > task.hour ||
            (now.getHours() === task.hour && now.getMinutes() >= task.minute)

          if (!isTodayWorkday && !isNextDayRestDay && !isPastTargetTime) {
            const todayRun = new Date(now)
            todayRun.setHours(task.hour, task.minute, 0, 0)
            nextTaskTime = todayRun
          }
        }

        console.log(`下一次执行时间 (${task.name}): ${formatDateToUTC8(nextTaskTime)}`)

        // 安排下一次执行
        const job = schedule.scheduleJob(nextTaskTime, async () => {
          console.log(`触发定时任务 (${task.name})，当前时间: ${formatDateToUTC8(new Date())}`)

          // 执行API调用
          await this.executeApiCall(task)

          // 安排下一次执行
          await this.scheduleNextExecution()
        })

        // 将任务添加到数组中
        this.scheduledJobs.push(job)
      }
    } catch (error) {
      console.error('安排下一次执行时出错:', error)

      // 出错时，3分钟后重试
      console.log('3分钟后将重试安排下一次执行')
      setTimeout(() => this.scheduleNextExecution(), 3 * 60 * 1000)
    }
  }

  /**
   * 执行API调用
   * @param {Object} [task] - 触发此次调用的任务对象
   */
  async executeApiCall(task) {
    try {
      console.log('执行API调用...')
      await this.apiCallFunction(task)
      console.log('API调用成功')
    } catch (error) {
      console.error('API调用失败:', error)
    }
  }
}

export default WorkdayScheduler
