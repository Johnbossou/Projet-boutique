<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Redis;

class AnalyticsCacheService
{
    /**
     * Cache duration in seconds (default: 5 minutes)
     */
    private int $cacheDuration = 300;

    /**
     * Get cached analytics data
     */
    public function get(string $key, callable $callback, int $duration = null)
    {
        $cacheKey = $this->getCacheKey($key);
        $duration = $duration ?? $this->cacheDuration;

        return Cache::remember($cacheKey, $duration, $callback);
    }

    /**
     * Get cached data with tags for easier invalidation
     */
    public function getWithTags(string $key, array $tags, callable $callback, int $duration = null)
    {
        $cacheKey = $this->getCacheKey($key);
        $duration = $duration ?? $this->cacheDuration;

        return Cache::tags($tags)->remember($cacheKey, $duration, $callback);
    }

    /**
     * Invalidate cache by key
     */
    public function forget(string $key): void
    {
        $cacheKey = $this->getCacheKey($key);
        Cache::forget($cacheKey);
    }

    /**
     * Invalidate cache by tags
     */
    public function forgetTags(array $tags): void
    {
        Cache::tags($tags)->flush();
    }

    /**
     * Clear all analytics cache
     */
    public function clearAll(): void
    {
        Cache::tags(['analytics'])->flush();
    }

    /**
     * Generate cache key with prefix
     */
    private function getCacheKey(string $key): string
    {
        $boutiqueId = auth()->user()?->current_boutique_id ?? 'global';
        return "analytics:{$boutiqueId}:{$key}";
    }

    /**
     * Set cache duration
     */
    public function setCacheDuration(int $seconds): void
    {
        $this->cacheDuration = $seconds;
    }

    /**
     * Get cache statistics
     */
    public function getStats(): array
    {
        try {
            if (config('cache.default') === 'redis') {
                $info = Redis::info('stats');
                return [
                    'hits' => $info['keyspace_hits'] ?? 0,
                    'misses' => $info['keyspace_misses'] ?? 0,
                    'keys' => $info['keyspace'] ?? 0,
                ];
            }
        } catch (\Exception $e) {
            // Redis not available
        }

        return [
            'hits' => 0,
            'misses' => 0,
            'keys' => 0,
        ];
    }
}
