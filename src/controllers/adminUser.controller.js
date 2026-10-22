const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const userListProjection = [
  "name",
  "phone",
  "email",
  "gender",
  "dateOfBirth",
  "currentLocation",
  "status",
  "role",
  "phoneVerified",
  "emailVerified",
  "idVerification.verificationStatus",
  "profileCompletion",
  "averageRating",
  "lastLoginAt",
  "createdAt",
].join(" ");

const parsePositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

// GET /api/v1/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;
  const {
    search,
    status,
    role,
    phoneVerified,
    emailVerified,
    idVerification,
    profileComplete,
  } = req.query;

  const filter = {};

  // Exclude deleted accounts by default; pass status=deleted to include them.
  if (status) {
    if (!["active", "suspended", "deleted"].includes(status)) {
      throw new ErrorResponse("Invalid status filter", 400);
    }
    filter.status = status;
  } else {
    filter.status = { $ne: "deleted" };
  }

  if (role) {
    if (!["user", "admin"].includes(role))
      throw new ErrorResponse("Invalid role filter", 400);
    filter.role = role;
  } else {
    // Admin user-management list should focus on end users by default.
    filter.role = "user";
  }

  if (phoneVerified !== undefined) {
    if (!["true", "false"].includes(phoneVerified))
      throw new ErrorResponse("phoneVerified must be true or false", 400);
    filter.phoneVerified = phoneVerified === "true";
  }

  if (emailVerified !== undefined) {
    if (!["true", "false"].includes(emailVerified))
      throw new ErrorResponse("emailVerified must be true or false", 400);
    filter.emailVerified = emailVerified === "true";
  }

  if (idVerification) {
    if (
      !["not_submitted", "pending", "verified", "rejected"].includes(
        idVerification,
      )
    ) {
      throw new ErrorResponse("Invalid ID verification filter", 400);
    }
    filter["idVerification.verificationStatus"] = idVerification;
  }

  if (profileComplete !== undefined) {
    if (!["true", "false"].includes(profileComplete))
      throw new ErrorResponse("profileComplete must be true or false", 400);
    const expected = profileComplete === "true";
    if (expected) {
      filter["profileCompletion.basicInfo"] = true;
      filter["profileCompletion.questionnaire"] = true;
      filter["profileCompletion.photos"] = true;
      filter["profileCompletion.verification"] = true;
    } else {
      filter.$or = [
        { "profileCompletion.basicInfo": { $ne: true } },
        { "profileCompletion.questionnaire": { $ne: true } },
        { "profileCompletion.photos": { $ne: true } },
        { "profileCompletion.verification": { $ne: true } },
      ];
    }
  }

  if (typeof search === "string" && search.trim()) {
    const term = search.trim().slice(0, 100);
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchOr = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
      { "phone.number": { $regex: escaped, $options: "i" } },
      { "phone.countryCode": { $regex: escaped, $options: "i" } },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
      delete filter.$or;
    } else {
      filter.$or = searchOr;
    }
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(userListProjection)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);
  res.status(200).json({
    success: true,
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
});

// GET /api/v1/admin/users/metrics
const getUserMetrics = asyncHandler(async (req, res) => {
  const [statusCounts, profileCounts, verificationCounts, recentSignups] =
    await Promise.all([
      User.aggregate([
        { $match: { role: "user" } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: "user", status: { $ne: "deleted" } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            basicInfoComplete: {
              $sum: {
                $cond: [{ $eq: ["$profileCompletion.basicInfo", true] }, 1, 0],
              },
            },
            questionnaireComplete: {
              $sum: {
                $cond: [
                  { $eq: ["$profileCompletion.questionnaire", true] },
                  1,
                  0,
                ],
              },
            },
            photosComplete: {
              $sum: {
                $cond: [{ $eq: ["$profileCompletion.photos", true] }, 1, 0],
              },
            },
            verificationComplete: {
              $sum: {
                $cond: [
                  { $eq: ["$profileCompletion.verification", true] },
                  1,
                  0,
                ],
              },
            },
            fullyComplete: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$profileCompletion.basicInfo", true] },
                      { $eq: ["$profileCompletion.questionnaire", true] },
                      { $eq: ["$profileCompletion.photos", true] },
                      { $eq: ["$profileCompletion.verification", true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            phoneVerified: {
              $sum: { $cond: [{ $eq: ["$phoneVerified", true] }, 1, 0] },
            },
            emailVerified: {
              $sum: { $cond: [{ $eq: ["$emailVerified", true] }, 1, 0] },
            },
          },
        },
      ]),
      User.aggregate([
        { $match: { role: "user", status: { $ne: "deleted" } } },
        {
          $group: {
            _id: "$idVerification.verificationStatus",
            count: { $sum: 1 },
          },
        },
      ]),
      User.countDocuments({
        role: "user",
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
    ]);

  const status = { active: 0, suspended: 0, deleted: 0 };
  for (const item of statusCounts) {
    if (Object.prototype.hasOwnProperty.call(status, item._id))
      status[item._id] = item.count;
  }

  const profile = profileCounts[0] || {
    total: 0,
    basicInfoComplete: 0,
    questionnaireComplete: 0,
    photosComplete: 0,
    verificationComplete: 0,
    fullyComplete: 0,
    phoneVerified: 0,
    emailVerified: 0,
  };

  const idVerification = {
    not_submitted: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  };
  for (const item of verificationCounts) {
    if (Object.prototype.hasOwnProperty.call(idVerification, item._id))
      idVerification[item._id] = item.count;
  }

  res.status(200).json({
    success: true,
    data: {
      accounts: {
        ...status,
        total: status.active + status.suspended + status.deleted,
      },
      profileCompletion: {
        eligibleUsers: profile.total,
        basicInfo: profile.basicInfoComplete,
        questionnaire: profile.questionnaireComplete,
        photos: profile.photosComplete,
        verification: profile.verificationComplete,
        fullyComplete: profile.fullyComplete,
        fullyCompleteRate: profile.total
          ? Math.round((profile.fullyComplete / profile.total) * 100)
          : 0,
      },
      verification: {
        phoneVerified: profile.phoneVerified,
        emailVerified: profile.emailVerified,
        id: idVerification,
      },
      signupsLast30Days: recentSignups,
    },
  });
});

// GET /api/v1/admin/users/:id
const getUserById = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select(
      [
        "name",
        "phone",
        "email",
        "dateOfBirth",
        "gender",
        "orientation",
        "profilePictures",
        "occupation",
        "education",
        "freeTime",
        "interests",
        "currentLocation",
        "status",
        "role",
        "lastLoginAt",
        "lastLoginMethod",
        "phoneVerified",
        "emailVerified",
        "idVerification.documentType",
        "idVerification.verificationStatus",
        "idVerification.rejectionReason",
        "idVerification.submittedAt",
        "idVerification.verifiedAt",
        "profileCompletion",
        "averageRating",
        "createdAt",
        "updatedAt",
      ].join(" "),
    )
    .lean();

  if (!user) return next(new ErrorResponse("User not found", 404));

  res.status(200).json({ success: true, data: user });
});

// PATCH /api/v1/admin/users/:id/suspend
const suspendUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorResponse("User not found", 404));
  if (user.role === "admin")
    return next(
      new ErrorResponse(
        "Admin accounts cannot be suspended through user management",
        403,
      ),
    );
  if (user.status === "deleted")
    return next(new ErrorResponse("Deleted accounts cannot be suspended", 409));
  if (user.status === "suspended")
    return next(new ErrorResponse("User is already suspended", 409));

  user.status = "suspended";
  await user.save();

  await RefreshToken.updateMany(
    { user: user._id, isRevoked: false },
    { $set: { isRevoked: true } },
  );

  res.status(200).json({
    success: true,
    message: "User suspended and refresh sessions revoked",
    data: { id: user._id, status: user.status },
  });
});

// PATCH /api/v1/admin/users/:id/reactivate
const reactivateUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new ErrorResponse("User not found", 404));
  if (user.role === "admin")
    return next(
      new ErrorResponse(
        "Admin accounts cannot be reactivated through user management",
        403,
      ),
    );
  if (user.status === "deleted")
    return next(
      new ErrorResponse(
        "Deleted accounts cannot be reactivated through this endpoint",
        409,
      ),
    );
  if (user.status === "active")
    return next(new ErrorResponse("User is already active", 409));

  user.status = "active";
  await user.save();

  res.status(200).json({
    success: true,
    message: "User reactivated",
    data: { id: user._id, status: user.status },
  });
});

module.exports = {
  listUsers,
  getUserMetrics,
  getUserById,
  suspendUser,
  reactivateUser,
};
