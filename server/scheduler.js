import cron from 'node-cron'

export function startScheduler(db, broadcast) {
  // Morning greeting at 7:00
  cron.schedule('0 7 * * *', () => {
    console.log('[Scheduler] Morning greeting triggered')
    broadcast({
      type: 'scheduler',
      event: 'morning_greeting',
      message: 'Good morning! Time for some chill beats to start your day.'
    })
  })

  // Hourly mood check
  cron.schedule('0 * * * *', () => {
    console.log('[Scheduler] Hourly mood check triggered')
    broadcast({
      type: 'scheduler',
      event: 'hourly_check',
      message: 'How are you feeling? Want me to pick something for this hour?'
    })
  })

  // Evening wind down at 18:00
  cron.schedule('0 18 * * *', () => {
    console.log('[Scheduler] Evening wind down triggered')
    broadcast({
      type: 'scheduler',
      event: 'evening_wind_down',
      message: 'Evening time. Let me find something mellow for you.'
    })
  })

  console.log('[Scheduler] Started - tasks: 07:00 morning, hourly check, 18:00 evening')
}
