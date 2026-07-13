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

export type TfWheelChildFrame = (typeof TF_WHEEL_CHILD_FRAMES)[number]

/** TF parent/child frame_id → glTF 场景节点名候选 */
export const TF_FRAME_ALIASES: Record<string, readonly string[]> = {
  nova_carter: ['nova_carter', 'Nova_Carter_ROS'],
  base_link: ['base_link', 'chassis_link', 'Nova_Carter_ROS'],
  wheel_left: ['wheel_left'],
  wheel_right: ['wheel_right'],
  caster_wheel_left: ['caster_wheel_left'],
  caster_wheel_right: ['caster_wheel_right'],
  caster_swivel_left: ['caster_swivel_left'],
  caster_swivel_right: ['caster_swivel_right'],
}
