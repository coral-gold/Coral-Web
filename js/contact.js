(function () {
  "use strict";
  var esc = window.Coral.escapeHTML;

  /* ---- render contact details from CMS-edited JSON ---- */
  window.Coral.loadJSON("api/content.php?page=contact").then(function (data) {
    var addressEl = document.getElementById("contactAddress");
    var phoneEl = document.getElementById("contactPhone");
    var emailEl = document.getElementById("contactEmail");
    var whatsappEl = document.getElementById("contactWhatsapp");
    var hoursEl = document.getElementById("contactHours");

    if (addressEl) addressEl.textContent = data.address_line;
    if (phoneEl) {
      phoneEl.textContent = data.phone;
      phoneEl.href = data.phone_href;
    }
    if (emailEl) {
      emailEl.textContent = data.email;
      emailEl.href = "mailto:" + data.email;
    }
    if (whatsappEl) whatsappEl.href = data.whatsapp_href;
    if (hoursEl) hoursEl.textContent = data.hours;

    window.Coral._contactEmail = data.email;
  });

  /* ---- form: validation + spam protection (SRS 4.6) ----
     No CAPTCHA/third-party script is used. Two lightweight, no-backend
     heuristics catch the vast majority of automated spam:
       1. Honeypot field: a field hidden from sighted users via CSS that
          real visitors never fill in; bots that auto-fill every field trip it.
       2. Time trap: a form submitted faster than a human could type it out
          (< 3s from render) is treated as automated. */
  var FORM_ENDPOINT = null; // e.g. "https://formspree.io/f/your-id"
  var formRenderedAt = Date.now();

  var form = document.getElementById("contactForm");
  if (!form) return;

  var fields = {
    name: { input: document.getElementById("name"), error: document.getElementById("nameError") },
    contactMethod: { input: document.getElementById("contactMethod"), error: document.getElementById("contactMethodError") },
    message: { input: document.getElementById("message"), error: document.getElementById("messageError") }
  };
  var formNote = document.getElementById("formNote");
  var honeypot = document.getElementById("website");

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

    if (honeypot && honeypot.value) {
      /* Silently drop likely-bot submissions without revealing the trap. */
      form.reset();
      formNote.textContent = "Thank you! Your enquiry has been sent.";
      return;
    }

    if (Date.now() - formRenderedAt < 3000) {
      formNote.textContent = "Please take a moment to review your message, then submit again.";
      return;
    }

    if (!validate()) {
      formNote.textContent = "Please fix the highlighted fields.";
      return;
    }

    var name = fields.name.input.value.trim();
    var company = document.getElementById("company") ? document.getElementById("company").value.trim() : "";
    var contactVal = fields.contactMethod.input.value.trim();
    var message = fields.message.input.value.trim();
    var email = window.Coral._contactEmail || "info@coral.example";

    if (FORM_ENDPOINT) {
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ name: name, company: company, contact: contactVal, message: message })
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
      var subject = "Enquiry from " + name + (company ? " (" + company + ")" : "");
      var body = "Name: " + name + (company ? "\nCompany: " + company : "") + "\nContact: " + contactVal + "\n\nMessage:\n" + message;
      window.location.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      formNote.textContent = "Opening your email app to send this enquiry...";
    }
  });
})();
