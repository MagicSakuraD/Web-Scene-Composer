import * as THREE from 'three'
import type { OdomMessage } from '@/lib/foxglove/ros-serialization'
import { rosPositionToThree, rosQuaternionToThree } from '@/lib/ros/ros-three-coords'

/** 高频 odom 缓存，脱离 React 渲染周期 */
class RuntimePoseStore {
  robotNodeId: string | null = null
  active = false
  position = new THREE.Vector3()
  quaternion = new THREE.Quaternion()
  /** 用于本地轮子动画（Dead Reckoning），不依赖网络逐帧同步关节 */
  linearX = 0
  angularZ = 0

  setRobotNodeId(id: string) {
    this.robotNodeId = id
    this.active = true
  }

  setFromOdom(odom: OdomMessage) {
    rosPositionToThree(
      odom.position.x,
      odom.position.y,
      odom.position.z,
      this.position,
    )
    rosQuaternionToThree(
      odom.orientation.x,
      odom.orientation.y,
      odom.orientation.z,
      odom.orientation.w,
      this.quaternion,
    )
    this.linearX = odom.twist.linear.x
    this.angularZ = odom.twist.angular.z
  }

  reset() {
    this.robotNodeId = null
    this.active = false
    this.linearX = 0
    this.angularZ = 0
  }
}

export const runtimePoseStore = new RuntimePoseStore()
