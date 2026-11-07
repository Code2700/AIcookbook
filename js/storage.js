/**
 * Favorites storage using localStorage.
 * Stores an array of recipe IDs (strings) under key "ai-cookbook:favorites".
 *
 * Recipe details are NOT stored — we refetch from API when needed.
 * Only IDs — keeps storage tiny and always fresh.
 */

const FAVORITES_KEY = "ai-cookbook:favorites";

/**
 * Get all favorite recipe IDs.
 * @returns {string[]}
 */
function getFavoriteIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not parse favorites:", err);
    return [];
  }
}

/**
 * Check if a recipe is favorited.
 * @param {string} id
 * @returns {boolean}
 */
function isFavorite(id) {
  if (!id) return false;
  return getFavoriteIds().includes(String(id));
}

/**
 * Add or remove a favorite. Returns the new state.
 * @param {string} id
 * @returns {boolean} true if now favorited, false if removed
 */
function toggleFavorite(id) {
  if (!id) return false;
  const sid = String(id);
  const ids = getFavoriteIds();
  const idx = ids.indexOf(sid);
  if (idx === -1) {
    ids.push(sid);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    return true;
  } else {
    ids.splice(idx, 1);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
    return false;
  }
}
