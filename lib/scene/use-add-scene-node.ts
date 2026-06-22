'use client'

import { useCallback, useRef } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import {
  sceneNodesAtom,
  selectedNodeIdAtom,
  expandedNodesAtom,
  projectAssetsAtom,
} from './atoms'
import { addAssetNodeToScene, addNodeToScene } from './actions'
import { loadGltfSceneGraph } from './gltf-hierarchy'
import type { CreateMenuAction } from './create-menu'
import { isGltfFile } from './create-menu'
import { ROBOT_ASSET_URL } from './types'
import type { ProjectAsset } from './types'

export function useAddSceneNode() {
  const [nodes, setNodes] = useAtom(sceneNodesAtom)
  const setSelected = useSetAtom(selectedNodeIdAtom)
  const setExpanded = useSetAtom(expandedNodesAtom)
  const setProjectAssets = useSetAtom(projectAssetsAtom)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingImportRef = useRef(false)

  const selectNewNode = useCallback(
    (nodeId: string, extraExpandIds: string[] = []) => {
      setSelected(nodeId)
      setExpanded((prev) => new Set([...prev, 'root', nodeId, ...extraExpandIds]))
    },
    [setSelected, setExpanded],
  )

  const expandAssetHierarchy = useCallback(
    async (url: string, assetRootId: string) => {
      try {
        const gltfNodes = await loadGltfSceneGraph(url, assetRootId)
        setNodes((prev) => ({ ...prev, ...gltfNodes }))
        setExpanded((prev) => new Set([...prev, assetRootId, ...Object.keys(gltfNodes)]))
        return gltfNodes
      } catch (err) {
        console.error('[Web Scene Composer] Failed to parse glTF hierarchy:', err)
        return {}
      }
    },
    [setNodes, setExpanded],
  )

  const addNode = useCallback(
    (type: Parameters<typeof addNodeToScene>[1], parentId = 'root') => {
      const { nodes: updated, newNode } = addNodeToScene(nodes, type, parentId)
      setNodes(updated)
      selectNewNode(newNode.id)
      return newNode
    },
    [nodes, setNodes, selectNewNode],
  )

  const addAssetFromUrl = useCallback(
    async (url: string, name: string, registerAsset = true) => {
      if (registerAsset) {
        const asset: ProjectAsset = {
          id: `asset-${Date.now()}`,
          name,
          url,
          kind: name.toLowerCase().endsWith('.gltf') ? 'gltf' : 'glb',
        }
        setProjectAssets((prev) => [...prev, asset])
      }

      const { nodes: updated, newNode } = addAssetNodeToScene(nodes, url, name)
      setNodes(updated)
      selectNewNode(newNode.id)

      await expandAssetHierarchy(url, newNode.id)
      return newNode
    },
    [nodes, setNodes, setProjectAssets, selectNewNode, expandAssetHierarchy],
  )

  const importGltfFile = useCallback(
    async (file: File, addToScene = true) => {
      if (!isGltfFile(file.name)) return

      const url = URL.createObjectURL(file)
      if (addToScene) {
        await addAssetFromUrl(url, file.name)
      } else {
        const asset: ProjectAsset = {
          id: `asset-${Date.now()}`,
          name: file.name,
          url,
          kind: file.name.toLowerCase().endsWith('.gltf') ? 'gltf' : 'glb',
        }
        setProjectAssets((prev) => [...prev, asset])
      }
    },
    [addAssetFromUrl, setProjectAssets],
  )

  const handleCreateAction = useCallback(
    (action: CreateMenuAction) => {
      if (action.kind === 'node') {
        addNode(action.type)
        return
      }
      if (action.kind === 'load-robot') {
        void addAssetFromUrl(ROBOT_ASSET_URL, 'RobotExpressive.glb', false)
        return
      }
      if (action.kind === 'import-gltf') {
        pendingImportRef.current = true
        fileInputRef.current?.click()
      }
    },
    [addNode, addAssetFromUrl],
  )

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        void importGltfFile(file, pendingImportRef.current)
      }
      pendingImportRef.current = false
      e.target.value = ''
    },
    [importGltfFile],
  )

  return {
    fileInputRef,
    onFileInputChange,
    addNode,
    addAssetFromUrl,
    importGltfFile,
    handleCreateAction,
  }
}
