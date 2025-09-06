document.addEventListener("DOMContentLoaded", function () {
  // Add image preview functionality
  document.querySelectorAll("input[name='image']").forEach(input => {
    input.addEventListener("change", function(e) {
      const file = e.target.files[0];
      const blockId = e.target.id.split('-').pop();
      const previewDiv = document.getElementById(`image-preview-${blockId}`);
      const previewImg = document.getElementById(`preview-img-${blockId}`);
      
      if (file && previewDiv && previewImg) {
        const reader = new FileReader();
        reader.onload = function(e) {
          previewImg.src = e.target.result;
          previewDiv.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else if (previewDiv) {
        previewDiv.style.display = 'none';
      }
    });
  });

  document.querySelectorAll(".app-review-form").forEach(form => {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Remove previous messages
      const existingMsg = form.querySelector(".app-form-message, .app-form-error");
      if (existingMsg) existingMsg.remove();

      // Collect values
      const name = form.querySelector("input[name='name']")?.value.trim();
      if (!name) {
        const err = document.createElement("div");
        err.className = "app-form-error";
        err.innerText = "Please enter your name.";
        form.appendChild(err);
        return;
      }

      const email = form.querySelector("input[name='email']")?.value.trim();
      if (!email) {
        const err = document.createElement("div");
        err.className = "app-form-error";
        err.innerText = "Please enter your email.";
        form.appendChild(err);
        return;
      }

      const message = form.querySelector("textarea[name='message']").value.trim();
      if (!message) {
        const err = document.createElement("div");
        err.className = "app-form-error";
        err.innerText = "Please enter a review message.";
        form.appendChild(err);
        return;
      }

      const ratingInput = form.querySelector("input[name='rating']:checked");
      const rating = ratingInput ? parseInt(ratingInput.value, 10) : null;
      if (!rating) {
        const err = document.createElement("div");
        err.className = "app-form-error";
        err.innerText = "Please select a star rating.";
        form.appendChild(err);
        return;
      }

      const productTitle = form.dataset.productTitle || "";
      const productId = form.dataset.productId || "";
      const imageFile = form.querySelector("input[name='image']")?.files[0];

      // Create FormData to handle file uploads
      const formData = new FormData();
      formData.append("username", name);
      formData.append("email", email);
      formData.append("message", message);
      formData.append("rating", rating);
      formData.append("productId", productId);
      formData.append("productTitle", productTitle);
      
      // Add image file if selected
      if (imageFile) {
        formData.append("image", imageFile);
      }

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";

      try {
        const res = await fetch(`/apps/proxy/userdata/submit-form?shop=${encodeURIComponent(form.dataset.shop)}`, {
          method: "POST",
          // Don't set Content-Type header - let browser set it with boundary for FormData
          body: formData
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to submit review");
        }

        const msg = document.createElement("div");
        msg.className = "app-form-message";
        msg.innerText = "Thanks! Your review has been submitted.";
        form.appendChild(msg);

        form.reset();
        
        // Clear image preview
        const imageInput = form.querySelector("input[name='image']");
        if (imageInput) {
          const blockId = imageInput.id.split('-').pop();
          const previewDiv = document.getElementById(`image-preview-${blockId}`);
          if (previewDiv) {
            previewDiv.style.display = 'none';
          }
        }
      } catch (err) {
        const errMsg = document.createElement("div");
        errMsg.className = "app-form-error";
        errMsg.innerText = err.message;
        form.appendChild(errMsg);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Review";
      }
    });
  });
});
