const mapRegistration = (registration) => {
  if (!registration) return null;

  return {
    id: registration._id,

    status: registration.status,
    entryType: registration.entry_type,
    flowType: registration.flow_type,

    groupSize: registration.group_size,

    payment: {
      required: registration.payment_required,
      status: registration.payment_status,
    },

    timestamps: {
      createdAt: registration.createdAt,
      expiresAt: registration.expires_at,
      confirmedAt: registration.booking_confirmed_at,
    },
  };
};

module.exports = {
  mapRegistration,
};
