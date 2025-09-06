// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import multer from "multer";
import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { connectDB, FormSubmission } from "./database.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || "3000", 10);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const UPLOAD_DIR = path.join(__dirname, "uploads");

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
app.use(express.urlencoded({ extended: true }));

// Allow app proxy requests (no auth required)
app.use("/userdata/*", (req, res, next) => next());



/* --------------------------
   Multer Image Upload Setup
--------------------------- */
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Connect MongoDB
connectDB();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* --------------------------
   Form Submission Endpoint
--------------------------- */
app.post("/userdata/submit-form", upload.single("image"), async (req, res) => {
  try {
    const { username, email, message, rating, productId, productTitle } = req.body;
    const shop = req.query.shop;

    if (!shop) return res.status(400).json({ success: false, error: "Missing shop parameter" });

    const isSimpleForm = !message && !rating && !productId;

    // Validate required fields
    if (isSimpleForm && (!username || !email)) {
      return res.status(400).json({ success: false, error: "Missing required fields: username and email" });
    }
    if (!isSimpleForm && (!username || !message || !rating || !productId)) {
      return res.status(400).json({ success: false, error: "Missing required review fields" });
    }

    const formData = {
      username,
      email: email || null,
      shop,
      message: message || null,
      rating: rating ? parseInt(rating, 10) : null,
      productId: productId || null,
      productTitle: productTitle || null,
      image: req.file ? `/uploads/${req.file.filename}` : null,
    };

    console.log("Form submission data:", formData);
    if (req.file) {
      console.log("File uploaded:", req.file.filename, "Path:", `/uploads/${req.file.filename}`);
    }

    const formSubmission = new FormSubmission(formData);
    await formSubmission.save();

    const successMessage = isSimpleForm ? "Registration submitted successfully" : "Review submitted successfully";
    res.status(200).json({ success: true, message: successMessage, data: formSubmission });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ success: false, error: "Internal server error", details: error.message });
  }
});

// Serve uploaded files with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* --------------------------
   Get Reviews
--------------------------- */
app.get("/userdata/userinfo", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ success: false, error: "Missing shop parameter" });

    const submissions = await FormSubmission.find({ shop }).sort({ submittedAt: -1 });
    console.log("Fetched submissions for shop:", shop, "Count:", submissions.length);
    submissions.forEach((sub, index) => {
      if (sub.image) {
        console.log(`Submission ${index + 1} image path:`, sub.image);
      }
    });
    res.status(200).json({ success: true, data: submissions, count: submissions.length });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Average rating
app.get("/userdata/average-rating", async (req, res) => {
  try {
    const { shop, productId } = req.query;
    if (!shop || !productId) return res.status(400).json({ success: false, error: "Missing shop or productId" });

    const reviews = await FormSubmission.find({ shop, productId, rating: { $exists: true } });
    if (reviews.length === 0) return res.status(200).json({ success: true, average: null, count: 0 });

    const avg = reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length;
    res.status(200).json({ success: true, average: parseFloat(avg.toFixed(1)), count: reviews.length });
  } catch (error) {
    console.error("Average rating error:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Delete review
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

// Test image serving endpoint
app.get("/userdata/test-image/:filename", (req, res) => {
  const filename = req.params.filename;
  const imagePath = join(UPLOAD_DIR, filename);
  
  console.log("Testing image serving for:", filename);
  console.log("Full path:", imagePath);
  console.log("File exists:", fs.existsSync(imagePath));
  
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ error: "Image not found", path: imagePath });
  }
});


/* --------------------------
   Shopify default routes
--------------------------- */
app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({ session: res.locals.shopify.session });
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

/* --------------------------
   Serve Frontend
--------------------------- */
app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")).toString()
      .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || ""));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
