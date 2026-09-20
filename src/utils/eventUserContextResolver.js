function resolveUserContext({
  baseData,
  registration,
  prelaunchWaitlist,
  user,
  group,
}) {
  const now = new Date();

  // -------------------------
  // NOT LOGGED IN
  // -------------------------
  if (!user) {
    return {
      isLoggedIn: false,
      cta: "LOGIN_REQUIRED",
      canRegister: false,
    };
  }

  // -------------------------
  // EXISTING REGISTRATION
  // -------------------------
  if (registration) {
    switch (registration.status) {
      case "CONFIRMED":
        return {
          isLoggedIn: true,
          isRegistered: true,
          cta: "VIEW_STATUS",
          canRegister: false,
          registrationId: registration._id,
        };

      case "WAITLISTED":
        return {
          isLoggedIn: true,
          isRegistered: true,
          cta: "WAITLISTED",
          canRegister: false,
          registrationId: registration._id,
        };

      case "SELECTED": {
        const isWomenPriority =
          baseData.eligibility?.womenPriority && user.gender === "male";

        if (isWomenPriority) {
          const openAt = baseData.schedule.menSelectionOpenAt;

          if (openAt && now < openAt) {
            return {
              isLoggedIn: true,
              isRegistered: true,
              cta: "WAIT_FOR_PAYMENT_WINDOW",
              canRegister: false,
              registrationId: registration._id,
            };
          }

          if (!group) {
            return {
              isLoggedIn: true,
              isRegistered: true,
              cta: "NOT_SELECTED",
              canRegister: false,
              registrationId: registration._id,
            };
          }

          if (group.confirmed_count >= group.max_group_size) {
            return {
              isLoggedIn: true,
              isRegistered: true,
              cta: "GROUP_FULL",
              canRegister: false,
              registrationId: registration._id,
            };
          }

          return {
            isLoggedIn: true,
            isRegistered: true,
            cta: "PAY_NOW",
            canRegister: true,
            registrationId: registration._id,
          };
        }

        return {
          isLoggedIn: true,
          isRegistered: true,
          cta: "PAY_NOW",
          canRegister: true,
          registrationId: registration._id,
        };
      }
      case "PAYMENT_PENDING":
        return {
          isLoggedIn: true,
          isRegistered: true,
          cta: "PAY_NOW",
          canRegister: true,
          registrationId: registration._id,
        };

      case "CANCELLED":
      case "EXPIRED":
      case "REFUNDED":
        break; // allow retry
    }
  }

  // -------------------------
  // ALREADY ON PRELAUNCH WAITLIST
  // -------------------------
  if (prelaunchWaitlist) {
    return {
      isLoggedIn: true,
      isOnPrelaunchWaitlist: true,
      cta: "PRELAUNCH_WAITLISTED",
      canRegister: false,
      prelaunchWaitlistId: prelaunchWaitlist._id,
    };
  }

  // -------------------------
  // REGISTRATION CLOSED
  // -------------------------
  if (!baseData.timeline.isRegistrationOpen) {
    return {
      isLoggedIn: true,
      cta: "REGISTRATION_CLOSED",
      canRegister: false,
    };
  }

  // -------------------------
  // WOMEN PRIORITY FLOW
  // -------------------------
  if (baseData.eligibility?.womenPriority && user.gender === "male") {
    return {
      isLoggedIn: true,
      cta: "APPLY",
      canRegister: true,
    };
  }

  // -------------------------
  // NORMAL FLOW
  // -------------------------
  if (baseData.timeline.isSoldOut) {
    return {
      isLoggedIn: true,
      cta: "SOLD_OUT",
      canRegister: false,
    };
  }

  return {
    isLoggedIn: true,
    cta: "REGISTER",
    canRegister: true,
  };
}

module.exports = {
  resolveUserContext,
};
