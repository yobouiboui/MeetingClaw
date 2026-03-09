import dayjs from 'dayjs'

export function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Not started'
  }

  return dayjs(value).format('HH:mm:ss')
}

export function formatRelativeDay(value: string) {
  return dayjs(value).format('DD MMM YYYY HH:mm')
}
