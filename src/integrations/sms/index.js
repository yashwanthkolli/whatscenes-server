const smsConfig = require("../../config/sms");

const mockProvider = require("./mock");
const gonumsProvider = require("./gonums");

const providers = {
  mock: mockProvider,
  gonums: gonumsProvider,
};

const getProvider = () => {
  const provider = providers[smsConfig.provider];

  if (!provider) {
    throw new Error(`Unsupported SMS provider: ${smsConfig.provider}`);
  }

  return provider;
};

const sendOtp = async (params) => {
  const provider = getProvider();

  return provider.sendOtp(params);
};

module.exports = {
  sendOtp,
};
