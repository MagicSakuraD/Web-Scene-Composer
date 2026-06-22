import { FoxgloveClient } from '@foxglove/ws-protocol'
import type { Channel, ClientChannelId, SubscriptionId } from '@foxglove/ws-protocol'
import { encodeTwist, decodeOdometry, type CmdVel } from '@/lib/foxglove/ros-serialization'
import { FOXGLOVE_WS_CANDIDATES, FOXGLOVE_WS_SUBPROTOCOLS } from '@/lib/ros/foxglove-config'
import {
  CMD_VEL_TOPIC,
  ODOM_TOPIC,
  type SimulateLogEntry,
} from '@/lib/ros/atoms'

type LogFn = (entry: Omit<SimulateLogEntry, 'id' | 'time'>) => void
type OdomFn = (pose: ReturnType<typeof decodeOdometry>) => void

class FoxgloveBridgeManager {
  private client: FoxgloveClient | null = null
  private ws: WebSocket | null = null
  private connectedUrl: string | null = null
  private cmdVelChannelId: ClientChannelId | null = null
  private odomSubscriptionId: SubscriptionId | null = null
  private odomChannelId: number | null = null
  private clientPublishEnabled = false
  private connectGeneration = 0
  private log: LogFn = () => {}
  private onOdom: OdomFn = () => {}

  /** Simulate：建立 WebSocket 并订阅 odom（自动尝试 127.0.0.1 / localhost） */
  async connect(log: LogFn, onOdom: OdomFn): Promise<void> {
    this.log = log
    this.onOdom = onOdom
    this.disconnect()

    const generation = ++this.connectGeneration
    let lastError: Error | null = null

    for (const url of FOXGLOVE_WS_CANDIDATES) {
      if (generation !== this.connectGeneration) {
        throw new Error('连接已取消')
      }
      try {
        await this.connectOnce(url, generation)
        this.connectedUrl = url
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        this.log({ level: 'warn', message: `${url} 连接失败: ${lastError.message}` })
        this.cleanupSocket()
      }
    }

    throw lastError ?? new Error('无法连接 Foxglove Bridge')
  }

  private connectOnce(url: string, generation: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      try {
        const ws = new WebSocket(url, [...FOXGLOVE_WS_SUBPROTOCOLS])
        this.ws = ws
        const client = new FoxgloveClient({ ws })
        this.client = client

        const timeout = window.setTimeout(() => {
          finish(() => {
            ws.close()
            reject(new Error('连接超时 (8s)'))
          })
        }, 8000)

        ws.addEventListener('open', () => {
          if (generation !== this.connectGeneration) return
          this.log({
            level: 'info',
            message: `WebSocket 已连接 ${url} · 协议: ${ws.protocol || 'unknown'}`,
          })
        })

        client.on('serverInfo', (info) => {
          if (generation !== this.connectGeneration) return
          window.clearTimeout(timeout)
          this.clientPublishEnabled = info.capabilities.includes('clientPublish')
          this.log({
            level: 'info',
            message: `Bridge: ${info.name} · capabilities: ${info.capabilities.join(', ')}`,
          })
          if (!this.clientPublishEnabled) {
            this.log({
              level: 'warn',
              message: 'Bridge 未开启 clientPublish，差速驱动控制器将无法发布 /cmd_vel',
            })
          }
          finish(resolve)
        })

        client.on('advertise', (channels: Channel[]) => {
          if (generation !== this.connectGeneration) return
          const odom = channels.find((c) => c.topic === ODOM_TOPIC)
          if (odom && this.odomSubscriptionId == null) {
            this.odomChannelId = odom.id
            this.odomSubscriptionId = client.subscribe(odom.id)
            this.log({ level: 'info', message: `已订阅 ${ODOM_TOPIC}` })
          }
        })

        client.on('message', (event) => {
          if (event.channelId !== this.odomChannelId) return
          const pose = decodeOdometry(new Uint8Array(event.data))
          if (pose) this.onOdom(pose)
        })

        client.on('error', (err) => {
          this.log({ level: 'error', message: err.message })
        })

        client.on('close', () => {
          this.log({ level: 'warn', message: 'Foxglove 连接已关闭' })
        })

        ws.addEventListener('error', () => {
          finish(() => {
            window.clearTimeout(timeout)
            reject(
              new Error(
                `WebSocket 握手失败。若 foxglove_bridge ≥3.x，需 subprotocol foxglove.sdk.v1；请确认 bridge 在运行`,
              ),
            )
          })
        })

        ws.addEventListener('close', (ev) => {
          if (!settled && ev.code !== 1000) {
            finish(() => {
              window.clearTimeout(timeout)
              reject(new Error(`WebSocket 关闭 code=${ev.code}${ev.reason ? `: ${ev.reason}` : ''}`))
            })
          }
        })
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error(String(err))))
      }
    })
  }

  private cleanupSocket() {
    if (this.client) {
      try {
        this.client.close()
      } catch {
        /* ignore */
      }
    }
    this.client = null
    this.ws = null
    this.cmdVelChannelId = null
    this.odomSubscriptionId = null
    this.odomChannelId = null
    this.clientPublishEnabled = false
  }

  /** 差速驱动控制器：advertise /cmd_vel */
  advertiseCmdVel(): boolean {
    if (!this.client || this.cmdVelChannelId != null) return this.cmdVelChannelId != null
    if (!this.clientPublishEnabled) {
      this.log({ level: 'warn', message: '无法 advertise /cmd_vel：Bridge 未开启 clientPublish' })
      return false
    }
    this.cmdVelChannelId = this.client.advertise({
      topic: CMD_VEL_TOPIC,
      encoding: 'cdr',
      schemaName: 'geometry_msgs/msg/Twist',
    })
    this.log({ level: 'info', message: `差速驱动控制器已 advertise ${CMD_VEL_TOPIC}` })
    return true
  }

  unadvertiseCmdVel() {
    if (!this.client || this.cmdVelChannelId == null) return
    this.client.unadvertise(this.cmdVelChannelId)
    this.cmdVelChannelId = null
  }

  publishCmdVel(cmd: CmdVel) {
    if (!this.client || this.cmdVelChannelId == null) return
    const data = encodeTwist(cmd)
    this.client.sendMessage(this.cmdVelChannelId, data)
  }

  isCmdVelAdvertised() {
    return this.cmdVelChannelId != null
  }

  getConnectedUrl() {
    return this.connectedUrl
  }

  disconnect() {
    this.connectGeneration++
    if (this.client) {
      if (this.odomSubscriptionId != null) {
        this.client.unsubscribe(this.odomSubscriptionId)
      }
      if (this.cmdVelChannelId != null) {
        this.client.unadvertise(this.cmdVelChannelId)
      }
      this.client.close()
    }
    this.client = null
    this.ws = null
    this.connectedUrl = null
    this.cmdVelChannelId = null
    this.odomSubscriptionId = null
    this.odomChannelId = null
    this.clientPublishEnabled = false
  }

  isConnected() {
    return this.client != null && this.ws?.readyState === WebSocket.OPEN
  }
}

export const foxgloveManager = new FoxgloveBridgeManager()
