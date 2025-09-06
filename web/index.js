// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { connectDB, FormSubmission } from "./database.js";
import mongoose from "mongoose";

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Shopify auth & webhook setup
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// Middleware
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use(express.json());

// Allow app proxy requests (no auth required)
app.use("/userdata/*", (req, res, next) => next());

// Connect MongoDB
connectDB();

/* --------------------------
   Review API Endpoints
--------------------------- */

// Submit form (handles both simple registrations and reviews)
app.post("/userdata/submit-form", async (req, res) => {
  try {
    console.log("Form submission received:", req.body);
    console.log("Shop parameter:", req.query.shop);
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error("Database not connected. State:", mongoose.connection.readyState);
      return res.status(500).json({ 
        success: false, 
        error: "Database connection error" 
      });
    }
    
    const { username, email, message, rating, productId, productTitle } = req.body;
    const shop = req.query.shop;

    if (!shop) {
      console.log("Missing shop parameter");
      return res.status(400).json({ success: false, error: "Missing shop parameter" });
    }

    // Check if this is a simple form submission (just name and email)
    const isSimpleForm = !message && !rating && !productId;
    
    if (isSimpleForm) {
      // Simple form submission - only require username and email
      if (!username || !email) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: username and email"
        });
      }
    } else {
      // Review submission - require all review fields
      if (!username || !message || !rating || !productId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: username, message, rating, productId"
        });
      }
    }

    // Prepare form data
    const formData = {
      username,
      email: email || null,
      shop,
    };

    // Add review fields only if they exist (for review submissions)
    if (message) formData.message = message;
    if (rating) formData.rating = rating;
    if (productId) formData.productId = productId;
    if (productTitle) formData.productTitle = productTitle;

    const formSubmission = new FormSubmission(formData);

    await formSubmission.save();
    
    const successMessage = isSimpleForm ? "Registration submitted successfully" : "Review submitted successfully";
    console.log("Form saved successfully:", formSubmission);
    res.status(200).json({ success: true, message: successMessage, data: formSubmission });
  } catch (error) {
    console.error("Submit error:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      success: false, 
      error: "Internal server error",
      details: error.message 
    });
  }
});

// Get all reviews for shop
app.get("/userdata/userinfo", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ success: false, error: "Missing shop parameter" });

    const submissions = await FormSubmission.find({ shop }).sort({ submittedAt: -1 });
    res.status(200).json({ success: true, data: submissions, count: submissions.length });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get average rating per product
app.get("/userdata/average-rating", async (req, res) => {
  try {
    const { shop, productId } = req.query;
    if (!shop || !productId) {
      return res.status(400).json({ success: false, error: "Missing shop or productId" });
    }

    const reviews = await FormSubmission.find({ shop, productId, rating: { $exists: true } });

    if (reviews.length === 0) {
      return res.status(200).json({ success: true, average: null, count: 0 });
    }

    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const avg = sum / reviews.length;

    res.status(200).json({
      success: true,
      average: parseFloat(avg.toFixed(1)),
      count: reviews.length,
    });
  } catch (error) {
    console.error("Average rating error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Delete review by id
app.delete("/userdata/submission/:id", async (req, res) => {
  try {
    const deleted = await FormSubmission.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: "Review not found" });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Admin HTML page (basic view without Polaris)
app.get("/userdata/admin", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).send("Shop parameter required");

    const submissions = await FormSubmission.find({ shop }).sort({ submittedAt: -1 });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reviews - ${shop}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .header { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .review { background: #fff; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
          .review h3 { margin: 0 0 5px 0; }
          .review p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Product Reviews</h1>
          <p><strong>Shop:</strong> ${shop}</p>
          <p>Total Reviews: ${submissions.length}</p>
        </div>
        ${submissions.map(sub => `
          <div class="review">
            <h3>${sub.email || "No email"} - ${sub.productTitle} - ${sub.rating} ★</h3>
            <p><strong>Name:</strong> ${sub.username || "Anonymous"}</p>
            <p><strong>Message:</strong> ${sub.message}</p>
            <p><em>${new Date(sub.submittedAt).toLocaleString()}</em></p>
          </div>
        `).join("")}
      </body>
      </html>
    `;

    res.status(200).send(html);
  } catch (error) {
    console.error("Admin error:", error);
    res.status(500).send("Internal server error");
  }
});

/* --------------------------
   Default Shopify routes
--------------------------- */
app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`query { productsCount { count } }`);
  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  try {
    await productCreator(res.locals.shopify.session);
    res.status(200).send({ success: true });
  } catch (e) {
    console.log("Error creating product:", e.message);
    res.status(500).send({ success: false, error: e.message });
  }
});

// Serve frontend
app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));