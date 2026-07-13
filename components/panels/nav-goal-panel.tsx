'use client'

import { useCallback, useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Navigation, MapPin, Send, XCircle } from 'lucide-react'
import {
  simulateStatusAtom,
  navGoalStateAtom,
  FOXGLOVE_WS_URL,
} from '@/lib/ros/atoms'
import {
  sceneNodesAtom,
  selectedNodeIdAtom,
} from '@/lib/scene/atoms'
import { addNodeToScene } from '@/lib/scene/actions'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { threeWorldPoseToRos } from '@/lib/ros/ros-three-coords'
import { NAV_MAP_FRAME } from '@/lib/ros/nav-goal-config'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { navGoalStore } from '@/lib/ros/nav-goal-store'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import type { SceneNode } from '@/lib/scene/types'

function findNavWaypoint(nodes: Record<string, SceneNode>, preferredId: string | null) {
  if (preferredId && nodes[preferredId]?.type === 'nav-waypoint') return preferredId
  return Object.values(nodes).find((n) => n.type === 'nav-waypoint')?.id ?? null
}

export function NavGoalPanel() {
  const { t } = useI18n()
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const [navState, setNavState] = useAtom(navGoalStateAtom)
  const [nodes, setNodes] = useAtom(sceneNodesAtom)
  const setSelected = useSetAtom(selectedNodeIdAtom)
  const selectedId = useAtomValue(selectedNodeIdAtom)

  useEffect(() => {
    return navGoalStore.subscribe((snap) => {
      setNavState((prev) => ({ ...prev, ...snap }))
    })
  }, [setNavState])

  const simActive = simulateStatus === 'connected'
  const waypointId = findNavWaypoint(nodes, selectedId)
  const canSend = simActive && navState.servicesReady && waypointId != null

  const addWaypoint = useCallback(() => {
    const { nodes: next, newNode } = addNodeToScene(nodes, 'nav-waypoint', 'root')
    setNodes(next)
    setSelected(newNode.id)
    setNavState((s) => ({ ...s, waypointNodeId: newNode.id }))
  }, [nodes, setNodes, setSelected, setNavState])

  const sendGoal = useCallback(async () => {
    if (!waypointId) return
    const object = objectByNodeId.get(waypointId)
    if (!object) return
    const pose = threeWorldPoseToRos(object, NAV_MAP_FRAME)
    try {
      await foxgloveManager.sendNavigateToPose(pose)
    } catch {
      /* state updated in store */
    }
  }, [waypointId])

  const cancelNav = useCallback(async () => {
    try {
      await foxgloveManager.cancelNavigation()
    } catch {
      /* state updated in store */
    }
  }, [])

  const phaseLabel = t(`navGoal.phase.${navState.phase}` as 'navGoal.phase.idle')

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Navigation className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-medium">{t('panels.navGoal.name')}</h3>
          <p className="text-[10px] text-muted-foreground">
            Waypoint Gizmo → {NAV_MAP_FRAME} → /web_scene_composer/navigate_to_pose
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
          simActive && navState.servicesReady
            ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
            : simActive
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'border-border bg-muted/30 text-muted-foreground',
        )}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span>
          {!simActive
            ? `${t('navGoal.notConnected')} (${FOXGLOVE_WS_URL})`
            : !navState.servicesReady
              ? t('navGoal.servicesMissing')
              : `${t('navGoal.mapFrame')}: ${NAV_MAP_FRAME} · ${phaseLabel}`}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">{t('navGoal.rotateHint')}</p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs hover:opacity-90"
          onClick={addWaypoint}
        >
          {t('navGoal.addWaypoint')}
        </button>
        <button
          type="button"
          disabled={!canSend}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5',
            canSend
              ? 'bg-primary text-primary-foreground hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
          onClick={() => void sendGoal()}
        >
          <Send className="h-3.5 w-3.5" />
          {t('navGoal.sendGoal')}
        </button>
        <button
          type="button"
          disabled={!simActive || !navState.servicesReady}
          className="px-3 py-1.5 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-accent disabled:opacity-50"
          onClick={() => void cancelNav()}
        >
          <XCircle className="h-3.5 w-3.5" />
          {t('navGoal.cancel')}
        </button>
      </div>

      {!waypointId && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t('navGoal.noWaypoint')}</p>
      )}

      {navState.lastMessage && (
        <p className="text-xs text-muted-foreground break-all">{navState.lastMessage}</p>
      )}

      {navState.distanceRemaining != null && navState.phase === 'navigating' && (
        <p className="text-xs font-mono">
          {t('navGoal.distanceRemaining')}: {navState.distanceRemaining.toFixed(2)} m
        </p>
      )}
    </div>
  )
}
