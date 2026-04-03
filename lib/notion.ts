import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import {
  getBlockCollectionId,
  getPageContentBlockIds,
  mergeRecordMaps
} from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { normalizeRecordMap } from './normalize-record-map'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: false
          }),
        {
          concurrency: 4
        }
      )
    }

    return []
  }
)

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageId)

  // Normalize the Notion API response to fix double-nested value structure
  recordMap = normalizeRecordMap(recordMap)

  // The double-nested value bug causes notion-client to fail detecting
  // collection_view blocks during getPage(), so collection_query is empty.
  // Re-fetch collection data after normalization.
  await fetchMissingCollectionData(recordMap)

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, normalizeRecordMap(navigationLinkRecordMap)),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  return recordMap
}

async function fetchMissingCollectionData(
  recordMap: ExtendedRecordMap
): Promise<void> {
  const contentBlockIds = getPageContentBlockIds(recordMap)

  const missingCollectionInstances = contentBlockIds.flatMap((blockId) => {
    const block = recordMap.block[blockId]?.value
    if (
      !block ||
      (block.type !== 'collection_view' &&
        block.type !== 'collection_view_page')
    ) {
      return []
    }

    const collectionId = getBlockCollectionId(block, recordMap)
    if (!collectionId) return []

    // Only fetch if collection_query is missing for this collection
    return (block.view_ids || [])
      .filter(
        (viewId: string) => !recordMap.collection_query[collectionId]?.[viewId]
      )
      .map((collectionViewId: string) => ({
        collectionId,
        collectionViewId
      }))
  })

  if (!missingCollectionInstances.length) return

  await pMap(
    missingCollectionInstances,
    async ({ collectionId, collectionViewId }) => {
      const collectionView =
        recordMap.collection_view[collectionViewId]?.value
      try {
        const collectionData = await notion.getCollectionData(
          collectionId,
          collectionViewId,
          collectionView
        )

        recordMap.block = {
          ...recordMap.block,
          ...normalizeRecordMap(collectionData.recordMap as any).block
        }
        recordMap.collection = {
          ...recordMap.collection,
          ...normalizeRecordMap(collectionData.recordMap as any).collection
        }
        recordMap.collection_view = {
          ...recordMap.collection_view,
          ...normalizeRecordMap(collectionData.recordMap as any)
            .collection_view
        }
        recordMap.collection_query[collectionId] = {
          ...recordMap.collection_query[collectionId],
          [collectionViewId]: (collectionData as any).result?.reducerResults
        }
      } catch (err) {
        console.warn(
          'fetchMissingCollectionData error',
          collectionId,
          collectionViewId,
          (err as Error).message
        )
      }
    },
    { concurrency: 4 }
  )
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}
