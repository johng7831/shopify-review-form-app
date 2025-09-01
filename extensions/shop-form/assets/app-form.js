let useform = document.querySelector("#app-form");

useform.addEventListener("submit", async function (e) {
  e.preventDefault();
  
  console.log("Form submitted - starting submission process");
  
  const formData = new FormData(useform);
  const username = formData.get('username');
  const email = formData.get('email');
  
  console.log("Form data:", { username, email });
  
  // Get the current shop domain
  const shop = window.Shopify?.shop || window.location.hostname;
  console.log("Shop domain:", shop);
  
  try {
    // Show loading state
    const submitBtn = useform.querySelector('input[type="submit"]');
    const originalText = submitBtn.value;
    submitBtn.value = 'Submitting...';
    submitBtn.disabled = true;
    
    // Use the app proxy URL
    const submitUrl = '/apps/proxy/userdata/submit-form?shop=' + encodeURIComponent(shop);
    console.log("Submitting to URL:", submitUrl);
    
    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: username,
        email: email
      })
    });
    
    console.log("Response status:", response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("Response data:", result);
    
    if (result.success) {
      // Show success message
      showMessage('Form submitted successfully!', 'success');
      useform.reset();
      console.log("Form submitted successfully to database");
    } else {
      // Show error message
      showMessage('Error submitting form: ' + result.error, 'error');
      console.error("Server returned error:", result.error);
    }
  } catch (error) {
    console.error('Form submission error:', error);
    showMessage('Error submitting form. Please try again.', 'error');
  } finally {
    // Reset button state
    const submitBtn = useform.querySelector('input[type="submit"]');
    submitBtn.value = originalText;
    submitBtn.disabled = false;
  }
});

// Function to show messages to user
function showMessage(message, type) {
  // Remove existing messages
  const existingMessage = document.querySelector('.form-message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Create new message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `form-message form-message-${type}`;
  messageDiv.textContent = message;
  
  // Insert after form
  useform.parentNode.insertBefore(messageDiv, useform.nextSibling);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}
