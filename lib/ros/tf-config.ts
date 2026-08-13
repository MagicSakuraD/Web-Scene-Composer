/** Foxglove 订阅的 TF 话题（Isaac Sim 动态关节） */
export const TF_TOPIC = '/tf'

/**
 * 轮子 / 万向轮支架 child frame（Nova Carter + lw_hub 等常见命名）。
 * glTF 节点名通常与这些之一一致；别名见 TF_FRAME_ALIASES。
 */
export const TF_WHEEL_CHILD_FRAMES = [
  // Nova Carter: part_side
  'wheel_left',
  'wheel_right',
  'caster_wheel_left',
  'caster_wheel_right',
  'caster_swivel_left',
  'caster_swivel_right',
  // lw_hub 等: side_part
  'left_wheel',
  'right_wheel',
  'left_caster',
  'right_caster',
  'left_swivel',
  'right_swivel',
] as const

/** 雷达 link — 用于点云挂载（/tf 真值优先于 glTF 静态外参） */
export const TF_LIDAR_CHILD_FRAMES = [
  'front_3d_lidar',
  'front_3d_lidar_link',
  'front_RPLidar',
  'front_RPLidar_link',
  'Lidar_Rear',
  'lidar_rear',
  'rear_lidar',
] as const

export type TfWheelChildFrame = (typeof TF_WHEEL_CHILD_FRAMES)[number]
export type TfLidarChildFrame = (typeof TF_LIDAR_CHILD_FRAMES)[number]

/** TF parent/child frame_id → glTF 场景节点名候选（optical 与 *_link 不可互替） */
export const TF_FRAME_ALIASES: Record<string, readonly string[]> = {
  nova_carter: ['nova_carter', 'Nova_Carter_ROS'],
  lw_hub: ['lw_hub', 'lw_hub_ROS'],
  base_link: ['base_link', 'chassis_link', 'chassis', 'Nova_Carter_ROS', 'lw_hub_ROS'],
  chassis_link: ['chassis_link', 'chassis', 'base_link', 'Nova_Carter_ROS', 'lw_hub_ROS'],
  chassis: ['chassis', 'chassis_link', 'base_link'],

  // 驱动轮：part_side ↔ side_part
  wheel_left: ['wheel_left', 'left_wheel'],
  wheel_right: ['wheel_right', 'right_wheel'],
  left_wheel: ['left_wheel', 'wheel_left'],
  right_wheel: ['right_wheel', 'wheel_right'],

  // 万向轮：caster_wheel_* ↔ *_caster
  caster_wheel_left: ['caster_wheel_left', 'left_caster'],
  caster_wheel_right: ['caster_wheel_right', 'right_caster'],
  left_caster: ['left_caster', 'caster_wheel_left'],
  right_caster: ['right_caster', 'caster_wheel_right'],

  // 支架：caster_swivel_* ↔ *_swivel
  caster_swivel_left: ['caster_swivel_left', 'left_swivel'],
  caster_swivel_right: ['caster_swivel_right', 'right_swivel'],
  left_swivel: ['left_swivel', 'caster_swivel_left'],
  right_swivel: ['right_swivel', 'caster_swivel_right'],

  front_3d_lidar: ['front_3d_lidar', 'XT_32', 'front_3d_lidar_link'],
  front_3d_lidar_link: ['front_3d_lidar_link', 'XT_32'],
  front_RPLidar: ['front_RPLidar'],
  front_RPLidar_link: ['front_RPLidar_link', 'front_RPLidar'],
  XT_32: ['XT_32', 'front_3d_lidar'],
  Lidar_Rear: ['Lidar_Rear', 'lidar_rear', 'rear_lidar'],
  lidar_rear: ['lidar_rear', 'Lidar_Rear', 'rear_lidar'],
  rear_lidar: ['rear_lidar', 'Lidar_Rear', 'lidar_rear'],
}

/** 是否为万向轮支架 frame / 节点名（两种命名） */
export function isCasterSwivelFrameId(frameId: string): boolean {
  return /^(caster_swivel_(left|right)|(left|right)_swivel)$/i.test(frameId)
}

/** 从节点名解析左右侧（*_left / left_* 均可） */
export function sideFromRobotPartName(name: string): 'left' | 'right' | null {
  const lower = name.toLowerCase()
  if (/(^|_)left(_|$)/.test(lower)) return 'left'
  if (/(^|_)right(_|$)/.test(lower)) return 'right'
  return null
}
