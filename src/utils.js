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
    const response = await axios.get('https://timeapi.io/api/Time/current/zone?timeZone=Asia/Shanghai')
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
      console.log(
        `根据本地数据，${formattedDate} 是${
          matchingDay.isOffDay ? '休息日' : '工作日'}`)

      // isOffDay 为 false 表示工作日
      return !matchingDay.isOffDay
    }

    // 如果本地数据中没有找到，则根据是否为周末判断
    const isWorkday = !isWeekend(date)

    console.log(`${formattedDate} 不在节假日数据中，根据周末判断是${
      isWorkday ? '工作日' : '休息日'}`)

    return isWorkday
  } catch (error) {
    console.error('检查工作日失败:', error.message)
    // 如果出现错误，仅根据是否为周末判断
    console.log('使用周末判断作为备选')
    return !isWeekend(date)
  }
}

/**
 * 获取下一个工作日的00:00:00时间
 * @returns {Promise<Date>} 下一个工作日的零点时间
 */
async function getNextWorkdayMidnight() {
  // 获取当前互联网时间
  const now = await getInternetTime()

  // 设置为明天的00:00:00
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  // 检查明天是否为工作日
  const isTomorrowWorkday = await isChineseWorkday(tomorrow)

  if (isTomorrowWorkday) {
    return tomorrow
  }

  // 如果明天不是工作日，继续查找下一个工作日
  let nextDay = new Date(tomorrow)
  let isWorkday = false

  while (!isWorkday) {
    nextDay.setDate(nextDay.getDate() + 1)
    isWorkday = await isChineseWorkday(nextDay)
  }

  return nextDay
}

export {
  getInternetTime,
  isChineseWorkday,
  getNextWorkdayMidnight
}
