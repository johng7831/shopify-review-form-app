document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".app-review-form").forEach(form => {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      // Remove previous messages
      const existingMsg = form.querySelector(".app-form-message, .app-form-error");
      if (existingMsg) existingMsg.remove();

      const username = form.querySelector("input[name='username']").value.trim();
      if (!username) {
        const err = document.createElement("div");
        err.className = "app-form-error";
        err.innerText = "Please enter your name.";
        form.appendChild(err);
        return;
      }

      const email = form.querySelector("input[name='email']").value.trim();
      if (!email) {
        const err = document.createElement("div");
        err.className = "app-form-error";
        err.innerText = "Please enter your email address.";
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

      // Create FormData for file + text
      const formData = new FormData();
      formData.append("username", username);
      formData.append("email", email);
      formData.append("message", message);
      formData.append("rating", rating);
      formData.append("productTitle", productTitle);
      formData.append("productId", productId);

      const fileInput = form.querySelector("input[name='image']");
      if (fileInput && fileInput.files.length > 0) {
        formData.append("image", fileInput.files[0]);
      }

      const submitBtn = form.querySelector("button[type='submit']");
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";

      try {
        const res = await fetch(`/apps/proxy/userdata/submit-form?shop=${encodeURIComponent(form.dataset.shop)}`, {
          method: "POST",
          body: formData // FormData automatically sets multipart/form-data
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
