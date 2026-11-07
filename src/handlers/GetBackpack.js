/**
 * GetBackpack  (CSGetBackpackReq -> CSGetBackpackRes)
 * reference: get_backpack @ htpp.py:3135 — return the player's wallet,
 * selected_items (synced from the selected profile) and backpack items.
 *
 * Ported from ported_0.js (handleGetBackpack), preserving logic exactly.
 */

'use strict';

const path = require('path');
const { requireAccount, selectedProfile, buildSelectedItems, syncSelectedItemsFromProfile } = require('./_shared');
const characters = require('../../config/character-settings');
const GLOBAL_ITEMS = require(path.join(__dirname, '..', '..', 'config', 'items.json')).items;

// The extracted item catalogue contains repeated regional rows. Item identity
// in CSGetBackpackRes is the numeric id, so sending every source row makes the
// vault render the same item more than once for every account. Keep one stable
// record per id before applying account-specific filters.
const UNIQUE_GLOBAL_ITEMS = Array.from(
    GLOBAL_ITEMS.reduce((itemsById, item) => {
        const id = Number(item && item.id);
        if (Number.isFinite(id) && !itemsById.has(id)) itemsById.set(id, item);
        return itemsById;
    }, new Map()).values()
);

// GetBackpack is one of the largest responses (about 29k catalogue rows). Most
// accounts use the same Elite Pass badge, so build that immutable catalogue once
// instead of filtering/copying the entire array on every vault open.
const itemCatalogueCache = new Map();
const responseCache = new Map();
const MAX_RESPONSE_CACHE = 16;

function catalogueForBadge(badgeId, badgeCount) {
    const characterKey = characters.cacheKey();
    const key = `${badgeId}:${badgeCount}:${characterKey}`;
    let items = itemCatalogueCache.get(key);
    if (items) return items;

    items = UNIQUE_GLOBAL_ITEMS.filter((item) =>
        item.id !== badgeId && (!characters.isCharacter(item.id) || characters.isEnabled(item.id))
    );
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

function mergeOwnedItems(catalogue, ownedItems) {
    if (!Array.isArray(ownedItems) || !ownedItems.length) return catalogue;
    const byId = new Map(catalogue.map((item, index) => [Number(item.id), index]));
    const merged = catalogue.slice();
    for (const owned of ownedItems) {
        const id = Number(owned && owned.id);
        const cnt = Number(owned && owned.cnt);
        if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(cnt) || cnt <= 0) continue;
        const index = byId.get(id);
        if (index == null) {
            byId.set(id, merged.length);
            merged.push({ id, cnt, expire_time: 0, left_use_times: -1, history_owned_cnt: cnt, item_status: 1, ...owned });
        } else {
            const base = merged[index];
            merged[index] = { ...base, ...owned, id, cnt, history_owned_cnt: Math.max(Number(base.history_owned_cnt || 0), Number(owned.history_owned_cnt || 0), cnt) };
        }
    }
    return merged;
}

function handleGetBackpack(reqObj, ctx) {
    const account = requireAccount(ctx);
    if (!account) return {};

    const profiles = (account.profile && account.profile.profiles) || [];
    let prof = selectedProfile(account);
    if (prof && !characters.isEnabled(prof.avatar_id)) {
        const fallback = profiles.find((profile) => characters.isEnabled(profile.avatar_id));
        if (fallback) {
            profiles.forEach((profile) => { profile.is_selected = profile === fallback; });
            syncSelectedItemsFromProfile(account, fallback);
            ctx.savePlayer();
            ctx.logger.info(`[backpack] uid=${account.uid} forced selected avatar=${fallback.avatar_id}`);
            prof = fallback;
        } else {
            prof = null;
        }
    }
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
    const ownedItems = account.backpack && Array.isArray(account.backpack.items) ? account.backpack.items : [];
    const items = mergeOwnedItems(catalogueForBadge(epBadgeId, epBadgeCount), ownedItems);
    ctx.logger.debug(`[backpack] uid=${account.uid} items=${items.length}`);
    const selectedItems = buildSelectedItems(account);
    const cacheKey = JSON.stringify([
        wallet.coins || 0,
        wallet.gems || 0,
        epBadgeId,
        epBadgeCount,
        characters.cacheKey(),
        selectedItems,
        ownedItems.map((item) => [Number(item.id), Number(item.cnt || 0), Number(item.expire_time || 0)])
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
  handler: handleGetBackpack,
  _catalogueForBadge: catalogueForBadge,
  _uniqueGlobalItems: UNIQUE_GLOBAL_ITEMS,
  _mergeOwnedItems: mergeOwnedItems
};
