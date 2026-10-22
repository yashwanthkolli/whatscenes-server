const asyncHandler = require("../utils/asyncHandler");
const cloudinary = require("../utils/cloudinary");
const ErrorResponse = require("../utils/errorResponse");

// @desc    Upload or replace a profile picture
// @route   POST /api/v1/user/profile-picture
// @access  Private
const uploadProfilePicture = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse("Please upload an image", 400));
  }

  const user = req.user;
  const profilePictures = user.profilePictures || [];

  // The frontend sends the selected slot: 0, 1, or 2.
  const slotIndex = Number(req.body.slotIndex);

  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 2) {
    return next(new ErrorResponse("Invalid profile picture slot", 400));
  }

  // New photos must fill the next available slot.
  // Existing slots can be replaced individually.
  if (slotIndex > profilePictures.length) {
    return next(
      new ErrorResponse("Please fill the profile picture slots in order", 400),
    );
  }

  // A new slot cannot be added after reaching the limit.
  if (slotIndex === profilePictures.length && profilePictures.length >= 3) {
    return next(
      new ErrorResponse("Maximum of 3 profile pictures allowed", 400),
    );
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "profile_pictures",
        resource_type: "image",
      },
      (error, uploadedImage) => {
        if (error) {
          return reject(error);
        }

        resolve(uploadedImage);
      },
    );

    stream.end(req.file.buffer);
  }).catch(() => {
    throw new ErrorResponse("Image upload failed", 500);
  });

  // Replace the selected slot or append to the next empty slot.
  if (slotIndex < profilePictures.length) {
    user.profilePictures.set
      ? user.profilePictures.set(slotIndex, result.secure_url)
      : (profilePictures[slotIndex] = result.secure_url);
  } else {
    profilePictures.push(result.secure_url);
  }

  user.profilePictures = profilePictures;

  // Photos are complete once all 3 slots are filled.
  user.profileCompletion.photos = user.profilePictures.length === 3;

  await user.save();

  res.status(200).json({
    success: true,
    data: {
      profilePictures: user.profilePictures,
      profileCompletion: user.profileCompletion,
    },
  });
});

module.exports = {
  uploadProfilePicture,
};
