'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
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
import {
  LOCAL_COSTMAP_TOPIC,
  GLOBAL_COSTMAP_TOPIC,
  NAV_MAP_FRAME,
} from '@/lib/ros/nav-goal-config'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { navGoalStore } from '@/lib/ros/nav-goal-store'
import { navPathStore } from '@/lib/ros/nav-path-store'
import {
  localCostmapStore,
  globalCostmapStore,
  type CostmapSnapshot,
} from '@/lib/ros/costmap-store'
import { useI18n } from '@/hooks/use-i18n'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { MessageKey } from '@/lib/i18n/messages'
import type { SceneNode } from '@/lib/scene/types'

function findNavWaypoint(nodes: Record<string, SceneNode>, preferredId: string | null) {
  if (preferredId && nodes[preferredId]?.type === 'nav-waypoint') return preferredId
  return Object.values(nodes).find((n) => n.type === 'nav-waypoint')?.id ?? null
}

function CostmapStatusRow({
  label,
  snap,
  t,
}: {
  label: string
  snap: CostmapSnapshot
  t: (key: MessageKey, params?: Record<string, string>) => string
}) {
  return (
    <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
      <p className="font-sans text-foreground">{label}</p>
      {snap.hasData ? (
        <>
          <p>
            {snap.width}×{snap.height} · {snap.resolution.toFixed(3)} m/cell
          </p>
          <p>
            frame: {snap.frameId || '—'} · gen {snap.generation}
          </p>
        </>
      ) : snap.subscribed ? (
        <p>{t('navGoal.costmap.noData')}</p>
      ) : (
        <p>{t('navGoal.costmap.waitingTopic')}</p>
      )}
    </div>
  )
}

export function NavGoalPanel() {
  const { t } = useI18n()
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const [navState, setNavState] = useAtom(navGoalStateAtom)
  const [nodes, setNodes] = useAtom(sceneNodesAtom)
  const setSelected = useSetAtom(selectedNodeIdAtom)
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const planPath = useSyncExternalStore(
    navPathStore.subscribe.bind(navPathStore),
    () => navPathStore.planSmoothed.getSnapshot(),
    () => navPathStore.planSmoothed.getSnapshot(),
  )
  const localPath = useSyncExternalStore(
    navPathStore.subscribe.bind(navPathStore),
    () => navPathStore.localPlan.getSnapshot(),
    () => navPathStore.localPlan.getSnapshot(),
  )
  const localCostmap = useSyncExternalStore(
    localCostmapStore.subscribe.bind(localCostmapStore),
    () => localCostmapStore.getSnapshot(),
    () => localCostmapStore.getSnapshot(),
  )
  const globalCostmap = useSyncExternalStore(
    globalCostmapStore.subscribe.bind(globalCostmapStore),
    () => globalCostmapStore.getSnapshot(),
    () => globalCostmapStore.getSnapshot(),
  )

  useEffect(() => {
    const unsub = navGoalStore.subscribe((snap) => {
      setNavState((prev) => ({ ...prev, ...snap }))
    })
    return () => {
      unsub()
    }
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

  const statusTone =
    navState.phase === 'succeeded'
      ? 'success'
      : navState.phase === 'aborted' || navState.phase === 'failed'
        ? 'error'
        : navState.phase === 'canceled'
          ? 'warn'
          : simActive && navState.servicesReady
            ? 'ready'
            : simActive
              ? 'pending'
              : 'idle'

  const statusClass = {
    success: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
    error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    ready: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
    pending: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    idle: 'border-border bg-muted/30 text-muted-foreground',
  }[statusTone]

  const isTerminal =
    navState.phase === 'succeeded' ||
    navState.phase === 'canceled' ||
    navState.phase === 'aborted' ||
    navState.phase === 'failed'

  return (
    <div className="p-4 space-y-3 h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-2 shrink-0">
        <Navigation className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-medium">{t('panels.navGoal.name')}</h3>
          <p className="text-[10px] text-muted-foreground">
            Waypoint Gizmo → {NAV_MAP_FRAME} → /web_scene_composer/navigate_to_pose
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        {/* 设置 */}
        <section className="flex-1 min-w-0 rounded-md border border-border bg-muted/15 p-3 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">{t('navGoal.card.settings')}</h4>

          <div
            className={cn(
              'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
              statusClass,
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

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {t('navGoal.rotateHint')}
          </p>

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

          <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 space-y-2">
            <p className="text-xs font-medium">{t('navGoal.costmap.section')}</p>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{t('navGoal.costmap.local')}</span>
              <Switch
                checked={localCostmap.visible}
                disabled={!simActive}
                onCheckedChange={(checked) => localCostmapStore.setVisible(checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span>{t('navGoal.costmap.global')}</span>
              <Switch
                checked={globalCostmap.visible}
                disabled={!simActive}
                onCheckedChange={(checked) => globalCostmapStore.setVisible(checked)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {t('navGoal.costmap.hint', {
                topic: `${LOCAL_COSTMAP_TOPIC} / ${GLOBAL_COSTMAP_TOPIC}`,
              })}
            </p>
          </div>
        </section>

        {/* 反馈 */}
        <section className="flex-1 min-w-0 rounded-md border border-border bg-muted/15 p-3 space-y-3 overflow-y-auto">
          <h4 className="text-xs font-semibold text-foreground">{t('navGoal.card.feedback')}</h4>

          {navState.lastMessage && !isTerminal && (
            <p className="text-xs text-muted-foreground break-all">{navState.lastMessage}</p>
          )}

          {isTerminal && (
            <div
              className={cn(
                'rounded-md border px-3 py-2 text-xs',
                navState.phase === 'succeeded' &&
                  'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400',
                navState.phase === 'canceled' &&
                  'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                (navState.phase === 'aborted' || navState.phase === 'failed') &&
                  'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400',
              )}
            >
              <p className="font-medium">{phaseLabel}</p>
              {navState.lastMessage && (
                <p className="text-[10px] mt-0.5 opacity-90">{navState.lastMessage}</p>
              )}
              <p className="text-[10px] mt-1 opacity-70">{t('navGoal.resultHint')}</p>
            </div>
          )}

          {navState.phase === 'navigating' &&
            (navState.distanceRemaining != null || navState.recoveries != null) && (
              <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs space-y-1">
                <p className="text-[10px] text-muted-foreground">{t('navGoal.feedbackHint')}</p>
                {navState.distanceRemaining != null && (
                  <p className="font-mono">
                    {t('navGoal.distanceRemaining')}: {navState.distanceRemaining.toFixed(2)} m
                  </p>
                )}
                {navState.recoveries != null && (
                  <p className="font-mono">
                    {t('navGoal.recoveries')}: {navState.recoveries}
                  </p>
                )}
              </div>
            )}

          {navState.goalStatus != null && (
            <p className="text-[10px] font-mono text-muted-foreground">
              status code: {navState.goalStatus}
              {navState.phase === 'succeeded' ? ' (SUCCEEDED)' : ''}
            </p>
          )}

          {simActive && navState.servicesReady && (
            <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
              <p>
                {t('navGoal.path.global')}
                {planPath.topic ? ` (${planPath.topic})` : ''}:{' '}
                {planPath.poseCount > 0 ? `${planPath.poseCount} poses` : '—'}
              </p>
              <p>
                {t('navGoal.path.local')}
                {localPath.frameId ? ` [${localPath.frameId}]` : ''}:{' '}
                {localPath.poseCount > 0 ? `${localPath.poseCount} poses` : '—'}
              </p>
            </div>
          )}

          {(localCostmap.visible || globalCostmap.visible) && (
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 space-y-2">
              <p className="text-xs font-medium text-foreground">
                {t('navGoal.costmap.status')}
              </p>
              {localCostmap.visible && (
                <CostmapStatusRow label={t('navGoal.costmap.local')} snap={localCostmap} t={t} />
              )}
              {globalCostmap.visible && (
                <CostmapStatusRow label={t('navGoal.costmap.global')} snap={globalCostmap} t={t} />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
