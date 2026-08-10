/** Infer image ↔ camera_info topic pairs (NuScenes / ROS camera namespaces) */

export function isCameraInfoTopic(topic: string, schemaName?: string): boolean {
  if (schemaName?.includes('CameraInfo') || schemaName?.includes('CameraCalibration')) {
    return true
  }
  return /\/camera_info$/i.test(topic)
}

export function imageTopicFromCameraInfo(infoTopic: string): string {
  return infoTopic.replace(/\/camera_info$/i, '/image_rect_compressed')
}

export function cameraInfoTopicFromImage(imageTopic: string): string {
  const t = imageTopic.replace(/\/$/, '')
  if (/\/image_rect_compressed$/i.test(t)) {
    return t.replace(/\/image_rect_compressed$/i, '/camera_info')
  }
  if (/\/compressed$/i.test(t)) {
    const without = t.slice(0, -'/compressed'.length)
    const parent = without.slice(0, without.lastIndexOf('/'))
    return parent ? `${parent}/camera_info` : `${without}/camera_info`
  }
  if (/\/image_raw$/i.test(t) || /\/image_rect$/i.test(t)) {
    const parent = t.slice(0, t.lastIndexOf('/'))
    return `${parent}/camera_info`
  }
  const parent = t.slice(0, t.lastIndexOf('/'))
  return parent ? `${parent}/camera_info` : `${t}/camera_info`
}

/** Prefer an existing image topic for a camera_info topic */
export function resolveImageTopicForInfo(
  infoTopic: string,
  availableTopics: readonly string[],
): string | null {
  const set = new Set(availableTopics)
  const prefix = infoTopic
    .replace(/\/camera_info$/i, '')
    .replace(/\/CameraCalibration$/i, '')
  const candidates = [
    `${prefix}/image_rect_compressed`,
    `${prefix}/image_raw/compressed`,
    `${prefix}/image_compressed`,
    `${prefix}/compressed`,
    `${prefix}/image_raw`,
    `${prefix}/image_rect`,
    imageTopicFromCameraInfo(
      /\/camera_info$/i.test(infoTopic) ? infoTopic : `${prefix}/camera_info`,
    ),
  ]
  for (const c of candidates) {
    if (set.has(c)) return c
  }
  const fuzzy = availableTopics.find(
    (t) =>
      t.startsWith(`${prefix}/`) &&
      /image/i.test(t) &&
      !/camera_info/i.test(t) &&
      !/CameraCalibration/i.test(t),
  )
  return fuzzy ?? null
}
