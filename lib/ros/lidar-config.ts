/**
 * Isaac Sim Nova Carter `front_3d_lidar`：PointCloud2 数据系相对 REP-103 link
 * 固定差绕局部 X 轴 +90°，使水平扫描环落在 Three.js 地面（XZ）上。
 * 与 /tf 挂载位姿正交：TF 管「装在哪」，此角管「点云轴向」。
 */
export const LIDAR_ISAAC_3D_EXTRA_ROTATION_X = Math.PI / 2
