import { useEffect, useState } from "react";
import { Card, Page, Layout, TextContainer, Text, Spinner } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";

export default function PageName() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Get shop from window or query
        const shop = window.Shopify?.shop || window.location.hostname;

        const res = await fetch(`/userdata/userinfo?shop=${encodeURIComponent(shop)}`);
        const data = await res.json();

        if (data.success) {
          setSubmissions(data.data);
        } else {
          setError(data.error || "Failed to load submissions");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <Page>
      <TitleBar title="Form Submissions" />
      <Layout>
        <Layout.Section>
          {loading && <Spinner accessibilityLabel="Loading" size="large" />}
          {error && <Text tone="critical">{error}</Text>}

          {!loading && !error && submissions.length === 0 && (
            <Text>No submissions yet.</Text>
          )}

          {!loading && submissions.length > 0 && (
            <div style={{ display: "grid", gap: "16px" }}>
              {submissions.map((sub, index) => (
                <Card key={index} sectioned>
                  <TextContainer>
                    <Text variant="headingMd">{sub.username}</Text>
                    <Text>Email: {sub.email}</Text>
                    <Text subdued>
                      Submitted: {new Date(sub.submittedAt).toLocaleString()}
                    </Text>
                  </TextContainer>
                </Card>
              ))}
            </div>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
