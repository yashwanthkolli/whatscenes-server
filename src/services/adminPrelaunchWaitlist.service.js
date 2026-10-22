const mongoose = require("mongoose");
const PrelaunchWaitlist = require("../models/PrelaunchWaitlist");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");

const positiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function listPrelaunchWaitlist(query = {}) {
  const page = positiveInt(query.page, 1);
  const limit = positiveInt(query.limit, 20, 100);
  const filter = {};
  if (query.eventId) {
    if (!mongoose.isValidObjectId(query.eventId)) throw new ErrorResponse("Invalid eventId", 400);
    filter.event = query.eventId;
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const term = escapeRegex(query.search.trim().slice(0, 100));
    const users = await User.find({ $or: [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { "phone.number": { $regex: term, $options: "i" } },
      { "phone.countryCode": { $regex: term, $options: "i" } },
    ] }).select("_id").lean();
    filter.user = { $in: users.map(u => u._id) };
  }
  const skip = (page - 1) * limit;
  const [entries, total] = await Promise.all([
    PrelaunchWaitlist.find(filter)
      .populate({ path: "user", select: "name email phone status role phoneVerified emailVerified createdAt" })
      .populate({ path: "event", select: "name title status startDate date createdAt" })
      .sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    PrelaunchWaitlist.countDocuments(filter),
  ]);
  const totalPages = Math.ceil(total / limit);
  return { data: entries, pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
}

async function getPrelaunchWaitlistMetrics() {
  const [totalEntries, userIds, eventIds, signupsLast30Days, topEvents] = await Promise.all([
    PrelaunchWaitlist.countDocuments(),
    PrelaunchWaitlist.distinct("user"),
    PrelaunchWaitlist.distinct("event"),
    PrelaunchWaitlist.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    PrelaunchWaitlist.aggregate([
      { $group: { _id: "$event", count: { $sum: 1 }, latestSignupAt: { $max: "$createdAt" } } },
      { $sort: { count: -1, latestSignupAt: -1 } }, { $limit: 10 },
      { $lookup: { from: "events", localField: "_id", foreignField: "_id", as: "event" } },
      { $unwind: { path: "$event", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, eventId: "$_id", eventName: { $ifNull: ["$event.name", "$event.title"] }, count: 1, latestSignupAt: 1 } },
    ]),
  ]);
  return { totalEntries, uniqueUsers: userIds.length, uniqueEvents: eventIds.length, signupsLast30Days, topEvents };
}

async function getPrelaunchWaitlistEntry(id) {
  if (!mongoose.isValidObjectId(id)) throw new ErrorResponse("Invalid waitlist entry ID", 400);
  const entry = await PrelaunchWaitlist.findById(id)
    .populate({ path: "user", select: "name email phone status role phoneVerified emailVerified profileCompletion createdAt lastLoginAt" })
    .populate({ path: "event", select: "name title status startDate date createdAt" }).lean();
  if (!entry) throw new ErrorResponse("Prelaunch waitlist entry not found", 404);
  return entry;
}
module.exports = { listPrelaunchWaitlist, getPrelaunchWaitlistMetrics, getPrelaunchWaitlistEntry };
