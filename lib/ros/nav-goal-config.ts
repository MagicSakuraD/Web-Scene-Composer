/** Nav2 bridge service & action feedback topics (Foxglove) */
export const NAV_GOAL_SERVICE = '/web_scene_composer/navigate_to_pose'
export const NAV_CANCEL_SERVICE = '/web_scene_composer/cancel_navigation'
export const NAV_FEEDBACK_TOPIC = '/navigate_to_pose/_action/feedback'
export const NAV_STATUS_TOPIC = '/navigate_to_pose/_action/status'
export const NAV_MAP_FRAME = 'map'

/** Nav2 planner paths (nav_msgs/msg/Path, jazzy_ws) */
export const PLAN_TOPIC = '/plan'
export const PLAN_SMOOTHED_TOPIC = '/plan_smoothed'
export const LOCAL_PLAN_TOPIC = '/local_plan'
