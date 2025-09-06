// @ts-check
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { readFileSync } from "fs";
import { join } from "path";
import serveStatic from "serve-static";
import mongoose from "mongoose";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { connectDB, FormSubmission } from "./database.js";

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);

// --------------------
// Ensure uploads folder exists
// --------------------
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --------------------
// Multer setup for image uploads
// --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

const app = express();

// --------------------
// Shopify auth & webhooks
// --------------------
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

// --------------------
// Middleware
// --------------------
app.use("/api/*", shopify.validateAuthenticatedSession());
app.use(express.json());
app.use("/userdata/*", (req, res, next) => next());

// Serve uploaded images
app.use("/uploads", express.static(uploadsDir));

// --------------------
// MongoDB connection
// --------------------
connectDB();

// --------------------
// Submit review/form with optional image
// --------------------
app.post("/userdata/submit-form", upload.single("image"), async (req, res) => {
  try {
    const { username, email, message, rating, productId, productTitle } = req.body;
    const shop = req.query.shop;

    if (!shop) return res.status(400).json({ success: false, error: "Missing shop parameter" });
    if (!username || !message || !rating || !productId)
      return res.status(400).json({ success: false, error: "Missing required fields" });

    // Build absolute URL for image
    let imageUrl = null;
    if (req.file) {
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    }

    const formSubmission = new FormSubmission({
      username,
      email: email || null,
      message,
      rating,
      productId,
      productTitle,
      shop,
      imageUrl,
    });

    await formSubmission.save();

    res.status(200).json({
      success: true,
      message: "Review submitted successfully",
      data: formSubmission,
    });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ success: false, error: "Internal server error", details: error.message });
  }
});

// --------------------
// Get all reviews for a shop
// --------------------
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

// --------------------
// Get average rating per product
// --------------------
app.get("/userdata/average-rating", async (req, res) => {
  try {
    const { shop, productId } = req.query;
    if (!shop || !productId)
      return res.status(400).json({ success: false, error: "Missing shop or productId" });

    const reviews = await FormSubmission.find({ shop, productId, rating: { $exists: true } });
    if (reviews.length === 0)
      return res.status(200).json({ success: true, average: null, count: 0 });

    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const avg = sum / reviews.length;

    res
      .status(200)
      .json({ success: true, average: parseFloat(avg.toFixed(1)), count: reviews.length });
  } catch (error) {
    console.error("Average rating error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// --------------------
// Delete review by ID
// --------------------
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

// --------------------
// Admin HTML page with images
// --------------------
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
          .review img { margin-top: 10px; border-radius: 4px; max-width: 200px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Product Reviews</h1>
          <p><strong>Shop:</strong> ${shop}</p>
          <p>Total Reviews: ${submissions.length}</p>
        </div>
        ${submissions
          .map(
            (sub) => `
          <div class="review">
            <h3>${sub.productTitle || "General"} - ${sub.rating || "N/A"} ★</h3>
            <p><strong>Name:</strong> ${sub.username || "Anonymous"}</p>
            ${sub.email ? `<p><strong>Email:</strong> ${sub.email}</p>` : ""}
            <p><strong>Message:</strong> ${sub.message || "-"}</p>
            ${
              sub.imageUrl
                ? `<p><strong>Image:</strong><br><img src="${sub.imageUrl}" /></p>`
                : ""
            }
            <p><em>${new Date(sub.submittedAt).toLocaleString()}</em></p>
          </div>
        `
          )
          .join("")}
      </body>
      </html>
    `;

    res.status(200).send(html);
  } catch (error) {
    console.error("Admin error:", error);
    res.status(500).send("Internal server error");
  }
});

// --------------------
// Default Shopify routes
// --------------------
app.use(shopify.cspHeaders());
app.use(serveStatic(path.join(process.cwd(), "frontend"), { index: false }));
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(process.cwd(), "frontend", "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
