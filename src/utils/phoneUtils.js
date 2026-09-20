const normalizePhone = ({ countryCode, number }) => {
  const cleanNumber = number.replace(/\D/g, '');

  return {
    countryCode: countryCode.trim(),
    number: cleanNumber,
  };
};

module.exports = { normalizePhone };