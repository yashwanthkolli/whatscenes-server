const asyncHandler = require("../utils/asyncHandler");
const service = require("../services/adminPrelaunchWaitlist.service");

exports.listPrelaunchWaitlist = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, ...(await service.listPrelaunchWaitlist(req.query)) });
});
exports.getPrelaunchWaitlistMetrics = asyncHandler(async (_req, res) => {
  res.status(200).json({ success: true, data: await service.getPrelaunchWaitlistMetrics() });
});
exports.getPrelaunchWaitlistEntry = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: await service.getPrelaunchWaitlistEntry(req.params.id) });
});
