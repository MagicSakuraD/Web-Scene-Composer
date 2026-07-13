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
import { enhanceGltfScene } from '@/lib/scene/enhance-gltf-scene'
import type { SceneTreeNode } from '@/lib/scene/types'
import {
  registerSceneObject,
  unregisterSceneObject,
  registerHighlightMeshes,
  objectByNodeId,
} from '@/lib/scene/object-registry'
import { TransformGizmo, transformsEqual } from './transform-gizmo'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'
import { SelectionOutline } from './selection-outline'
import { RuntimeRobotSync } from './runtime-robot-sync'
import { LidarPointCloud } from './lidar-point-cloud'
import { NavPathLines } from './nav-path-lines'
import { MaterialGraphSync } from './material-graph-sync'
import { ViewportSceneHelpers } from './viewport-scene-helpers'
import { PhysicalDistantLightNode } from './physical-distant-light-node'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { VIEWPORT_WEBGPU_FEATURES } from '@/lib/viewport/visual-config'

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
    enhanceGltfScene(c)
    return c
  }, [scene, assetRootId])

  useEffect(() => {
    clone.traverse((obj) => {
      if (typeof obj.userData.sceneNodeId === 'string') {
        registerSceneObject(obj.userData.sceneNodeId, obj)
        registerHighlightMeshes(obj.userData.sceneNodeId, obj)
      }
    })
    registerHighlightMeshes(assetRootId, clone)

    return () => {
      clone.traverse((obj) => {
        if (typeof obj.userData.sceneNodeId === 'string') {
          unregisterSceneObject(obj.userData.sceneNodeId)
        }
      })
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

    // Simulate 运行时由 RuntimeRobotSync 写 Three.js（asset-ref 或 gltf 底盘根节点）
    if (runtimePoseStore.active && runtimePoseStore.robotNodeId === node.id) {
      return
    }

    // Gizmo 拖拽中由 TransformControls 直接写 Three.js，跳过 atom 回写
    if (transformGizmoState.dragging && transformGizmoState.draggingNodeId === node.id) {
      return
    }

    if (
      transformsEqual(obj, node.transform.position, node.transform.rotation, node.transform.scale)
    ) {
      return
    }

    obj.position.set(...node.transform.position)
    obj.rotation.set(rx, ry, rz)
    obj.scale.set(...node.transform.scale)
  }, [node.id, node.type, node.transform, rx, ry, rz])

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
      case 'nav-waypoint':
        return (
          <group>
            <mesh position={[0, 0.08, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.12, 0.06, 16]} />
              <meshStandardMaterial color="#22c55e" emissive="#14532d" emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0.28, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
              <coneGeometry args={[0.1, 0.35, 16]} />
              <meshStandardMaterial color="#4ade80" emissive="#166534" emissiveIntensity={0.5} />
            </mesh>
          </group>
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
      case 'physical-distant-light':
        return <PhysicalDistantLightNode node={node} />
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

function SelectionObjectReady() {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const bumpObjectReady = useSetAtom(selectedObjectReadyAtom)

  useEffect(() => {
    if (!selectedId) return
    if (objectByNodeId.has(selectedId)) {
      bumpObjectReady((n) => n + 1)
      return
    }
    const frame = requestAnimationFrame(() => {
      if (objectByNodeId.has(selectedId)) bumpObjectReady((n) => n + 1)
    })
    return () => cancelAnimationFrame(frame)
  }, [selectedId, bumpObjectReady])

  return null
}

function SelectedGizmo() {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const selectedNode = useAtomValue(selectedNodeAtom)
  const mode = useAtomValue(transformModeAtom)
  useAtomValue(selectedObjectReadyAtom)

  const object = selectedId
    ? (objectByNodeId.get(selectedId) ?? nodeRefs.get(selectedId))
    : undefined

  if (!selectedId || !selectedNode || !object) return null
  if (mode === 'select') return null
  if (selectedNode.type === 'group' || selectedNode.type === 'ground') {
    return null
  }

  return <TransformGizmo object={object} nodeId={selectedId} />
}

export function SceneRenderer() {
  const tree = useAtomValue(renderStageAtom)

  return (
    <>
      <color attach="background" args={['#1c1e24']} />
      <ViewportSceneHelpers />
      <RuntimeRobotSync />
      {VIEWPORT_WEBGPU_FEATURES.lidarPointCloud ? <LidarPointCloud /> : null}
      <NavPathLines />
      {VIEWPORT_WEBGPU_FEATURES.materialGraph ? <MaterialGraphSync /> : null}
      {tree.map((node) => (
        <SceneNodeObject key={node.id} node={node} />
      ))}
      <SelectionObjectReady />
      <SelectionOutline />
      <SelectedGizmo />
    </>
  )
}
