const axios = require("axios");

const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

async function getLocationFromIP(ip) {
  try {
    const response = await axios.get(
      `https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`,
    );

    const { loc } = response.data;

    if (!loc) return null;

    const [lat, lng] = loc.split(",").map(Number);

    return { lat, lng };
  } catch (error) {
    console.error("IP location error:", error.message);
    return null;
  }
}

module.exports = {
  getLocationFromIP,
};
