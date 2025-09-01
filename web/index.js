// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import { connectDB, FormSubmission } from "./database.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
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

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());





// Allow app proxy requests without authentication
app.use("/userdata/*", (req, res, next) => {
  // For app proxy requests, skip authentication
  next();
});



async function authenticateUser(req, res, next) {
  try {
    let shop = req.query.shop;
    
    if (!shop) {
      return res.status(400).json({ error: "Shop parameter is required" });
    }
    
    // For app proxy requests, we'll allow them to pass through
    // since they're coming from the Shopify store frontend
    if (req.path.startsWith('/userdata/')) {
      return next();
    }
    
    // For other requests, check if the shop has a valid session
    let storeName = await shopify.config.sessionStorage.findSessionsByShop(shop);

    if (storeName && storeName.length > 0 && shop === storeName[0].shop) {
      next();
    } else {
      res.status(401).send("User Not Authorized");
    }
  } catch (error) {
    console.error('Authentication error:', error);
    // For app proxy requests, allow them to pass through even if there's an error
    if (req.path.startsWith('/userdata/')) {
      return next();
    }
    res.status(500).send("Authentication error");
  }
}


app.use(express.json());

// Connect to MongoDB
connectDB();

// App proxy endpoint for form submissions
app.post("/userdata/submit-form", async (req, res) => {
  try {
    const { username, email } = req.body;
    const shop = req.query.shop;

    if (!username || !email || !shop) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: username, email, or shop" 
      });
    }

    // Create new form submission
    const formSubmission = new FormSubmission({
      username,
      email,
      shop
    });

    await formSubmission.save();

    res.status(200).json({ 
      success: true, 
      message: "Form submitted successfully",
      data: formSubmission
    });
  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
});

// App proxy endpoint to get form submissions
app.get("/userdata/userinfo", async (req, res) => {
  try {
    const shop = req.query.shop;
    
    if (!shop) {
      return res.status(400).json({ 
        success: false, 
        error: "Shop parameter is required" 
      });
    }

    // Get form submissions for this shop
    const submissions = await FormSubmission.find({ shop }).sort({ submittedAt: -1 });
    
    res.status(200).json({ 
      success: true, 
      data: submissions,
      count: submissions.length
    });
  } catch (error) {
    console.error('Error fetching form submissions:', error);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
});

// Admin page to view form submissions
app.get("/userdata/admin", async (req, res) => {
  try {
    const shop = req.query.shop;
    
    if (!shop) {
      return res.status(400).send("Shop parameter is required");
    }

    // Get form submissions for this shop
    const submissions = await FormSubmission.find({ shop }).sort({ submittedAt: -1 });
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Form Submissions - ${shop}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .submission { background: white; border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px; }
          .submission h3 { margin: 0 0 10px 0; color: #333; }
          .submission p { margin: 5px 0; color: #666; }
          .count { font-size: 1.2em; font-weight: bold; color: #007aff; }
          .no-data { text-align: center; color: #666; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Form Submissions</h1>
          <p><strong>Shop:</strong> ${shop}</p>
          <p class="count">Total Submissions: ${submissions.length}</p>
        </div>
        
        ${submissions.length === 0 ? 
          '<div class="no-data">No form submissions yet.</div>' : 
          submissions.map(sub => `
            <div class="submission">
              <h3>${sub.username}</h3>
              <p><strong>Email:</strong> ${sub.email}</p>
              <p><strong>Submitted:</strong> ${new Date(sub.submittedAt).toLocaleString()}</p>
            </div>
          `).join('')
        }
      </body>
      </html>
    `;
    
    res.status(200).send(html);
  } catch (error) {
    console.error('Error loading admin page:', error);
    res.status(500).send("Internal server error");
  }
});


















app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

app.listen(PORT);
