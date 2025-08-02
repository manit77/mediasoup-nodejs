import NodeCache from "node-cache";

export class CacheManager {

  nodeCache = new NodeCache({ useClones: false });
  CACHE_TTL_SECS = 300; // 300 = 5 minutes

  set(cacheKey: string, objectToCache: any, timeoutSecs: number = this.CACHE_TTL_SECS) {
    this.nodeCache.set(cacheKey, objectToCache, timeoutSecs);
  }

  get(cacheKey: string): any | undefined {
    return this.nodeCache.get(cacheKey);
  }

}