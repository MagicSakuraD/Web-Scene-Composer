'use client'

import { useAtomValue } from 'jotai'
import {
  viewportDefaultLightsVisibleAtom,
  viewportGridVisibleAtom,
} from '@/lib/viewport/atoms'

/**
 * 视口辅助：地面网格。
 * Sun 开：Room IBL 负责全部 PBR 照明，不用 ambientLight。
 * Sun 关：极弱补光，避免全黑。
 */
export function ViewportSceneHelpers() {
  const showGrid = useAtomValue(viewportGridVisibleAtom)
  const iblOn = useAtomValue(viewportDefaultLightsVisibleAtom)

  return (
    <>
      {!iblOn && <ambientLight intensity={0.25} />}

      {showGrid && (
        <gridHelper
          args={[40, 40, '#666666', '#3a3a3a']}
          position={[0, 0.001, 0]}
          userData={{ ignorePick: true }}
        />
      )}
    </>
  )
}
