const Event = require("../models/Event");
const EventRegistration = require("../models/EventRegistration");
const PrelaunchWaitlist = require("../models/PrelaunchWaitlist");

const MY_EVENTS_TABS = ["WAITLISTED", "CONFIRMED", "CANCELLED", "PAST"];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

/**
 * Get the authenticated user's profile summary.
 *
 * Includes:
 * - Number of events attended/confirmed
 * - Number of connections
 * - Upcoming confirmed events
 */
const getProfileSummary = async (userId) => {
  const now = new Date();

  const [eventsAttended, upcomingEvents] = await Promise.all([
    EventRegistration.countDocuments({
      user: userId,
      status: "CONFIRMED",
    }),

    EventRegistration.find({
      user: userId,
      status: "CONFIRMED",
    })
      .populate({
        path: "event",
        select: [
          "title",
          "slug",
          "city",
          "area",
          "tagline",
          "venue_name",
          "cover_image",
          "event_type",
          "category_type",
          "status",
          "event_start_at",
          "event_end_at",
        ].join(" "),
        match: {
          is_deleted: false,
          event_start_at: { $gt: now },
        },
        populate: {
          path: "city",
          select: "name",
        },
      })
      .sort({ "event.event_start_at": 1 })
      .lean(),
  ]);

  const prelaunchWaitlistedEvents = await PrelaunchWaitlist.find({
    user: userId,
  })
    .populate({
      path: "event",
      select: [
        "title",
        "slug",
        "city",
        "area",
        "tagline",
        "venue_name",
        "cover_image",
        "event_type",
        "category_type",
        "status",
        "event_start_at",
        "event_end_at",
      ].join(" "),
      match: {
        is_deleted: false,
        event_start_at: { $gt: now },
      },
      populate: {
        path: "city",
        select: "name",
      },
    })
    .sort({ "event.event_start_at": 1 })
    .lean();

  const events = upcomingEvents
    .filter((registration) => registration.event)
    .map((registration) => ({
      registrationId: registration._id,
      status: registration.status,
      event: registration.event,
    }));

  return {
    stats: {
      eventsAttended,
      connections: 0,
    },
    upcomingEvents: [...events, ...prelaunchWaitlistedEvents],
  };
};

/**
 * Get the authenticated user's registered events.
 *
 * Tabs:
 * - WAITLISTED: upcoming waitlisted events
 * - CONFIRMED: upcoming confirmed events
 * - CANCELLED: upcoming cancelled events
 * - PAST: all past registered events
 */
// const getMyEvents = async (
//   userId,
//   { tab = "CONFIRMED", page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {},
// ) => {
//   if (!MY_EVENTS_TABS.includes(tab)) {
//     throw new Error(`Invalid my events tab: ${tab}`);
//   }

//   const parsedPage = Math.max(Number(page) || DEFAULT_PAGE, 1);
//   const parsedLimit = Math.min(
//     Math.max(Number(limit) || DEFAULT_LIMIT, 1),
//     MAX_LIMIT,
//   );

//   const skip = (parsedPage - 1) * parsedLimit;
//   const now = new Date();

//   const registrationMatch = {
//     user: userId,
//   };

//   /*
//    * Past is intentionally status-independent.
//    * The frontend's Past tab represents all events whose
//    * event date has already passed.
//    */
//   if (tab === "PAST") {
//     // No registration status filter.
//   } else {
//     registrationMatch.status = tab;
//   }

//   const eventDateMatch =
//     tab === "PAST"
//       ? {
//           "event.event_start_at": { $lt: now },
//         }
//       : {
//           "event.event_start_at": { $gte: now },
//         };

//   const pipeline = [
//     {
//       $match: registrationMatch,
//     },

//     {
//       $lookup: {
//         from: Event.collection.name,
//         localField: "event",
//         foreignField: "_id",
//         as: "event",
//       },
//     },

//     {
//       $unwind: "$event",
//     },

//     {
//       $match: {
//         "event.is_deleted": false,
//         ...eventDateMatch,
//       },
//     },

//     {
//       $sort:
//         tab === "PAST"
//           ? { "event.event_start_at": -1 }
//           : { "event.event_start_at": 1 },
//     },

//     {
//       $facet: {
//         data: [
//           { $skip: skip },
//           { $limit: parsedLimit },

//           {
//             $project: {
//               _id: 0,

//               registrationId: "$_id",
//               status: 1,
//               entry_type: 1,
//               flow_type: 1,
//               payment_status: 1,
//               booking_confirmed_at: 1,

//               event: {
//                 _id: "$event._id",
//                 title: "$event.title",
//                 slug: "$event.slug",
//                 city: "$event.city",
//                 area: "$event.area",
//                 tagline: "$event.tagline",
//                 venue_name: "$event.venue_name",
//                 cover_image: "$event.cover_image",
//                 event_type: "$event.event_type",
//                 category_type: "$event.category_type",
//                 status: "$event.status",
//                 event_start_at: "$event.event_start_at",
//                 event_end_at: "$event.event_end_at",
//               },
//             },
//           },
//         ],

//         total: [
//           {
//             $count: "count",
//           },
//         ],
//       },
//     },
//   ];

//   const [result] = await EventRegistration.aggregate(pipeline);

//   const events = result?.data || [];
//   const total = result?.total?.[0]?.count || 0;

//   return {
//     events,
//     pagination: {
//       page: parsedPage,
//       limit: parsedLimit,
//       total,
//       totalPages: Math.ceil(total / parsedLimit),
//       hasNextPage: parsedPage < Math.ceil(total / parsedLimit),
//       hasPreviousPage: parsedPage > 1,
//     },
//   };
// };

const getMyEvents = async (
  userId,
  { tab = "CONFIRMED", page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {},
) => {
  if (!MY_EVENTS_TABS.includes(tab)) {
    throw new Error(`Invalid my events tab: ${tab}`);
  }

  const parsedPage = Math.max(Number(page) || DEFAULT_PAGE, 1);

  const parsedLimit = Math.min(
    Math.max(Number(limit) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const skip = (parsedPage - 1) * parsedLimit;

  const now = new Date();

  /*
   * WAITLISTED
   *
   * Waitlisted events can come from either:
   * - EventRegistration
   * - PrelaunchWaitlist
   *
   * Merge both sources before pagination.
   */
  if (tab === "WAITLISTED") {
    const [registrations, prelaunchWaitlists] = await Promise.all([
      EventRegistration.find({
        user: userId,
        status: "WAITLISTED",
      })
        .populate({
          path: "event",
          select: [
            "title",
            "slug",
            "city",
            "area",
            "tagline",
            "venue_name",
            "cover_image",
            "event_type",
            "category_type",
            "status",
            "event_start_at",
            "event_end_at",
            "is_deleted",
          ].join(" "),
          match: {
            is_deleted: false,
            event_start_at: { $gte: now },
          },
          populate: {
            path: "city",
            select: "name",
          },
        })
        .lean(),

      PrelaunchWaitlist.find({
        user: userId,
      })
        .populate({
          path: "event",
          select: [
            "title",
            "slug",
            "city",
            "area",
            "tagline",
            "venue_name",
            "cover_image",
            "event_type",
            "category_type",
            "status",
            "event_start_at",
            "event_end_at",
            "is_deleted",
          ].join(" "),
          match: {
            is_deleted: false,
            event_start_at: { $gte: now },
          },
          populate: {
            path: "city",
            select: "name",
          },
        })
        .lean(),
    ]);

    const events = [
      ...registrations
        .filter((registration) => registration.event)
        .map((registration) => ({
          registrationId: registration._id,
          status: registration.status,
          entry_type: registration.entry_type,
          flow_type: registration.flow_type,
          payment_status: registration.payment_status,
          booking_confirmed_at: registration.booking_confirmed_at,
          event: registration.event,
        })),

      ...prelaunchWaitlists
        .filter((waitlist) => waitlist.event)
        .map((waitlist) => ({
          registrationId: waitlist._id,
          status: "WAITLISTED",
          entry_type: null,
          flow_type: "PRELAUNCH",
          payment_status: null,
          booking_confirmed_at: null,
          event: waitlist.event,
        })),
    ];

    // Upcoming events first
    events.sort(
      (a, b) =>
        new Date(a.event.event_start_at) - new Date(b.event.event_start_at),
    );

    const total = events.length;

    const paginatedEvents = events.slice(skip, skip + parsedLimit);

    const totalPages = Math.ceil(total / parsedLimit);

    return {
      events: paginatedEvents,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPreviousPage: parsedPage > 1,
      },
    };
  }

  const registrationMatch = {
    user: userId,
    status: tab,
  };

  /*
   * Past is intentionally status-independent.
   */
  if (tab === "PAST") {
    delete registrationMatch.status;
  }

  const eventDateMatch =
    tab === "PAST"
      ? {
          "event.event_start_at": { $lt: now },
        }
      : {
          "event.event_start_at": { $gte: now },
        };

  const pipeline = [
    {
      $match: registrationMatch,
    },

    {
      $lookup: {
        from: Event.collection.name,
        localField: "event",
        foreignField: "_id",
        as: "event",
      },
    },

    {
      $unwind: "$event",
    },

    {
      $match: {
        "event.is_deleted": false,
        ...eventDateMatch,
      },
    },

    {
      $sort:
        tab === "PAST"
          ? { "event.event_start_at": -1 }
          : { "event.event_start_at": 1 },
    },

    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: parsedLimit },

          {
            $project: {
              _id: 0,

              registrationId: "$_id",
              status: 1,
              entry_type: 1,
              flow_type: 1,
              payment_status: 1,
              booking_confirmed_at: 1,

              event: {
                _id: "$event._id",
                title: "$event.title",
                slug: "$event.slug",
                city: "$event.city",
                area: "$event.area",
                tagline: "$event.tagline",
                venue_name: "$event.venue_name",
                cover_image: "$event.cover_image",
                event_type: "$event.event_type",
                category_type: "$event.category_type",
                status: "$event.status",
                event_start_at: "$event.event_start_at",
                event_end_at: "$event.event_end_at",
              },
            },
          },
        ],

        total: [
          {
            $count: "count",
          },
        ],
      },
    },
  ];

  const [result] = await EventRegistration.aggregate(pipeline);

  const events = result?.data || [];
  const total = result?.total?.[0]?.count || 0;
  const totalPages = Math.ceil(total / parsedLimit);

  return {
    events,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPreviousPage: parsedPage > 1,
    },
  };
};

module.exports = {
  getProfileSummary,
  getMyEvents,
};
