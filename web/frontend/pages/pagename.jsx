import { useEffect, useState } from "react";
import { Card, Page, Layout, TextContainer, Text, Spinner } from "@shopify/polaris";

export default function PageName() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        // Replace with your actual shop domain dynamically if needed
        const shop = "myapp-store-com.myshopify.com";
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

  return (
    <Page title="Form Submissions">
      <Layout>
        <Layout.Section>
          {loading ? (
            <Spinner accessibilityLabel="Loading users" size="large" />
          ) : users.length === 0 ? (
            <Text>No submissions found.</Text>
          ) : (
            users.map((user) => (
              <Card key={user._id} sectioned>
                <TextContainer>
                  <Text variant="headingMd">{user.username}</Text>
                  <Text>Email: {user.email}</Text>
                  <Text>
                    Submitted: {new Date(user.submittedAt).toLocaleString()}
                  </Text>
                </TextContainer>
              </Card>
            ))
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
