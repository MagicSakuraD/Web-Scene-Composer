import protobuf from 'protobufjs'
import 'protobufjs/ext/descriptor'
import type { McapIndexedReader } from '@mcap/core'

class ProtobufRegistry {
  private typesBySchemaId = new Map<number, protobuf.Type>()
  private namesBySchemaId = new Map<number, string>()

  loadFromReader(reader: McapIndexedReader) {
    this.typesBySchemaId.clear()
    this.namesBySchemaId.clear()

    for (const [schemaId, schema] of reader.schemasById) {
      if (schema.encoding !== 'protobuf') continue
      try {
        const root = protobuf.Root.fromDescriptor(schema.data)
        const type = root.lookupType(schema.name)
        this.typesBySchemaId.set(schemaId, type)
        this.namesBySchemaId.set(schemaId, schema.name)
      } catch (err) {
        console.warn('[Protobuf] schema 加载失败:', schema.name, err)
      }
    }
  }

  reset() {
    this.typesBySchemaId.clear()
    this.namesBySchemaId.clear()
  }

  hasSchema(schemaId: number): boolean {
    return this.typesBySchemaId.has(schemaId)
  }

  getSchemaName(schemaId: number): string | undefined {
    return this.namesBySchemaId.get(schemaId)
  }

  decode(schemaId: number, data: Uint8Array): protobuf.Message | null {
    const type = this.typesBySchemaId.get(schemaId)
    if (!type) return null
    try {
      return type.decode(data)
    } catch (err) {
      console.warn('[Protobuf] decode 失败:', this.namesBySchemaId.get(schemaId), err)
      return null
    }
  }

  toObject(schemaId: number, message: protobuf.Message): Record<string, unknown> {
    const type = this.typesBySchemaId.get(schemaId)
    if (!type) return {}
    return type.toObject(message, {
      defaults: true,
      longs: Number,
      bytes: Uint8Array,
    }) as Record<string, unknown>
  }
}

export const protobufRegistry = new ProtobufRegistry()
