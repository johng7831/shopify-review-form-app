import { useEffect, useState } from "react";
import { Card, Page, Layout, Text, Spinner, DataTable, Tabs, Button } from "@shopify/polaris";

export default function PageName() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Resolve shop dynamically from URL (embedded app)
        const urlShop = new URLSearchParams(window.location.search).get("shop");
        let shop = urlShop;
        if (!shop && window?.frameElement?.src) {
          const iframeShop = new URL(window.frameElement.src).searchParams.get("shop");
          if (iframeShop) shop = iframeShop;
        }
        const res = await fetch(`/userdata/userinfo?shop=${shop}`);
        const data = await res.json();

        if (data.success) {
          setUsers(data.data);
        } else {
          console.error("Error fetching users:", data.error);
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  function renderStars(rating) {
    const r = Number(rating) || 0;
    const filled = "★".repeat(Math.max(0, Math.min(5, r)));
    const empty = "☆".repeat(5 - Math.max(0, Math.min(5, r)));
    return `${filled}${empty}`;
  }

  // Separate product reviews vs form submissions
  const isReviewEntry = (entry) =>
    !!entry.message || !!entry.rating || !!entry.productId || !!entry.productTitle;

  const reviews = users.filter(isReviewEntry);
  const submissions = users.filter((e) => !isReviewEntry(e));

  async function handleDelete(id) {
    try {
      await fetch(`/userdata/submission/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u._id !== id));
    } catch (e) {
      console.error("Delete failed", e);
    }
  }

  // Product reviews table rows (separate columns)
  const reviewRows = reviews.map((entry) => [
    entry.email || "No email",                   // Email (moved to first position)
    entry.username || "Anonymous",                // Reviewer
    entry.productTitle || entry.productId || "-", // Product
    entry.rating ? renderStars(entry.rating) : "-", // Rating
    entry.message || "-",                        // Message
    new Date(entry.submittedAt).toLocaleString(), // Submitted
    <Button destructive onClick={() => handleDelete(entry._id)}>Delete</Button>, // Actions
  ]);

  // Contact form submissions table rows (separate columns)
  const submissionRows = submissions.map((entry) => [
    entry.username || "-",                        // Name
    entry.email || "-",                           // Email
    entry.message || "-",                         // Message
    new Date(entry.submittedAt).toLocaleString(), // Submitted
    <Button destructive onClick={() => handleDelete(entry._id)}>Delete</Button>, // Actions
  ]);

  const tabs = [
    { id: "product-reviews", content: "Product reviews" },
    { id: "form-submissions", content: "Form submissions" },
  ];

  return (
    <Page title="Form Submissions">
      <Layout>
        <Layout.Section>
          {loading ? (
            <Spinner accessibilityLabel="Loading submissions" size="large" />
          ) : users.length === 0 ? (
            <Text>No submissions found.</Text>
          ) : (
            <>
              <Tabs tabs={tabs} selected={selected} onSelect={setSelected}>
                <Card>
                  {selected === 0 ? (
                    <DataTable
                      columnContentTypes={[
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                      ]}
                      headings={[
                        "Email",
                        "Reviewer",
                        "Product",
                        "Rating",
                        "Message",
                        "Submitted",
                        "Actions",
                      ]}
                      rows={reviewRows}
                    />
                  ) : (
                    <DataTable
                      columnContentTypes={[
                        "text",
                        "text",
                        "text",
                        "text",
                        "text",
                      ]}
                      headings={[
                        "Name",
                        "Email",
                        "Message",
                        "Submitted",
                        "Actions",
                      ]}
                      rows={submissionRows}
                    />
                  )}
                </Card>
              </Tabs>
            </>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}