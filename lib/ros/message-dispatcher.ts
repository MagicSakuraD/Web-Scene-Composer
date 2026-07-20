import {

  decodeOdometry,

  decodePointCloud2,

  decodeTfMessage,

  parseCompressedImageMessage,

  isLidarPointCloudTopic,

  isCameraImageTopic,

  type DecodedCameraFrame,

  type DecodedPointCloud,

  type OdomMessage,

} from '@/lib/foxglove/ros-serialization'

import { ODOM_TOPIC, TF_TOPIC } from '@/lib/ros/atoms'

import { decodeImagePayload } from '@/lib/ros/image-decoder'

import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'

import {

  decodeFoxgloveCompressedImage,

  decodeFoxgloveFrameTransform,

  decodeFoxglovePointCloud,

  isFoxgloveProtobufSchema,

} from '@/lib/mcap/foxglove-protobuf-decode'



export interface DispatchHandlers {

  onOdom?: (pose: OdomMessage) => void

  onImage?: (topic: string, frame: DecodedCameraFrame) => void

  onPointCloud?: (topic: string, cloud: DecodedPointCloud) => void

}



export interface DispatchMessageOptions {

  topic: string

  schemaName: string

  messageEncoding?: string

  schemaId?: number

  data: Uint8Array

  handlers?: DispatchHandlers

}



export async function dispatchRosMessage(

  topic: string,

  schemaName: string,

  data: Uint8Array,

  handlers: DispatchHandlers = {},

): Promise<void> {

  return dispatchMcapMessage({ topic, schemaName, data, handlers })

}



export async function dispatchMcapMessage({

  topic,

  schemaName,

  messageEncoding,

  schemaId,

  data,

  handlers = {},

}: DispatchMessageOptions): Promise<void> {

  const isProtobuf =

    messageEncoding === 'protobuf' || isFoxgloveProtobufSchema(schemaName)



  if (isProtobuf && schemaId != null) {

    if (schemaName === 'foxglove.PointCloud' || schemaName.includes('PointCloud')) {

      const cloud = decodeFoxglovePointCloud(schemaId, data)

      if (cloud) handlers.onPointCloud?.(topic, cloud)

      return

    }



    if (schemaName === 'foxglove.CompressedImage' || schemaName.includes('CompressedImage')) {

      const frame = await decodeFoxgloveCompressedImage(schemaId, data)

      if (frame) handlers.onImage?.(topic, frame)

      return

    }



    if (schemaName === 'foxglove.FrameTransform' || topic === '/tf' || topic.endsWith('/tf')) {

      const transforms = decodeFoxgloveFrameTransform(schemaId, data)

      if (transforms) {

        tfRuntimeStore.setActive(true)

        tfRuntimeStore.updateTransforms(transforms)

      }

      return

    }



    return

  }



  if (topic === ODOM_TOPIC || schemaName.includes('Odometry')) {

    const pose = decodeOdometry(data)

    if (pose) handlers.onOdom?.(pose)

    return

  }



  if (topic === TF_TOPIC || schemaName.includes('TFMessage')) {

    const transforms = decodeTfMessage(data)

    if (transforms) {

      tfRuntimeStore.setActive(true)

      tfRuntimeStore.updateTransforms(transforms)

    }

    return

  }



  if (isLidarPointCloudTopic(topic, schemaName) || schemaName.includes('PointCloud2')) {

    const cloud = decodePointCloud2(data)

    if (cloud) handlers.onPointCloud?.(topic, cloud)

    return

  }



  if (isCameraImageTopic(topic, schemaName) || schemaName.includes('CompressedImage')) {

    const frame = await decodeImagePayload(topic, schemaName, data)

    if (frame) handlers.onImage?.(topic, frame)

    return

  }



  if (/image|camera/i.test(topic)) {

    const msg = parseCompressedImageMessage(data)

    if (msg) {

      const frame = await decodeImagePayload(topic, 'sensor_msgs/CompressedImage', data)

      if (frame) handlers.onImage?.(topic, frame)

    }

  }

}


