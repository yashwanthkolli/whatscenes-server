const multer = require("multer");
const path = require("path");
const ErrorResponse = require("../utils/errorResponse");

const storage = multer.memoryStorage();

const allowedImageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".avif",
  ".jxl",
  ".ico",
]);

const imageFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  const isImage =
    file.mimetype?.toLowerCase().startsWith("image/") ||
    allowedImageExtensions.has(extension);

  if (isImage) {
    return cb(null, true);
  }

  return cb(
    new ErrorResponse("Please upload a supported image file", 400),
    false,
  );
};

const csvFilter = (req, file, cb) => {
  const isCSV =
    file.mimetype === "text/csv" ||
    path.extname(file.originalname).toLowerCase() === ".csv";

  if (isCSV) {
    return cb(null, true);
  }

  return cb(new ErrorResponse("Please upload a CSV file", 400), false);
};

const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  // No fileSize limit. Configure one if needed for server protection.
});

const uploadCsv = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: csvFilter,
});

module.exports = {
  uploadImage,
  uploadCsv,
};
