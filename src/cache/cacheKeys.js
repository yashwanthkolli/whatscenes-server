function eventDetailKey(city, slug) {
  return `event:detail:${city}:${slug}`;
}

function eventsListKey({
  city,
  area,
  event_type,
  difficulty_level,
  interest_tags,
  page,
  limit,
  sort,
  query,
}) {
  return `events:list:${city || "all"}:${area || "all"}:${
    event_type || "all"
  }:${difficulty_level || "all"}:${
    interest_tags || "all"
  }:p${page}:l${limit}:s${sort}:${query || "none"}`;
}

function homeEventsKey(city) {
  return `events:home:base:${city}`;
}

function profileQuestionnaireKey(questionnaireKey) {
  return `profile:questionnaire:active:${questionnaireKey}`;
}

module.exports = {
  eventDetailKey,
  eventsListKey,
  homeEventsKey,
  profileQuestionnaireKey,
};
