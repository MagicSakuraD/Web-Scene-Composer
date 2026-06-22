'use client'

import { forwardRef } from 'react'
import { SUPPORTED_ASSET_EXTENSIONS } from '@/lib/scene/create-menu'

interface GltfFileInputProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export const GltfFileInput = forwardRef<HTMLInputElement, GltfFileInputProps>(
  function GltfFileInput({ onChange }, ref) {
    return (
      <input
        ref={ref}
        type="file"
        accept={SUPPORTED_ASSET_EXTENSIONS.join(',')}
        className="hidden"
        onChange={onChange}
      />
    )
  },
)
