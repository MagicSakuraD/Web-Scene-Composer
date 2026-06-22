'use client'

import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { simulateStatusAtom, simulateLogsAtom, cmdVelAdvertisedAtom } from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { appendSimulateLog } from '@/lib/ros/simulate-actions'

/** 差速驱动控制器挂载时 advertise /cmd_vel，卸载时取消 */
export function useCmdVelChannel(active: boolean) {
  const status = useAtomValue(simulateStatusAtom)
  const setLogs = useSetAtom(simulateLogsAtom)
  const setAdvertised = useSetAtom(cmdVelAdvertisedAtom)

  useEffect(() => {
    if (!active || status !== 'connected') {
      setAdvertised(false)
      return
    }

    const ok = foxgloveManager.advertiseCmdVel()
    setAdvertised(ok)

    return () => {
      foxgloveManager.unadvertiseCmdVel()
      setAdvertised(false)
      setLogs((prev) =>
        appendSimulateLog(prev, { level: 'info', message: '差速驱动控制器已取消 advertise /cmd_vel' }),
      )
    }
  }, [active, status, setLogs, setAdvertised])
}
