const VALID_CATEGORIES = ['Sports', 'Movies', 'Video Games', 'Politics', 'Business/Tech', 'General'];

function isValidCategory(category) {
  return VALID_CATEGORIES.includes(category);
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { VALID_CATEGORIES, isValidCategory, parsePagination };
