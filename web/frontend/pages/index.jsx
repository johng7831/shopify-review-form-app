import { useState, useEffect } from "react";
import { Page, Card, Select, Button } from "@shopify/polaris";

export default function ThemeSelector() {
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState("");

  useEffect(() => {
    // Fetch themes from your backend (your backend should call Shopify Admin API)
    fetch("/api/themes")
      .then((res) => res.json())
      .then((data) => {
        setThemes(
          data.map((theme) => ({
            label: `${theme.name} (${theme.role})`,
            value: theme.id,
          }))
        );
      });
  }, []);

  const handleRedirect = () => {
    const myshopifyDomain = "your-store.myshopify.com";
    const template = "product"; // Or whichever template you want
    const apiKey = "YOUR_API_KEY";
    const handle = "YOUR_BLOCK_HANDLE";

    const appBlockUrl = `https://${myshopifyDomain}/admin/themes/${selectedTheme}/editor?template=${template}&addAppBlockId=${apiKey}/${handle}&target=newAppsSection`;
    window.open(appBlockUrl, "_blank");
  };

  return (
    <Page title="Select a Theme">
      <Card sectioned>
        <Select
          label="Choose a theme"
          options={themes}
          value={selectedTheme}
          onChange={setSelectedTheme}
        />
        <Button primary onClick={handleRedirect} disabled={!selectedTheme}>
          Go to App Embed Block
        </Button>
      </Card>
    </Page>
  );
}
