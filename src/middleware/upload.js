const multer = require("multer");
const ErrorResponse = require("../utils/errorResponse");

const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ErrorResponse("Please upload an image file", 400), false);
  }
};

const csvFilter = (req, file, cb) => {
  const isCSV =
    file.mimetype === "text/csv" || file.originalname.endsWith(".csv");

  if (isCSV) {
    cb(null, true);
  } else {
    cb(new ErrorResponse("Please upload a CSV file", 400), false);
  }
};

const uploadImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: imageFilter,
});

const uploadCsv = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: csvFilter,
});

module.exports = {
  uploadImage,
  uploadCsv,
};
