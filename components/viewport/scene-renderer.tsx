'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  renderStageAtom,
  sceneNodesAtom,
  selectedNodeIdAtom,
  selectedNodeAtom,
  selectedObjectReadyAtom,
  transformModeAtom,
} from '@/lib/scene/atoms'
import { simulateStatusAtom } from '@/lib/ros/atoms'
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
import { SelectionBoundingBox } from './selection-bounding-box'
import { RuntimeRobotSync } from './runtime-robot-sync'
import { LidarPointCloud } from './lidar-point-cloud'
import { NavPathLines } from './nav-path-lines'
import { CostmapOverlay } from './costmap-overlay'
import { MaterialGraphSync } from './material-graph-sync'
import { ViewportSceneHelpers } from './viewport-scene-helpers'
import { PhysicalDistantLightNode } from './physical-distant-light-node'
import { AutoInstancedSync } from './auto-instanced-sync'
import { NavigationArrowModel } from './navigation-arrow-model'
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
  const nodes = useAtomValue(sceneNodesAtom)
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const bumpObjectReady = useSetAtom(selectedObjectReadyAtom)
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    // 先打 sceneNodeId，再增强（含 auto-instance）：proxy 会继承 tag
    tagGltfSceneNodeIds(c, assetRootId)
    enhanceGltfScene(c)
    return c
  }, [scene, assetRootId])

  // 仅当隐藏集合变化（或 glb 重新加载）时才回写 gltf-prim 可见性，避免 transform 编辑触发遍历
  const hiddenKey = useMemo(
    () =>
      Object.entries(nodes)
        .filter(([, n]) => n.visible === false)
        .map(([id]) => id)
        .sort()
        .join('|'),
    [nodes],
  )

  useEffect(() => {
    const hidden = new Set(hiddenKey ? hiddenKey.split('|') : [])
    clone.traverse((obj) => {
      const sid = obj.userData.sceneNodeId
      if (typeof sid === 'string') {
        obj.visible = !hidden.has(sid)
      }
    })
  }, [clone, hiddenKey])

  // atom → Object3D 变换同步：gltf-prim 由 gizmo 直接改对象、atom 只作持久化，
  // 撤销 / 重做 / 检视器编辑需要据此把内部 prim 变换写回（拖拽中或已相等则跳过）。
  // Simulate 连接期间跳过，避免与运行时轮子旋转 / 位姿动画打架；断开时再统一对齐。
  useEffect(() => {
    if (simulateStatus === 'connected') return
    clone.traverse((obj) => {
      const sid = obj.userData.sceneNodeId
      if (typeof sid !== 'string') return
      if (transformGizmoState.dragging && transformGizmoState.draggingNodeId === sid) return
      const node = nodes[sid]
      if (!node) return
      const { position, rotation, scale } = node.transform
      if (transformsEqual(obj, position, rotation, scale)) return
      const [prx, pry, prz] = eulerToRad(rotation)
      obj.position.set(position[0], position[1], position[2])
      obj.rotation.set(prx, pry, prz)
      obj.scale.set(scale[0], scale[1], scale[2])
    })
  }, [clone, nodes, simulateStatus])

  useEffect(() => {
    let shouldRefreshSelection = selectedId === assetRootId

    registerSceneObject(assetRootId, clone)
    registerHighlightMeshes(assetRootId, clone)

    clone.traverse((obj) => {
      if (typeof obj.userData.sceneNodeId === 'string') {
        registerSceneObject(obj.userData.sceneNodeId, obj)
        registerHighlightMeshes(obj.userData.sceneNodeId, obj)
        if (selectedId === obj.userData.sceneNodeId) {
          shouldRefreshSelection = true
        }
      }
    })

    if (shouldRefreshSelection) {
      bumpObjectReady((n) => n + 1)
    }

    return () => {
      unregisterSceneObject(assetRootId)
      clone.traverse((obj) => {
        if (typeof obj.userData.sceneNodeId === 'string') {
          unregisterSceneObject(obj.userData.sceneNodeId)
        }
      })
    }
  }, [clone, assetRootId, selectedId, bumpObjectReady])

  return (
    <>
      <primitive object={clone} userData={{ sceneRootId: assetRootId }} />
      <AutoInstancedSync root={clone} />
    </>
  )
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

    // asset-ref 的可渲染根由 GltfAsset clone 注册；此处跳过空 wrapper group
    if (node.type !== 'asset-ref') {
      registerSceneObject(node.id, obj)
      registerHighlightMeshes(node.id, obj)
    }

    if (selectedId === node.id) {
      bumpObjectReady((n) => n + 1)
    }

    return () => {
      nodeRefs.delete(node.id)
      if (node.type !== 'asset-ref') {
        unregisterSceneObject(node.id)
      }
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
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#7d9ec8" />
          </mesh>
        )
      case 'sphere':
        return (
          <mesh>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="#e8e8e8" />
          </mesh>
        )
      case 'nav-waypoint':
        return (
          <Suspense fallback={null}>
            <NavigationArrowModel />
          </Suspense>
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
    <group
      ref={groupRef}
      visible={node.visible !== false}
      userData={{ sceneRootId: node.type === 'asset-ref' ? node.id : undefined }}
    >
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
      <CostmapOverlay />
      {VIEWPORT_WEBGPU_FEATURES.materialGraph ? <MaterialGraphSync /> : null}
      {tree.map((node) => (
        <SceneNodeObject key={node.id} node={node} />
      ))}
      <SelectionObjectReady />
      <SelectionBoundingBox />
      <SelectedGizmo />
    </>
  )
}
