const { parse } = require("csv-parse/sync");
const ErrorResponse = require("./errorResponse");

/**
 * Parse and validate CSV buffer
 */
exports.parseMatchmakingCSV = (fileBuffer) => {
  let records;

  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new ErrorResponse("Invalid CSV format", 400);
  }

  if (!records.length) {
    throw new ErrorResponse("CSV is empty", 400);
  }

  // Validate headers
  const requiredFields = ["group_number", "registration_id"];

  const headers = Object.keys(records[0]);

  for (const field of requiredFields) {
    if (!headers.includes(field)) {
      throw new ErrorResponse(`Missing column: ${field}`, 400);
    }
  }

  const groups = {};
  const registrationIds = new Set();

  records.forEach((row, index) => {
    const rowNum = index + 2; // +2 because header row

    const groupNumber = Number(row.group_number);
    const registrationId = row.registration_id;

    // Validate group number
    if (!groupNumber || isNaN(groupNumber)) {
      throw new ErrorResponse(`Invalid group_number at row ${rowNum}`, 400);
    }

    // Validate registration id
    if (!registrationId) {
      throw new ErrorResponse(`Missing registration_id at row ${rowNum}`, 400);
    }

    // Duplicate check
    if (registrationIds.has(registrationId)) {
      throw new ErrorResponse(
        `Duplicate registration_id at row ${rowNum}`,
        400,
      );
    }

    registrationIds.add(registrationId);

    // Build groups
    if (!groups[groupNumber]) {
      groups[groupNumber] = [];
    }

    groups[groupNumber].push(registrationId);
  });

  return {
    groups,
    registrationIds: Array.from(registrationIds),
  };
};
