const Error = require("../utils/errorResponse");

/* ---------------------------------- */
/* TIMELINE VALIDATION */
/* ---------------------------------- */
function validateTimeline(payload) {
  const {
    registration_open_at,
    registration_close_at,
    matching_start_at,
    reveal_at,
    event_start_at,
    event_end_at,
    women_registration_close_at,
    men_selection_open_at,
  } = payload;

  const open = new Date(registration_open_at);
  const close = new Date(registration_close_at);
  const match = matching_start_at ? new Date(matching_start_at) : null;
  const reveal = new Date(reveal_at);
  const start = new Date(event_start_at);
  const end = new Date(event_end_at);

  if (!(open < close))
    throw new Error(
      "registration_open_at must be before registration_close_at",
      400,
    );

  if (match && !(close <= match))
    throw new Error("registration_close_at must be <= matching_start_at", 400);

  if (match && !(match <= reveal))
    throw new Error("matching_start_at must be <= reveal_at", 400);

  if (!(reveal <= start))
    throw new Error("reveal_at must be <= event_start_at", 400);

  if (!(start < end))
    throw new Error("event_start_at must be before event_end_at", 400);

  // ----------------------------------
  // WOMEN PRIORITY TIMELINE VALIDATION
  // ----------------------------------
  const womenClose = women_registration_close_at
    ? new Date(women_registration_close_at)
    : null;
  const menOpen = men_selection_open_at
    ? new Date(men_selection_open_at)
    : null;

  // If either field is present → enforce both
  if (womenClose || menOpen) {
    if (!womenClose || !menOpen) {
      throw new Error(
        "Both women_registration_close_at and men_selection_open_at are required together",
        400,
      );
    }

    // registration_open_at < women_registration_close_at
    if (!(open < womenClose)) {
      throw new Error(
        "registration_open_at must be before women_registration_close_at",
        400,
      );
    }

    // women_registration_close_at < men_selection_open_at
    if (!(womenClose < menOpen)) {
      throw new Error(
        "women_registration_close_at must be before men_selection_open_at",
        400,
      );
    }

    // men_selection_open_at <= reveal_at
    if (!(menOpen <= reveal)) {
      throw new Error(
        "men_selection_open_at must be before or equal to reveal_at",
        400,
      );
    }
  }
}

/* ---------------------------------- */
/* CAPACITY VALIDATION */
/* ---------------------------------- */
function validateCapacity(payload) {
  const {
    max_total_capacity,
    group_size_min,
    group_size_max,
    male_limit,
    female_limit,
    other_limit,
  } = payload;

  if (group_size_min > group_size_max)
    throw new Error("group_size_min must be <= group_size_max", 400);

  if (group_size_max > max_total_capacity)
    throw new Error("group_size_max cannot exceed max_total_capacity", 400);

  const limits = [male_limit, female_limit, other_limit].filter(
    (v) => v !== null && v !== undefined,
  );

  if (limits.length) {
    const totalGenderLimit = limits.reduce((a, b) => a + b, 0);
    if (totalGenderLimit > max_total_capacity)
      throw new Error("Sum of gender limits exceeds max_total_capacity", 400);
  }
}

/* ---------------------------------- */
/* FINANCIAL VALIDATION */
/* ---------------------------------- */
function validateFinancialConfig(payload) {
  const {
    base_price_men,
    base_price_women,
    discounted_price_men,
    discounted_price_women,
    allow_partial_refund,
    partial_refund_percentage,
    refund_deadline_hours,
  } = payload;

  if (base_price_men === undefined || base_price_men === null) {
    throw new Error("base_price_men is required");
  }

  if (base_price_women === undefined || base_price_women === null) {
    throw new Error("base_price_women is required");
  }

  if (typeof base_price_men !== "number" || base_price_men < 0) {
    throw new Error("base_price_men must be a non-negative number");
  }

  if (typeof base_price_women !== "number" || base_price_women < 0) {
    throw new Error("base_price_women must be a non-negative number");
  }

  if (discounted_price_men !== undefined && discounted_price_men !== null) {
    if (typeof discounted_price_men !== "number") {
      throw new Error("discounted_price_men must be a number");
    }

    if (discounted_price_men > base_price_men) {
      throw new Error("discounted_price_men cannot exceed base_price_men");
    }

    if (discounted_price_men < 0) {
      throw new Error("discounted_price_men cannot be negative");
    }
  }

  if (discounted_price_women !== undefined && discounted_price_women !== null) {
    if (typeof discounted_price_women !== "number") {
      throw new Error("discounted_price_women must be a number");
    }

    if (discounted_price_women > base_price_women) {
      throw new Error("discounted_price_women cannot exceed base_price_women");
    }

    if (discounted_price_women < 0) {
      throw new Error("discounted_price_women cannot be negative");
    }
  }

  if (
    partial_refund_percentage !== undefined &&
    partial_refund_percentage !== null
  ) {
    if (
      typeof partial_refund_percentage !== "number" ||
      partial_refund_percentage < 0 ||
      partial_refund_percentage > 100
    ) {
      throw new Error("partial_refund_percentage must be between 0 and 100");
    }
  }

  if (allow_partial_refund === false && partial_refund_percentage > 0) {
    throw new Error(
      "partial_refund_percentage invalid when partial refund is disabled",
    );
  }

  if (refund_deadline_hours !== undefined && refund_deadline_hours !== null) {
    if (
      typeof refund_deadline_hours !== "number" ||
      refund_deadline_hours < 0
    ) {
      throw new Error("refund_deadline_hours must be a non-negative number");
    }
  }

  return true;
}

/* ---------------------------------- */
/* SLUG NORMALIZATION */
/* ---------------------------------- */
function normalizeSlug(slug) {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

module.exports = {
  validateTimeline,
  validateCapacity,
  validateFinancialConfig,
  normalizeSlug,
};
