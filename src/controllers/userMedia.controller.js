const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../utils/cloudinary");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Upload profile picture
// @route   PATCH /api/v1/user/profile-picture
// @access  Private
const uploadProfilePicture = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse("Please upload an image", 400));
  }

  const user = req.user;

  // Limit number of profile pictures
  if (user.profilePictures.length >= 5) {
    return next(
      new ErrorResponse("Maximum profile pictures limit reached", 400),
    );
  }

  // Upload to Cloudinary
  const result = await cloudinary.uploader.upload_stream(
    {
      folder: "profile_pictures",
      resource_type: "image",
    },
    async (error, result) => {
      if (error) {
        return next(new ErrorResponse("Image upload failed", 500));
      }

      user.profilePictures.push(result.secure_url);

      // Update completion flag
      if (user.profilePictures.length > 2) {
        user.profileCompletion.photos = true;
      }

      await user.save();

      res.status(200).json({
        success: true,
        data: {
          profilePictures: user.profilePictures,
          profileCompletion: user.profileCompletion,
        },
      });
    },
  );

  result.end(req.file.buffer);
});

module.exports = {
  uploadProfilePicture,
};
