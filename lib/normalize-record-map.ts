import { type ExtendedRecordMap } from 'notion-types'

/**
 * Normalizes a single record entry by flattening the double-nested value structure.
 */
function normalizeRecord(record: any) {
  if (!record) {
    return record
  }

  // Check if this has the double-nested value.value structure
  if (
    record.value &&
    typeof record.value === 'object' &&
    'value' in record.value &&
    'role' in record.value
  ) {
    // Flatten: { value: { value: {...}, role } } -> { value: {...}, role }
    return {
      ...record,
      value: record.value.value,
      role: record.value.role
    }
  }

  return record
}

/**
 * Normalizes all records in a map.
 */
function normalizeMap<T>(map: Record<string, T> | undefined): Record<string, T> | undefined {
  if (!map) {
    return map
  }

  const normalized: Record<string, T> = {}
  for (const id in map) {
    normalized[id] = normalizeRecord(map[id])
  }
  return normalized
}

/**
 * Normalizes the Notion API response to fix the double-nested value structure.
 *
 * Notion API recently changed to return:
 *   { value: { value: {...}, role: "..." } }
 *
 * But react-notion-x expects:
 *   { value: {...}, role: "..." }
 *
 * This function flattens the nested structure for all record types.
 */
export function normalizeRecordMap(recordMap: ExtendedRecordMap): ExtendedRecordMap {
  if (!recordMap) {
    return recordMap
  }

  return {
    ...recordMap,
    block: normalizeMap(recordMap.block),
    collection: normalizeMap(recordMap.collection),
    collection_view: normalizeMap(recordMap.collection_view),
    notion_user: normalizeMap(recordMap.notion_user),
    collection_query: recordMap.collection_query,
    signed_urls: recordMap.signed_urls
  } as ExtendedRecordMap
}
