/**
 * Recipe detail page logic.
 * Depends on api.js and storage.js being loaded first.
 */

const urlParams = new URLSearchParams(window.location.search);
const recipeId = urlParams.get("id");

// --- Helpers ---
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

/**
 * TheMealDB stores ingredients as strIngredient1..20 + strMeasure1..20.
 * This extracts only the non-empty pairs.
 * @returns {Array<{name: string, measure: string}>}
 */
function extractIngredients(meal) {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (name) out.push({ name, measure });
  }
  return out;
}

/**
 * Instructions are one big string with \r\n. Split into steps.
 * @returns {string[]}
 */
function splitSteps(instructions) {
  if (!instructions) return [];
  return instructions
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// --- Rendering ---
function renderRecipe(meal) {
  const root = document.getElementById("recipe-root");
  const fav = isFavorite(meal.idMeal);

  const ingredients = extractIngredients(meal);
  const steps = splitSteps(meal.strInstructions);

  root.innerHTML = `
    <div class="recipe-detail">
      <div class="recipe-hero">
        <img src="${escapeHtml(meal.strMealThumb)}" alt="${escapeHtml(meal.strMeal)}" />
        <div class="recipe-hero-actions">
          <button id="fav-btn" class="fav-btn ${fav ? "active" : ""}" type="button" aria-pressed="${fav}">
            ${fav ? "❤️" : "🤍"} <span>${fav ? "Saved" : "Save"}</span>
          </button>
          <a href="cook.html?id=${encodeURIComponent(meal.idMeal)}" class="btn-cook">
            🔊 Start cooking
          </a>
        </div>
      </div>

      <header class="recipe-header">
        <h1>${escapeHtml(meal.strMeal)}</h1>
        <p class="recipe-tags">
          ${meal.strCategory ? `<span class="tag">${escapeHtml(meal.strCategory)}</span>` : ""}
          ${meal.strArea ? `<span class="tag">${escapeHtml(meal.strArea)}</span>` : ""}
          ${
            meal.strTags
              ? meal.strTags
                  .split(",")
                  .map(
                    (t) =>
                      `<span class="tag tag-muted">${escapeHtml(t.trim())}</span>`,
                  )
                  .join("")
              : ""
          }
        </p>
        ${meal.strYoutube ? `<a class="recipe-video" href="${escapeHtml(meal.strYoutube)}" target="_blank" rel="noopener">▶ Watch on YouTube</a>` : ""}
        ${meal.strSource ? `<a class="recipe-source" href="${escapeHtml(meal.strSource)}" target="_blank" rel="noopener">🔗 View original source</a>` : ""}
      </header>

      <section class="recipe-body">
        <div class="recipe-ingredients">
          <h2>Ingredients</h2>
          <ul>
            ${ingredients.map(({ name, measure }) => `<li><strong>${escapeHtml(measure)}</strong> ${escapeHtml(name)}</li>`).join("")}
          </ul>
        </div>

        <div class="recipe-steps">
          <h2>Steps</h2>
          <ol>
            ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
          </ol>
        </div>
      </section>
    </div>
  `;

  // Wire the favorite button
  const favBtn = document.getElementById("fav-btn");
  favBtn.addEventListener("click", () => {
    const nowFav = toggleFavorite(meal.idMeal);
    favBtn.classList.toggle("active", nowFav);
    favBtn.setAttribute("aria-pressed", String(nowFav));
    favBtn.innerHTML = nowFav
      ? "❤️ <span>Saved</span>"
      : "🤍 <span>Save</span>";
  });
}

function renderError(message) {
  document.getElementById("recipe-root").innerHTML = `
    <div class="recipe-error">
      <h2>Couldn't load recipe</h2>
      <p>${escapeHtml(message)}</p>
      <a href="index.html" class="btn-back">← Back to search</a>
    </div>
  `;
}

function renderSkeleton() {
  document.getElementById("recipe-root").innerHTML = `
    <div class="recipe-detail skeleton-detail">
      <div class="skeleton-img big"></div>
      <div class="skeleton-line tall"></div>
      <div class="skeleton-line short"></div>
    </div>
  `;
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  if (!recipeId) {
    renderError("No recipe ID in URL. Go back and pick a recipe.");
    return;
  }
  renderSkeleton();
  try {
    const meal = await getRecipeById(recipeId);
    if (!meal) {
      renderError("Recipe not found.");
      return;
    }
    renderRecipe(meal);
  } catch (err) {
    console.error("Recipe load error:", err);
    renderError("Network error. Check your connection and try again.");
  }
});
