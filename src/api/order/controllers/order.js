const stripe = require("stripe")(process.env.STRIPE_KEY);
const uniqueId = new Date().getTime().toString();

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async create(ctx) {
    const { courses , email} = ctx.request.body;

    // Validate input data
    if (!Array.isArray(courses) || courses.length === 0) {
      ctx.response.status = 400;
      return { error: "Invalid courses array" };
    }

    try {
      const lineItems = await Promise.all(
        courses.map(async (course) => {
          const item = await strapi
            .service("api::course.course")
            .findOne(course.id);

          if (!item) {
            throw new Error(`Course with id ${course.id} not found`);
          }

          return {
            price_data: {
              currency: "inr",
              product_data: {
                name: item.title,
              },
              unit_amount: Math.round(item.saleprice * 100),
            },
            quantity: 1,
          };
        })
      );

      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: { allowed_countries: ["IN"] },
        payment_method_types: ["card"],
        mode: "payment",
        success_url: process.env.CLIENT_URL + `/success`,
        cancel_url: process.env.CLIENT_URL + "/failed",
        line_items: lineItems,
      });

      await strapi
        .service("api::order.order")
        .create({ data: { courses, stripeId: uniqueId , email } });

      return { stripeSession: session };
    } catch (error) {
      console.log(error);
      ctx.response.status = 500;
      return { error: "An error occurred while processing the payment" };
    }
  },
}));
