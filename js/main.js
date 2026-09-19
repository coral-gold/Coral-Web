(function () {
  "use strict";

  /* Mobile hamburger menu (FR-2) */
  var navToggle = document.getElementById("navToggle");
  var primaryNav = document.getElementById("primaryNav");

  if (navToggle && primaryNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = primaryNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    primaryNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        primaryNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Footer year */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* Contact form validation + submission (FR-5)
     No backend/database is used. This sends the enquiry via the visitor's
     default email client (mailto:). To use a lightweight email-sending
     service instead (e.g. Formspree), set FORM_ENDPOINT below to that
     service's endpoint URL and the form will POST to it instead. */
  var FORM_ENDPOINT = null; // e.g. "https://formspree.io/f/your-id"
  var CONTACT_EMAIL = "info@coralgold.example"; // PLACEHOLDER: replace with confirmed email

  var form = document.getElementById("contactForm");
  if (form) {
    var fields = {
      name: { input: document.getElementById("name"), error: document.getElementById("nameError") },
      contactMethod: { input: document.getElementById("contactMethod"), error: document.getElementById("contactMethodError") },
      message: { input: document.getElementById("message"), error: document.getElementById("messageError") }
    };
    var formNote = document.getElementById("formNote");

    function validate() {
      var valid = true;

      if (!fields.name.input.value.trim()) {
        fields.name.error.textContent = "Please enter your name.";
        fields.name.input.parentElement.classList.add("has-error");
        valid = false;
      } else {
        fields.name.error.textContent = "";
        fields.name.input.parentElement.classList.remove("has-error");
      }

      var contactVal = fields.contactMethod.input.value.trim();
      var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      var phonePattern = /^[+()\-\s\d]{7,}$/;
      if (!contactVal || (!emailPattern.test(contactVal) && !phonePattern.test(contactVal))) {
        fields.contactMethod.error.textContent = "Please enter a valid phone number or email address.";
        fields.contactMethod.input.parentElement.classList.add("has-error");
        valid = false;
      } else {
        fields.contactMethod.error.textContent = "";
        fields.contactMethod.input.parentElement.classList.remove("has-error");
      }

      if (!fields.message.input.value.trim()) {
        fields.message.error.textContent = "Please enter a message.";
        fields.message.input.parentElement.classList.add("has-error");
        valid = false;
      } else {
        fields.message.error.textContent = "";
        fields.message.input.parentElement.classList.remove("has-error");
      }

      return valid;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      formNote.textContent = "";

      if (!validate()) {
        formNote.textContent = "Please fix the highlighted fields.";
        return;
      }

      var name = fields.name.input.value.trim();
      var contactVal = fields.contactMethod.input.value.trim();
      var message = fields.message.input.value.trim();

      if (FORM_ENDPOINT) {
        fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ name: name, contact: contactVal, message: message })
        })
          .then(function (res) {
            if (res.ok) {
              form.reset();
              formNote.textContent = "Thank you! Your enquiry has been sent.";
            } else {
              formNote.textContent = "Something went wrong. Please try again or contact us directly.";
            }
          })
          .catch(function () {
            formNote.textContent = "Something went wrong. Please try again or contact us directly.";
          });
      } else {
        var subject = "Enquiry from " + name;
        var body = "Name: " + name + "\nContact: " + contactVal + "\n\nMessage:\n" + message;
        var mailtoLink =
          "mailto:" + CONTACT_EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
        window.location.href = mailtoLink;
        formNote.textContent = "Opening your email app to send this enquiry...";
      }
    });
  }
})();
