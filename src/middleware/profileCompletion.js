const ErrorResponse = require("../utils/errorResponse");

/**
 * Enforce profile completion requirements
 * @param  {...string} requiredSteps
 */
const requireProfileCompletion = (...requiredSteps) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse("Unauthorized", 401));
    }

    const { profileCompletion, status } = req.user;

    if (status !== "active") {
      return next(new ErrorResponse("Account inactive", 403));
    }

    if (!profileCompletion || typeof profileCompletion !== "object") {
      return next(
        new ErrorResponse("Profile completion status not found", 400),
      );
    }

    const incompleteSteps = requiredSteps.filter(
      (step) => !profileCompletion[step],
    );

    if (incompleteSteps.length > 0) {
      return next(
        new ErrorResponse(
          `Please complete the following steps to continue: ${incompleteSteps.join(
            ", ",
          )}`,
          403,
        ),
      );
    }

    next();
  };
};

module.exports = {
  requireProfileCompletion,
};
