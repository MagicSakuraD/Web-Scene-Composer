'use client'

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Package, MapPin, Send, XCircle } from 'lucide-react'
import { simulateStatusAtom, FOXGLOVE_WS_URL } from '@/lib/ros/atoms'
import { sceneNodesAtom, selectedNodeIdAtom } from '@/lib/scene/atoms'
import { addNodeToScene } from '@/lib/scene/actions'
import { objectByNodeId } from '@/lib/scene/object-registry'
import {
  threeWorldPoseToRos,
  threePositionToRos,
  threeEulerDegToRosYaw,
  rosYawFromQuaternion,
} from '@/lib/ros/ros-three-coords'
import {
  JOB_MAP_FRAME,
  JOB_START_SERVICE,
  JOB_CANCEL_SERVICE,
  JOB_STATUS_TOPIC,
  DEFAULT_PICK_LOCATION_ID,
  DEFAULT_DROP_LOCATION_ID,
  JOB_PHASE,
  jobPhaseNameFromCode,
  type JobPhaseName,
} from '@/lib/ros/shelf-job-config'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { shelfJobStore } from '@/lib/ros/shelf-job-store'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'
import type { SceneNode } from '@/lib/scene/types'
import type { MessageKey } from '@/lib/i18n/messages'

type JobMode = 'location-id' | 'map-pick'

function findMarker(nodes: Record<string, SceneNode>, role: 'pick' | 'drop') {
  return Object.values(nodes).find((n) => n.type === 'nav-waypoint' && n.markerRole === role) ?? null
}

function markerPose(node: SceneNode | null) {
  if (!node) return null
  const object = objectByNodeId.get(node.id)
  if (object) {
    const pose = threeWorldPoseToRos(object, JOB_MAP_FRAME)
    return {
      x: pose.pose.position.x,
      y: pose.pose.position.y,
      yaw: rosYawFromQuaternion(pose.pose.orientation),
    }
  }
  const ros = threePositionToRos(
    node.transform.position[0],
    node.transform.position[1],
    node.transform.position[2],
  )
  return {
    x: ros.x,
    y: ros.y,
    yaw: threeEulerDegToRosYaw(node.transform.rotation),
  }
}

function phaseI18nKey(phaseName: string, phase: number): MessageKey {
  const name = (phaseName || jobPhaseNameFromCode(phase) || 'IDLE') as JobPhaseName
  return `shelfJob.phase.${name}` as MessageKey
}

export function ShelfJobPanel() {
  const { t } = useI18n()
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const [nodes, setNodes] = useAtom(sceneNodesAtom)
  const setSelected = useSetAtom(selectedNodeIdAtom)
  const job = useSyncExternalStore(
    shelfJobStore.subscribe.bind(shelfJobStore),
    () => shelfJobStore.getSnapshot(),
    () => shelfJobStore.getSnapshot(),
  )
  const [mode, setMode] = useState<JobMode>('location-id')
  const [pickLocationId, setPickLocationId] = useState(DEFAULT_PICK_LOCATION_ID)
  const [dropLocationId, setDropLocationId] = useState(DEFAULT_DROP_LOCATION_ID)

  const simActive = simulateStatus === 'connected'
  const pickNode = findMarker(nodes, 'pick')
  const dropNode = findMarker(nodes, 'drop')
  const pickPose = useMemo(() => markerPose(pickNode), [pickNode, nodes])
  const dropPose = useMemo(() => markerPose(dropNode), [dropNode, nodes])

  const canStartById = pickLocationId.trim().length > 0 && dropLocationId.trim().length > 0
  const canStartByMap = pickPose != null && dropPose != null
  const canStart =
    simActive && job.servicesReady && !job.sending && (mode === 'location-id' ? canStartById : canStartByMap)

  const addMarker = useCallback(
    (role: 'pick' | 'drop') => {
      const existing = findMarker(nodes, role)
      if (existing) {
        setSelected(existing.id)
        return
      }
      const { nodes: next, newNode } = addNodeToScene(nodes, 'nav-waypoint', 'root')
      const named: SceneNode = {
        ...newNode,
        name: role === 'pick' ? t('shelfJob.pickMarker') : t('shelfJob.dropMarker'),
        markerRole: role,
        transform: {
          ...newNode.transform,
          position: role === 'pick' ? [0, 0.05, 0] : [2, 0.05, 0],
        },
      }
      setNodes({ ...next, [named.id]: named })
      setSelected(named.id)
    },
    [nodes, setNodes, setSelected, t],
  )

  const startJob = useCallback(async () => {
    if (mode === 'location-id') {
      try {
        await foxgloveManager.startShelfJob({
          pick_location_id: pickLocationId.trim(),
          drop_location_id: dropLocationId.trim(),
          pick_x: 0,
          pick_y: 0,
          pick_yaw: 0,
          drop_x: 0,
          drop_y: 0,
          drop_yaw: 0,
          pick_tag: 0,
          drop_tag: 0,
        })
      } catch {
        /* store updated */
      }
      return
    }
    if (!pickPose || !dropPose) return
    try {
      await foxgloveManager.startShelfJob({
        pick_location_id: '',
        drop_location_id: '',
        pick_x: pickPose.x,
        pick_y: pickPose.y,
        pick_yaw: pickPose.yaw,
        drop_x: dropPose.x,
        drop_y: dropPose.y,
        drop_yaw: dropPose.yaw,
        pick_tag: 0,
        drop_tag: 1,
      })
    } catch {
      /* store updated */
    }
  }, [mode, pickLocationId, dropLocationId, pickPose, dropPose])

  const cancelJob = useCallback(async () => {
    try {
      await foxgloveManager.cancelShelfJob()
    } catch {
      /* store updated */
    }
  }, [])

  const phaseKey = phaseI18nKey(job.phaseName, job.phase)
  const phaseLabel = t(phaseKey)
  const progressPct = Math.max(0, Math.min(100, Math.round((job.progress || 0) * 100)))

  const statusTone =
    job.phase === JOB_PHASE.DONE
      ? 'success'
      : job.phase === JOB_PHASE.FAILED
        ? 'error'
        : job.phase === JOB_PHASE.CANCELED
          ? 'warn'
          : job.sending || (job.phase >= JOB_PHASE.PICK_NAV && job.phase <= JOB_PHASE.DROP_DOCK)
            ? 'ready'
            : simActive && job.servicesReady
              ? 'idle'
              : simActive
                ? 'pending'
                : 'idle'

  const statusClass = {
    success: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
    error: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    ready: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400',
    pending: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    idle: 'border-border bg-muted/30 text-muted-foreground',
  }[statusTone]

  return (
    <div className="p-4 space-y-3 h-full min-h-0 flex flex-col">
      <div className="flex items-center gap-2 shrink-0">
        <Package className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-medium">{t('panels.shelfJob.name')}</h3>
          <p className="text-[10px] text-muted-foreground">
            {JOB_START_SERVICE} · {JOB_CANCEL_SERVICE} · {JOB_STATUS_TOPIC}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        <section className="flex-1 min-w-0 rounded-md border border-border bg-muted/15 p-3 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">{t('shelfJob.card.settings')}</h4>

          <div className={cn('rounded-md border px-3 py-2 text-xs flex items-center gap-2', statusClass)}>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>
              {!simActive
                ? `${t('shelfJob.notConnected')} (${FOXGLOVE_WS_URL})`
                : !job.servicesReady
                  ? t('shelfJob.servicesMissing')
                  : `${t('shelfJob.mapFrame')}: ${JOB_MAP_FRAME} · ${phaseLabel}`}
            </span>
          </div>

          <div className="flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              className={cn(
                'flex-1 px-3 py-1.5',
                mode === 'location-id' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50',
              )}
              onClick={() => setMode('location-id')}
            >
              {t('shelfJob.mode.locationId')}
            </button>
            <button
              type="button"
              className={cn(
                'flex-1 px-3 py-1.5 border-l border-border',
                mode === 'map-pick' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50',
              )}
              onClick={() => setMode('map-pick')}
            >
              {t('shelfJob.mode.mapPick')}
            </button>
          </div>

          {mode === 'location-id' ? (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t('shelfJob.locationIdHint')}
              </p>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">{t('shelfJob.pickLocationId')}</span>
                <input
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
                  value={pickLocationId}
                  onChange={(e) => setPickLocationId(e.target.value)}
                  spellCheck={false}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] text-muted-foreground">{t('shelfJob.dropLocationId')}</span>
                <input
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono"
                  value={dropLocationId}
                  onChange={(e) => setDropLocationId(e.target.value)}
                  spellCheck={false}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {t('shelfJob.mapPickHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-green-600/90 text-white text-xs hover:opacity-90"
                  onClick={() => addMarker('pick')}
                >
                  {t('shelfJob.addPick')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md bg-red-600/90 text-white text-xs hover:opacity-90"
                  onClick={() => addMarker('drop')}
                >
                  {t('shelfJob.addDrop')}
                </button>
              </div>
              <div className="rounded-md border border-border/70 bg-background/40 px-3 py-2 text-[10px] font-mono space-y-1">
                <p className="text-green-600 dark:text-green-400">
                  pick {pickPose ? `${pickPose.x.toFixed(2)}, ${pickPose.y.toFixed(2)} yaw=${pickPose.yaw.toFixed(3)}` : '—'}
                </p>
                <p className="text-red-600 dark:text-red-400">
                  drop {dropPose ? `${dropPose.x.toFixed(2)}, ${dropPose.y.toFixed(2)} yaw=${dropPose.yaw.toFixed(3)}` : '—'}
                </p>
              </div>
              {(!pickNode || !dropNode) && (
                <p className="text-xs text-amber-600 dark:text-amber-400">{t('shelfJob.needBothMarkers')}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canStart}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5',
                canStart
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
              onClick={() => void startJob()}
            >
              <Send className="h-3.5 w-3.5" />
              {t('shelfJob.start')}
            </button>
            <button
              type="button"
              disabled={!simActive || !job.servicesReady}
              className="px-3 py-1.5 rounded-md border border-red-500/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5 hover:bg-red-500/10 disabled:opacity-50"
              onClick={() => void cancelJob()}
            >
              <XCircle className="h-3.5 w-3.5" />
              {t('shelfJob.cancel')}
            </button>
          </div>
        </section>

        <section className="flex-1 min-w-0 rounded-md border border-border bg-muted/15 p-3 space-y-3 overflow-y-auto">
          <h4 className="text-xs font-semibold text-foreground">{t('shelfJob.card.status')}</h4>

          <div className={cn('rounded-md border px-3 py-2 text-xs space-y-1', statusClass)}>
            <p className="font-medium">
              {phaseLabel}
              {job.phaseName ? ` · ${job.phaseName}` : ''}
            </p>
            {job.message ? (
              <p className="text-[10px] opacity-90 break-all">{job.message}</p>
            ) : job.lastCallMessage ? (
              <p className="text-[10px] opacity-90 break-all">{job.lastCallMessage}</p>
            ) : null}
            {job.subscribed ? (
              <p className="text-[10px] opacity-70">{JOB_STATUS_TOPIC}</p>
            ) : (
              <p className="text-[10px] opacity-70">{t('shelfJob.waitingStatus')}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{t('shelfJob.progress')}</span>
              <span className="font-mono">{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {(job.errorCode !== 0 || job.childErrorCode !== 0) && (
            <p className="text-[10px] font-mono text-red-600 dark:text-red-400">
              error_code={job.errorCode} · child_error_code={job.childErrorCode}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
