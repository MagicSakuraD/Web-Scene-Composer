/** Foxglove 订阅的 TF 话题（Isaac Sim 动态关节） */
export const TF_TOPIC = '/tf'

/**
 * Isaac Sim Nova Carter 轮子 / 支架 frame_id（与 view_frames 一致）。
 * glTF 节点名通常相同；父级多为 nova_carter。
 */
export const TF_WHEEL_CHILD_FRAMES = [
  'wheel_left',
  'wheel_right',
  'caster_wheel_left',
  'caster_wheel_right',
  'caster_swivel_left',
  'caster_swivel_right',
] as const

/** 雷达 link — 用于点云挂载（/tf 真值优先于 glTF 静态外参） */
export const TF_LIDAR_CHILD_FRAMES = [
  'front_3d_lidar',
  'front_3d_lidar_link',
  'front_RPLidar',
  'front_RPLidar_link',
] as const

export type TfWheelChildFrame = (typeof TF_WHEEL_CHILD_FRAMES)[number]
export type TfLidarChildFrame = (typeof TF_LIDAR_CHILD_FRAMES)[number]

/** TF parent/child frame_id → glTF 场景节点名候选（optical 与 *_link 不可互替） */
export const TF_FRAME_ALIASES: Record<string, readonly string[]> = {
  nova_carter: ['nova_carter', 'Nova_Carter_ROS'],
  base_link: ['base_link', 'chassis_link', 'Nova_Carter_ROS'],
  chassis_link: ['chassis_link', 'base_link', 'Nova_Carter_ROS'],
  wheel_left: ['wheel_left'],
  wheel_right: ['wheel_right'],
  caster_wheel_left: ['caster_wheel_left'],
  caster_wheel_right: ['caster_wheel_right'],
  caster_swivel_left: ['caster_swivel_left'],
  caster_swivel_right: ['caster_swivel_right'],
  front_3d_lidar: ['front_3d_lidar', 'XT_32'],
  front_3d_lidar_link: ['front_3d_lidar_link', 'XT_32'],
  front_RPLidar: ['front_RPLidar'],
  front_RPLidar_link: ['front_RPLidar_link', 'front_RPLidar'],
  XT_32: ['XT_32', 'front_3d_lidar'],
}
