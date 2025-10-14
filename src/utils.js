import axios from 'axios'
import { format, isWeekend } from 'date-fns'
import { utcToZonedTime } from 'date-fns-tz'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// 在ESM中获取__dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 获取互联网时间
 * @returns {Promise<Date>} 当前互联网时间
 */
async function getInternetTime() {
  try {
    // 使用time.is API获取北京时间
    const response = await axios.get(
      'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Shanghai')
    // timeapi.io返回的格式是 "2023-01-01T00:00:00"
    const { dateTime } = response.data

    return new Date(dateTime)
  } catch (error) {
    console.error('获取互联网时间失败:', error.message)
    // 如果API调用失败，使用本地时间作为备选
    console.log('使用本地时间作为备选')

    return utcToZonedTime(new Date(), 'Asia/Shanghai')
  }
}

/**
 * 从本地JSON文件加载节假日数据
 * @returns {Object} 节假日数据对象
 */
function loadHolidayData() {
  try {
    const filePath = path.join(__dirname, '../public/2025.json')
    const data = fs.readFileSync(filePath, 'utf8')

    return JSON.parse(data)
  } catch (error) {
    console.error('加载节假日数据失败:', error.message)
    return { days: [] } // 返回空数据
  }
}

// 缓存节假日数据
const holidayData = loadHolidayData()

/**
 * 检查指定日期是否为中国法定工作日
 * @param {Date} date 要检查的日期
 * @returns {Promise<boolean>} 是否为工作日
 */
async function isChineseWorkday(date) {
  try {
    // 格式化日期为YYYY-MM-DD格式
    const formattedDate = format(date, 'yyyy-MM-dd')

    // 首先检查本地节假日数据
    const matchingDay = holidayData.days
      .find(day => day.date === formattedDate)

    if (matchingDay) {
      // isOffDay 为 false 表示工作日
      return !matchingDay.isOffDay
    }

    // 如果本地数据中没有找到，则根据是否为周末判断
    const isWorkday = !isWeekend(date)

    return isWorkday
  } catch (error) {
    console.error('检查工作日失败:', error.message)
    // 如果出现错误，仅根据是否为周末判断
    return !isWeekend(date)
  }
}

/**
 * 获取下一个工作日的指定时间
 * @param {number} hour - 小时（24小时制）
 * @param {number} minute - 分钟
 * @returns {Promise<Date>} 下一个工作日的指定时间
 */
async function getNextWorkdayTime(hour = 0, minute = 0) {
  // 获取当前互联网时间
  const now = await getInternetTime()

  // 判断当前时间是否已经过了指定时间
  const isPastTargetTime =
    now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute)

  // 如果当前是工作日且未过指定时间，设置为今天的指定时间
  const isToday = await isChineseWorkday(now)
  if (isToday && !isPastTargetTime) {
    const today = new Date(now)
    today.setHours(hour, minute, 0, 0)
    return today
  }

  // 设置为明天的指定时间
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour, minute, 0, 0)

  // 检查明天是否为工作日
  const isTomorrowWorkday = await isChineseWorkday(tomorrow)

  // 如果明天是工作日，返回明天的指定时间
  if (isTomorrowWorkday) {
    return tomorrow
  }

  // 如果明天不是工作日，继续查找下一个工作日
  // 这里需要循环查找，直到找到工作日为止
  let nextDay = new Date(tomorrow)
  let isWorkday = false

  // 最多查找10天，避免极端情况下的无限循环
  for (let i = 0; i < 10; i++) {
    nextDay.setDate(nextDay.getDate() + 1)
    isWorkday = await isChineseWorkday(nextDay)

    if (isWorkday) {
      nextDay.setHours(hour, minute, 0, 0)
      return nextDay
    }
  }

  // 如果10天内都没找到工作日，返回最后一天
  // 这种情况极少发生，但为了安全起见添加此逻辑
  nextDay.setHours(hour, minute, 0, 0)
  return nextDay
}

/**
 * 将Date对象格式化为UTC+8时区的字符串
 * @param {Date} date - 日期对象
 * @returns {string} - 格式化后的字符串 (UTC+8)
 */
function formatDateToUTC8(date) {
  const options = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }
  return new Date(date).toLocaleString('zh-CN', options) + ' (UTC+8)'
}

/**
 * 统一的API调用错误处理函数
 * @param {Error} error - 错误对象
 * @param {string} operation - 操作名称
 */
function handleApiError(error, operation = 'API调用') {
  console.error(`${operation}失败:`, error.message)
  if (error.response) {
    console.error('响应状态码:', error.response.status)
    console.error('响应数据:', error.response.data)
  } else if (error.request) {
    console.error('未收到响应，请检查网络连接')
  } else {
    console.error('请求配置错误')
  }
  return error
}

/**
 * 检查指定时间是否在目标时间点附近（允许一定误差）
 * @param {Date} date - 要检查的时间
 * @param {number} targetHour - 目标小时
 * @param {number} targetMinute - 目标分钟
 * @param {number} allowedErrorMinutes - 允许的误差（分钟）
 * @returns {boolean} - 是否在目标时间点附近
 */
function isTimeNear(date, targetHour, targetMinute = 0, allowedErrorMinutes = 1) {
  const hour = date.getHours()
  const minute = date.getMinutes()

  // 检查小时是否匹配
  if (hour !== targetHour) return false

  // 检查分钟是否在允许误差范围内
  const minuteDiff = Math.abs(minute - targetMinute)
  return minuteDiff <= allowedErrorMinutes
}

export {
  getInternetTime,
  getNextWorkdayTime,
  isChineseWorkday,
  formatDateToUTC8,
  handleApiError,
  isTimeNear
}
