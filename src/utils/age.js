/**
 * Calculate a person's completed years of age from their date of birth.
 *
 * UTC calendar components are used so an ISO date (YYYY-MM-DD) produces the
 * same result regardless of the server's time zone.
 *
 * @param {Date|string} dateOfBirth
 * @param {Date} [asOf=new Date()]
 * @returns {number|null} The age, or null when the date is absent, invalid, or in the future.
 */
function calculateAge(dateOfBirth, asOf = new Date()) {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);
  const referenceDate = new Date(asOf);

  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(referenceDate.getTime()) ||
    birthDate > referenceDate
  ) {
    return null;
  }

  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayHasNotOccurredThisYear =
    referenceDate.getUTCMonth() < birthDate.getUTCMonth() ||
    (referenceDate.getUTCMonth() === birthDate.getUTCMonth() &&
      referenceDate.getUTCDate() < birthDate.getUTCDate());

  if (birthdayHasNotOccurredThisYear) {
    age -= 1;
  }

  return age;
}

module.exports = {
  calculateAge,
};
