const ErrorResponse = require("./errorResponse");
const { calculateAge } = require("./age");

function normalizeRegistrationGender(gender) {
  switch (gender) {
    case "male":
    case "female":
    case "other":
      return gender;
    case "non-binary":
    case "prefer not to say":
      return "other";
    default:
      throw new ErrorResponse("Invalid gender for registration", 400);
  }
}

function validateRegistrationCreation({ event, policy, capacity, user }) {
  if (!event || event.is_deleted) {
    throw new ErrorResponse("Event not found", 404);
  }

  if (!policy || !capacity) {
    throw new ErrorResponse("Event configuration incomplete", 500);
  }

  if (event.status !== "REGISTRATION_OPEN") {
    throw new ErrorResponse("Registration is not open", 400);
  }

  if (!user || user.status !== "active") {
    throw new ErrorResponse("Account inactive", 403);
  }

  if (!user.profileCompletion?.basicInfo) {
    throw new ErrorResponse(
      "Please complete the following steps to continue: basicInfo",
      403,
    );
  }

  if (!user.profileCompletion?.questionnaire) {
    throw new ErrorResponse(
      "Please complete the following steps to continue: questionnaire",
      403,
    );
  }

  // TODO: require_questionnaire_completion should check for event specific questionnaire completion and not profile completion
  // Checking status of user draft for questionnaire in EventQuestionnaireConfig might help.
  if (
    policy.require_questionnaire_completion &&
    !user.profileCompletion?.questionnaire
  ) {
    throw new ErrorResponse(
      "Please complete the following steps to continue: questionnaire",
      403,
    );
  }

  const age = calculateAge(user.dateOfBirth);

  if (policy.min_age && (age === null || age < policy.min_age)) {
    throw new ErrorResponse(
      `Minimum age for registration is ${policy.min_age}`,
      400,
    );
  }

  if (policy.max_age && (age === null || age > policy.max_age)) {
    throw new ErrorResponse(
      `Maximum age for registration is ${policy.max_age}`,
      400,
    );
  }

  const registrationGender = normalizeRegistrationGender(user.gender);

  if (
    policy.gender_restrictions?.length &&
    !policy.gender_restrictions.includes(registrationGender)
  ) {
    throw new ErrorResponse("You are not eligible for this event", 403);
  }

  if (
    policy.profession_whitelist?.length &&
    !policy.profession_whitelist.some(
      (allowedProfession) =>
        allowedProfession?.trim().toLowerCase() ===
        user.occupation?.trim().toLowerCase(),
    )
  ) {
    throw new ErrorResponse("You are not eligible for this event", 403);
  }

  if (
    policy.education_whitelist?.length &&
    !policy.education_whitelist.some(
      (allowedEducation) =>
        allowedEducation?.trim().toLowerCase() ===
        user.education?.trim().toLowerCase(),
    )
  ) {
    throw new ErrorResponse("You are not eligible for this event", 403);
  }

  // if (
  //   typeof policy.min_quality_score === "number" &&
  //   user.averageRating < policy.min_quality_score
  // ) {
  //   throw new ErrorResponse("You are not eligible for this event", 403);
  // }

  return {
    registrationGender,
  };
}

module.exports = {
  normalizeRegistrationGender,
  validateRegistrationCreation,
};
