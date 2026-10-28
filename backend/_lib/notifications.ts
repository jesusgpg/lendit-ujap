import type { Prisma } from '../../generated/prisma/client.js'

type NotificationWriter = Pick<Prisma.TransactionClient, 'notification'>

export type NewNotification = {
  userId: string
  type: 'NEW_LISTING' | 'NEW_REQUEST' | 'REQUEST_UPDATED' | 'NEW_MESSAGE' | 'PAYMENT_RECEIVED' | 'LOAN_RETURNED'
  title: string
  message: string
  href: string
}

export function addNotification(db: NotificationWriter, notification: NewNotification) {
  return db.notification.create({ data: notification })
}

export function addNotifications(db: NotificationWriter, notifications: NewNotification[]) {
  return (async () => {
    let count = 0
    for (let start = 0; start < notifications.length; start += 500) {
      const batch = notifications.slice(start, start + 500)
      const result = await db.notification.createMany({ data: batch })
      count += result.count
    }
    return { count }
  })()
}
