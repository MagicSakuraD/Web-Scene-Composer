import { MessageWriter, MessageReader } from '@foxglove/rosmsg2-serialization'
import { ros2humble } from '@foxglove/rosmsg-msgs-common'

/**
 * MessageWriter/MessageReader 以数组中第一个 MessageDefinition 为根类型，
 * 其余为依赖。根类型必须放在第一位，否则 CDR 会序列化/反序列化错误类型。
 */
const twistDefs = [
  ros2humble['geometry_msgs/Twist'],
  ros2humble['geometry_msgs/Vector3'],
]

const odomDefs = [
  ros2humble['nav_msgs/Odometry'],
  ros2humble['builtin_interfaces/Time'],
  ros2humble['std_msgs/Header'],
  ros2humble['geometry_msgs/Point'],
  ros2humble['geometry_msgs/Quaternion'],
  ros2humble['geometry_msgs/Pose'],
  ros2humble['geometry_msgs/PoseWithCovariance'],
  ros2humble['geometry_msgs/Twist'],
  ros2humble['geometry_msgs/Vector3'],
  ros2humble['geometry_msgs/TwistWithCovariance'],
]

export const twistWriter = new MessageWriter(twistDefs)
export const odomReader = new MessageReader(odomDefs)

export interface CmdVel {
  linear: { x: number; y: number; z: number }
  angular: { x: number; y: number; z: number }
}

export interface OdomPose {
  position: { x: number; y: number; z: number }
  orientation: { x: number; y: number; z: number; w: number }
}

export function encodeTwist(cmd: CmdVel): Uint8Array {
  return twistWriter.writeMessage({
    linear: { x: cmd.linear.x, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: cmd.angular.z },
  })
}

export function decodeOdometry(data: Uint8Array): OdomPose | null {
  try {
    const msg = odomReader.readMessage<{
      pose: {
        pose: {
          position: { x: number; y: number; z: number }
          orientation: { x: number; y: number; z: number; w: number }
        }
      }
    }>(data)
    return {
      position: msg.pose.pose.position,
      orientation: msg.pose.pose.orientation,
    }
  } catch {
    return null
  }
}
