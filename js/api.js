/**
 * TheMealDB API wrapper.
 * All API calls go through here.
 * Docs: https://www.themealdb.com/api.php
 */

const API_BASE = "https://www.themealdb.com/api/json/v1/1";

/**
 * Search meals by name.
 * @param {string} query
 * @returns {Promise<Array>} array of meal summaries (may be empty)
 */
async function searchRecipes(query) {
  if (!query || !query.trim()) return [];
  const url = `${API_BASE}/search.php?s=${encodeURIComponent(query.trim())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();
  return data.meals || [];
}

/**
 * Get one random meal.
 * @returns {Promise<Object|null>}
 */
async function getRandomRecipe() {
  const res = await fetch(`${API_BASE}/random.php`);
  if (!res.ok) throw new Error(`Random failed (${res.status})`);
  const data = await res.json();
  return data.meals ? data.meals[0] : null;
}

/**
 * Get full recipe by ID.
 * @param {string|number} id
 * @returns {Promise<Object|null>}
 */
async function getRecipeById(id) {
  const res = await fetch(`${API_BASE}/lookup.php?i=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
  const data = await res.json();
  return data.meals ? data.meals[0] : null;
}

/**
 * List all categories.
 * @returns {Promise<Array>} array of {idCategory, strCategory, strCategoryThumb, strCategoryDescription}
 */
async function getCategories() {
  const res = await fetch(`${API_BASE}/categories.php`);
  if (!res.ok) throw new Error(`Categories failed (${res.status})`);
  const data = await res.json();
  return data.categories || [];
}

/**
 * Filter meals by category.
 * @param {string} category
 * @returns {Promise<Array>} meal summaries (not full recipes — use getRecipeById for details)
 */
async function getRecipesByCategory(category) {
  const res = await fetch(
    `${API_BASE}/filter.php?c=${encodeURIComponent(category)}`,
  );
  if (!res.ok) throw new Error(`Category filter failed (${res.status})`);
  const data = await res.json();
  return data.meals || [];
}
