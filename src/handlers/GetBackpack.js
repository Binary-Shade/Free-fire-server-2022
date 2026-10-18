/**
 * GetBackpack  (CSGetBackpackReq -> CSGetBackpackRes)
 * reference: get_backpack @ htpp.py:3135 — return the player's wallet,
 * selected_items (synced from the selected profile) and backpack items.
 *
 * Ported from ported_0.js (handleGetBackpack), preserving logic exactly.
 */

'use strict';

const path = require('path');
const { requireAccount, selectedProfile, buildSelectedItems } = require('./_shared');
const GLOBAL_ITEMS = require(path.join(__dirname, '..', '..', 'config', 'items.json')).items;

// GetBackpack is one of the largest responses (about 29k catalogue rows). Most
// accounts use the same Elite Pass badge, so build that immutable catalogue once
// instead of filtering/copying the entire array on every vault open.
const itemCatalogueCache = new Map();
const responseCache = new Map();
const MAX_RESPONSE_CACHE = 16;

function catalogueForBadge(badgeId, badgeCount) {
    const key = `${badgeId}:${badgeCount}`;
    let items = itemCatalogueCache.get(key);
    if (items) return items;

    items = GLOBAL_ITEMS.filter((item) => item.id !== badgeId);
    if (badgeCount > 0) {
        items.push({
            id: badgeId,
            cnt: badgeCount,
            expire_time: 0,
            left_use_times: -1,
            history_owned_cnt: badgeCount,
            item_status: 1
        });
    }
    itemCatalogueCache.set(key, items);
    return items;
}

function cachedResponse(key, build) {
    const hit = responseCache.get(key);
    if (hit) {
        // Refresh insertion order to make this a small LRU rather than an
        // unbounded per-player cache.
        responseCache.delete(key);
        responseCache.set(key, hit);
        return hit;
    }
    const value = build();
    responseCache.set(key, value);
    if (responseCache.size > MAX_RESPONSE_CACHE) {
        responseCache.delete(responseCache.keys().next().value);
    }
    return value;
}

function handleGetBackpack(reqObj, ctx) {
    const account = requireAccount(ctx);
    if (!account) return {};

    const prof = selectedProfile(account);
    if (prof) {
        account.selected_items = account.selected_items || {};
        const clothes = Array.isArray(prof.clothes) ? prof.clothes : [];
        const oldClothes = Array.isArray(account.selected_items.clothes) ? account.selected_items.clothes : [];
        const changed = account.selected_items.avatar_id !== prof.avatar_id ||
            account.selected_items.skin_color !== prof.skin_color ||
            oldClothes.length !== clothes.length ||
            oldClothes.some((id, index) => id !== clothes[index]);
        if (changed) {
            account.selected_items.avatar_id = prof.avatar_id;
            account.selected_items.skin_color = prof.skin_color;
            account.selected_items.clothes = clothes;
            ctx.savePlayer();
        }
    }

    const wallet = account.wallet || {
        coins: account.coins || 0,
        gems: account.gems || 0
    };

    const epBadgeId = account.ep_badge_id || 1001000021;
    const epBadgeCount = account.ep_badge_count || 999;
    const items = catalogueForBadge(epBadgeId, epBadgeCount);
    ctx.logger.debug(`[backpack] uid=${account.uid} items=${items.length}`);
    const selectedItems = buildSelectedItems(account);
    const cacheKey = JSON.stringify([
        wallet.coins || 0,
        wallet.gems || 0,
        epBadgeId,
        epBadgeCount,
        selectedItems
    ]);
    return cachedResponse(cacheKey, () => ({
        wallet: {
            coins: wallet.coins || 0,
            gems: wallet.gems || 0
        },
        selected_items: selectedItems,
        items
    }));
}

module.exports = {
  endpoint: 'GetBackpack',
  reqType: 'CSGetBackpackReq',
  resType: 'CSGetBackpackRes',
  handler: handleGetBackpack
};
