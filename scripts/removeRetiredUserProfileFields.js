require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../src/models/User");

async function removeRetiredUserProfileFields() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const result = await User.collection.updateMany(
    {
      $or: [
        { hometown: { $exists: true } },
        { hobbies: { $exists: true } },
      ],
    },
    {
      $unset: {
        hometown: "",
        hobbies: "",
      },
    },
  );

  console.log(`Updated ${result.modifiedCount} user records.`);
  await mongoose.disconnect();
}

removeRetiredUserProfileFields().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
