import * as THREE from 'three'
import type { OdomMessage } from '@/lib/foxglove/ros-serialization'
import { rosPositionToThree, rosQuaternionToThree } from '@/lib/ros/ros-three-coords'

/** 高频 odom 缓存，脱离 React 渲染周期（仅底盘位姿） */
class RuntimePoseStore {
  robotNodeId: string | null = null
  active = false
  /** 是否已收到至少一条 odom */
  hasOdom = false
  position = new THREE.Vector3()
  quaternion = new THREE.Quaternion()
  /** 底盘 twist（ROS 车体坐标），用于本地轮子 Dead Reckoning */
  linearX = 0
  angularZ = 0

  setRobotNodeId(id: string) {
    this.robotNodeId = id
    this.active = true
  }

  setFromOdom(odom: OdomMessage) {
    this.hasOdom = true
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
    this.hasOdom = false
    this.linearX = 0
    this.angularZ = 0
  }
}

export const runtimePoseStore = new RuntimePoseStore()
