/**
 * Search UI logic.
 * Depends on api.js being loaded first.
 */

// --- DOM references (populated on DOMContentLoaded) ---
let searchInput;
let recipeGrid;
let statusEl;
let categoryChips;
let surpriseBtn;

// --- State ---
let currentQuery = "";
let debounceTimer = null;

// --- Debounce helper ---
function debounce(fn, delay) {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

// --- UI helpers ---
function showStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status-${type}`;
  statusEl.hidden = !message;
}

function clearGrid() {
  recipeGrid.innerHTML = "";
}

function showSkeletonCards(count = 6) {
  clearGrid();
  for (let i = 0; i < count; i++) {
    const card = document.createElement("div");
    card.className = "recipe-card skeleton";
    card.innerHTML = `
      <div class="skeleton-img"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    `;
    recipeGrid.appendChild(card);
  }
}

// --- Render one recipe card ---
function renderRecipeCard(meal) {
  const card = document.createElement("a");
  card.className = "recipe-card";
  card.href = `recipe.html?id=${encodeURIComponent(meal.idMeal)}`;
  card.innerHTML = `
    <img src="${meal.strMealThumb}" alt="${escapeHtml(meal.strMeal)}" loading="lazy" />
    <div class="recipe-card-body">
      <h3>${escapeHtml(meal.strMeal)}</h3>
      <p class="recipe-meta">${escapeHtml(meal.strCategory || "")}${meal.strArea ? " · " + escapeHtml(meal.strArea) : ""}</p>
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

// --- Main search flow ---
async function performSearch(query) {
  currentQuery = query;
  if (!query.trim()) {
    clearGrid();
    showStatus("", "info");
    return;
  }
  showSkeletonCards();
  showStatus(`Searching for "${query}"...`, "info");
  try {
    const meals = await searchRecipes(query);
    clearGrid();
    if (meals.length === 0) {
      showStatus(
        `No recipes found for "${query}". Try a different word.`,
        "empty",
      );
      return;
    }
    showStatus(
      `${meals.length} recipe${meals.length === 1 ? "" : "s"} found`,
      "success",
    );
    meals.forEach((meal) => recipeGrid.appendChild(renderRecipeCard(meal)));
  } catch (err) {
    clearGrid();
    showStatus(
      `Couldn't load recipes. Check your connection and try again.`,
      "error",
    );
    console.error("Search error:", err);
  }
}

const debouncedSearch = debounce(performSearch, 350);

// --- Category filter ---
async function loadCategory(categoryName, chipEl) {
  document
    .querySelectorAll(".category-chip")
    .forEach((c) => c.classList.remove("active"));
  if (chipEl) chipEl.classList.add("active");
  showSkeletonCards();
  showStatus(`Loading ${categoryName} recipes...`, "info");
  try {
    const meals = await getRecipesByCategory(categoryName);
    clearGrid();
    if (meals.length === 0) {
      showStatus(`No recipes in "${categoryName}".`, "empty");
      return;
    }
    showStatus(
      `${meals.length} recipe${meals.length === 1 ? "" : "s"} in ${categoryName}`,
      "success",
    );
    meals.forEach((meal) => recipeGrid.appendChild(renderRecipeCard(meal)));
  } catch (err) {
    clearGrid();
    showStatus(`Couldn't load ${categoryName}. Try again.`, "error");
    console.error("Category error:", err);
  }
}

// --- Surprise me ---
async function surpriseMe() {
  showSkeletonCards(1);
  showStatus("Picking a random recipe...", "info");
  try {
    const meal = await getRandomRecipe();
    clearGrid();
    if (!meal) {
      showStatus("No random recipe available. Try again.", "error");
      return;
    }
    showStatus(`Random pick: ${meal.strMeal}`, "success");
    recipeGrid.appendChild(renderRecipeCard(meal));
  } catch (err) {
    clearGrid();
    showStatus("Could not pick a random recipe. Try again.", "error");
    console.error("Random error:", err);
  }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  searchInput = document.getElementById("search-input");
  recipeGrid = document.getElementById("recipe-grid");
  statusEl = document.getElementById("status");
  categoryChips = document.getElementById("category-chips");
  surpriseBtn = document.getElementById("surprise-btn");

  // Search input
  searchInput.addEventListener("input", (e) => {
    debouncedSearch(e.target.value);
  });

  // Surprise button
  surpriseBtn.addEventListener("click", () => {
    searchInput.value = "";
    document
      .querySelectorAll(".category-chip")
      .forEach((c) => c.classList.remove("active"));
    surpriseMe();
  });

  // Load categories
  try {
    const categories = await getCategories();
    // Show 8 popular ones to keep the row compact
    const shown = categories.slice(0, 8);
    shown.forEach((cat) => {
      const chip = document.createElement("button");
      chip.className = "category-chip";
      chip.textContent = cat.strCategory;
      chip.addEventListener("click", () => loadCategory(cat.strCategory, chip));
      categoryChips.appendChild(chip);
    });
  } catch (err) {
    console.error("Failed to load categories:", err);
    // Non-fatal — search still works
  }

  // Focus the search box
  searchInput.focus();
});
