import * as THREE from 'three'
import type { OdomMessage } from '@/lib/foxglove/ros-serialization'
import { rosPositionToThree, rosQuaternionToThree } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

/**
 * nav_msgs/Odometry 就是 odom→base_link。
 * /tf 已有这条边时不覆盖；缺失时补上，避免 GLB 绑 TF 时 lookup 失败。
 */
function upsertOdomTfIfMissing(odom: OdomMessage) {
  const parent = normalizeFrameId(odom.frameId || 'odom')
  const child = normalizeFrameId(odom.childFrameId || 'base_link')
  if (!parent || !child || parent === child) return
  if (tfRuntimeStore.lookupTransform(parent, child)) return
  tfRuntimeStore.updateTransforms([
    {
      parentFrame: parent,
      childFrame: child,
      transform: {
        translation: { ...odom.position },
        rotation: { ...odom.orientation },
      },
    },
  ])
}

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
    upsertOdomTfIfMissing(odom)
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
