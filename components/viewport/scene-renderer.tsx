'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  renderStageAtom,
  selectedNodeIdAtom,
  selectedNodeAtom,
  selectedObjectReadyAtom,
  transformModeAtom,
} from '@/lib/scene/atoms'
import { tagGltfSceneNodeIds } from '@/lib/scene/gltf-hierarchy'
import {
  registerSceneObject,
  unregisterSceneObject,
  registerHighlightMeshes,
} from '@/lib/scene/object-registry'
import { ROBOT_ASSET_URL } from '@/lib/scene/types'
import type { SceneTreeNode } from '@/lib/scene/types'
import { TransformGizmo, transformsEqual } from './transform-gizmo'
import { SelectionHighlight } from './selection-highlight'

const nodeRefs = new Map<string, THREE.Object3D>()

function eulerToRad(degrees: [number, number, number]): [number, number, number] {
  return [
    THREE.MathUtils.degToRad(degrees[0]),
    THREE.MathUtils.degToRad(degrees[1]),
    THREE.MathUtils.degToRad(degrees[2]),
  ]
}

function GltfAsset({ url, assetRootId }: { url: string; assetRootId: string }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    tagGltfSceneNodeIds(c, assetRootId)
    return c
  }, [scene, assetRootId])

  useEffect(() => {
    clone.traverse((obj) => {
      if (typeof obj.userData.sceneNodeId === 'string') {
        registerSceneObject(obj.userData.sceneNodeId, obj)
        registerHighlightMeshes(obj.userData.sceneNodeId, obj)
      }
    })
    registerSceneObject(assetRootId, clone)
    registerHighlightMeshes(assetRootId, clone)

    return () => {
      clone.traverse((obj) => {
        if (typeof obj.userData.sceneNodeId === 'string') {
          unregisterSceneObject(obj.userData.sceneNodeId)
        }
      })
      unregisterSceneObject(assetRootId)
    }
  }, [clone, assetRootId])

  return <primitive object={clone} userData={{ sceneRootId: assetRootId }} />
}

function SceneNodeObject({ node }: { node: SceneTreeNode }) {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const bumpObjectReady = useSetAtom(selectedObjectReadyAtom)
  const groupRef = useRef<THREE.Group>(null)
  const [rx, ry, rz] = eulerToRad(node.transform.rotation)

  useEffect(() => {
    const obj = groupRef.current
    if (!obj) return
    obj.userData.sceneNodeId = node.type !== 'group' && node.type !== 'ground' ? node.id : undefined
    nodeRefs.set(node.id, obj)
    registerSceneObject(node.id, obj)
    registerHighlightMeshes(node.id, obj)

    if (selectedId === node.id) {
      bumpObjectReady((n) => n + 1)
    }

    return () => {
      nodeRefs.delete(node.id)
      unregisterSceneObject(node.id)
    }
  }, [node.id, node.type, selectedId, bumpObjectReady])

  useEffect(() => {
    const obj = groupRef.current
    if (!obj) return

    if (
      transformsEqual(obj, node.transform.position, node.transform.rotation, node.transform.scale)
    ) {
      return
    }

    obj.position.set(...node.transform.position)
    obj.rotation.set(rx, ry, rz)
    obj.scale.set(...node.transform.scale)
  }, [node.transform, rx, ry, rz])

  const renderContent = () => {
    switch (node.type) {
      case 'ground':
        return (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ ignorePick: true }}>
              <planeGeometry args={[20, 20]} />
              <meshStandardMaterial color="#8a8a8a" />
            </mesh>
            <gridHelper args={[20, 20, '#666666', '#444444']} userData={{ ignorePick: true }} />
          </>
        )
      case 'cube':
        return (
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#7d9ec8" />
          </mesh>
        )
      case 'sphere':
        return (
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
        )
      case 'distant-light':
        return (
          <group>
            <directionalLight
              intensity={node.lightIntensity ?? 1.5}
              color={node.lightColor ?? '#ffffff'}
            />
          </group>
        )
      case 'point-light':
        return (
          <group>
            <pointLight
              intensity={node.lightIntensity ?? 2}
              color={node.lightColor ?? '#fff5e6'}
            />
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color={node.lightColor ?? '#fff5e6'} />
            </mesh>
          </group>
        )
      case 'asset-ref':
        return node.assetUrl ? (
          <Suspense fallback={null}>
            <GltfAsset url={node.assetUrl} assetRootId={node.id} />
          </Suspense>
        ) : null
      case 'group':
      default:
        return null
    }
  }

  return (
    <group ref={groupRef} userData={{ sceneRootId: node.type === 'asset-ref' ? node.id : undefined }}>
      {renderContent()}
      {node.children.map((child) => (
        <SceneNodeObject key={child.id} node={child} />
      ))}
    </group>
  )
}

function SelectedGizmo() {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const selectedNode = useAtomValue(selectedNodeAtom)
  const transformMode = useAtomValue(transformModeAtom)
  useAtomValue(selectedObjectReadyAtom)

  const object = selectedId ? nodeRefs.get(selectedId) : undefined

  if (!selectedId || !selectedNode || !object) return null
  if (selectedNode.type === 'group' || selectedNode.type === 'ground' || selectedNode.type === 'gltf-prim') {
    return null
  }
  if (transformMode === 'select') return null

  return <TransformGizmo object={object} nodeId={selectedId} />
}

export function SceneRenderer() {
  const tree = useAtomValue(renderStageAtom)

  return (
    <>
      <color attach="background" args={['#6b6b6b']} />
      <ambientLight intensity={0.35} />
      <SelectionHighlight />
      {tree.map((node) => (
        <SceneNodeObject key={node.id} node={node} />
      ))}
      <SelectedGizmo />
    </>
  )
}

useGLTF.preload(ROBOT_ASSET_URL)
